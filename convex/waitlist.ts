import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, mutation, query } from "./_generated/server";
import { logAdminAction, requireAdmin } from "./helpers";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const role = v.union(v.literal("member"), v.literal("student"), v.literal("dietitian"));
/** At most this many welcome emails an hour, so the form can't be used to spam people. */
const WELCOME_PER_HOUR = 60;

/** Public: join the launch waitlist from the landing page. Idempotent per email; new joiners get a welcome email. */
export const join = mutation({
  args: { email: v.string(), role },
  handler: async (ctx, { email, role }) => {
    const clean = email.trim().toLowerCase();
    if (clean.length > 254 || !EMAIL.test(clean)) throw new ConvexError("Please enter a valid email address.");
    const existing = await ctx.db.query("waitlist").withIndex("by_email", (q) => q.eq("email", clean)).unique();
    if (existing) return { alreadyJoined: true, emailed: false };
    await ctx.db.insert("waitlist", { email: clean, role, createdAt: Date.now() });
    // One welcome email per address (the dedupe above), and a cap per hour across everyone.
    let emailed = false;
    if (process.env.AUTH_RESEND_KEY) {
      const lastHour = await ctx.db.query("waitlist").withIndex("by_creation_time", (q) => q.gt("_creationTime", Date.now() - 3_600_000)).take(WELCOME_PER_HOUR + 1);
      if (lastHour.length <= WELCOME_PER_HOUR) {
        await ctx.scheduler.runAfter(0, internal.waitlist.sendWelcome, { email: clean, role });
        emailed = true;
      }
    }
    return { alreadyJoined: false, emailed };
  },
});

const WELCOME: Record<"member" | "student" | "dietitian", string> = {
  member: "We'll email you when Kalorax opens to everyone, with a few tips to get your first week off to a good start.",
  student: "We'll email you when Kalorax opens, including how to get your student account verified so you can use the Workbench.",
  dietitian: "We'll email you when Kalorax opens, including how to get verified and start offering paid programmes to clients.",
};

/** "You're on the list" email through Resend (same key and sender as password reset). */
export const sendWelcome = internalAction({
  args: { email: v.string(), role },
  handler: async (_ctx, { email, role }) => {
    const key = process.env.AUTH_RESEND_KEY;
    if (!key) return;
    const site = (process.env.SITE_URL ?? "https://kalorax.netlify.app").replace(/\/$/, "");
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.AUTH_EMAIL_FROM ?? "Kalorax <no-reply@kalorax.ng>",
          to: [email],
          subject: "You're on the Kalorax waitlist",
          text:
            `Thanks for joining the Kalorax waitlist!\n\n${WELCOME[role]}\n\n` +
            `You can already start for free at ${site}: log your meals, water and activity with portions that match real Nigerian plates.\n\n` +
            `If you didn't sign up, you can ignore this email and we won't write again.\n\n— The Kalorax team`,
        }),
      });
      if (!res.ok) console.error("waitlist welcome failed", res.status);
    } catch (err) {
      console.error("waitlist welcome unreachable", (err as Error).name);
    }
  },
});

/** Admin: everyone on the waitlist, newest first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("waitlist").order("desc").take(5000);
    return rows.map((r) => ({ id: r._id, email: r.email, role: r.role, joinedAt: new Date(r.createdAt).toISOString() }));
  },
});

/** Admin: notes a download of the waitlist in the audit log (the emails are personal data). */
export const recordExport = mutation({
  args: { count: v.number() },
  handler: async (ctx, { count }) => {
    const adminId = await requireAdmin(ctx);
    await logAdminAction(ctx, adminId, "waitlist_exported", undefined, `Downloaded the waitlist (${Math.max(0, Math.round(count))} emails) as CSV`);
  },
});

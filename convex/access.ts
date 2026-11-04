// Private mode: while it's on, the public sees only the waitlist, and only admins and invited emails can
// create an account or use the app (enforced in requireUser and when an account is created, see auth.ts).
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, mutation, query } from "./_generated/server";
import { isPrivateMode, logAdminAction, requireAdmin } from "./helpers";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const role = v.union(v.literal("member"), v.literal("student"), v.literal("dietitian"));

/** Public: whether the app is in private mode (the landing page shows only the waitlist). */
export const status = query({
  args: {},
  handler: async (ctx) => ({ privateMode: await isPrivateMode(ctx) }),
});

/** Admin: turn private mode on or off. */
export const setPrivateMode = mutation({
  args: { on: v.boolean() },
  handler: async (ctx, { on }) => {
    const adminId = await requireAdmin(ctx);
    const row = await ctx.db.query("appConfig").withIndex("by_key", (q) => q.eq("key", "access")).unique();
    if (!!row?.privateMode === on) return;
    if (row) await ctx.db.patch(row._id, { privateMode: on, updatedAt: Date.now() });
    else await ctx.db.insert("appConfig", { key: "access", privateMode: on, updatedAt: Date.now() });
    await logAdminAction(ctx, adminId, on ? "private_mode_on" : "private_mode_off", undefined,
      on ? "Private mode on: only admins and invited people can sign up and use the app" : "Private mode off: anyone can sign up");
  },
});

/** Admin: let this email in while private mode is on. Sends an invite email when email is set up. */
export const invite = mutation({
  args: { email: v.string(), role },
  handler: async (ctx, { email, role }) => {
    const adminId = await requireAdmin(ctx);
    const clean = email.trim().toLowerCase();
    if (clean.length > 254 || !EMAIL.test(clean)) throw new ConvexError("Please enter a valid email address.");
    if (await ctx.db.query("invites").withIndex("by_email", (q) => q.eq("email", clean)).first()) return { alreadyInvited: true, emailed: false };
    await ctx.db.insert("invites", { email: clean, role, invitedBy: adminId, createdAt: Date.now() });
    await logAdminAction(ctx, adminId, "invite_added", undefined, `Invited ${clean} (${role})`);
    const emailed = !!process.env.AUTH_RESEND_KEY;
    if (emailed) await ctx.scheduler.runAfter(0, internal.access.sendInvite, { email: clean });
    return { alreadyInvited: false, emailed };
  },
});

/** Admin: take an invite back. Someone who already has an account loses access while private mode is on. */
export const removeInvite = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const adminId = await requireAdmin(ctx);
    const clean = email.trim().toLowerCase();
    const rows = await ctx.db.query("invites").withIndex("by_email", (q) => q.eq("email", clean)).collect();
    for (const r of rows) await ctx.db.delete(r._id);
    if (rows.length) await logAdminAction(ctx, adminId, "invite_removed", undefined, `Removed the invite for ${clean}`);
  },
});

/** Admin: the switch and everyone invited, with whether they've created their account yet. */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const invites = await ctx.db.query("invites").order("desc").take(1000);
    const rows = await Promise.all(
      invites.map(async (i) => ({
        email: i.email,
        role: i.role,
        invitedAt: new Date(i.createdAt).toISOString(),
        joined: !!(await ctx.db.query("users").withIndex("email", (q) => q.eq("email", i.email)).first()),
      })),
    );
    return { privateMode: await isPrivateMode(ctx), invites: rows };
  },
});

/** "You're invited to test Kalorax" email through Resend (same key and sender as password reset). */
export const sendInvite = internalAction({
  args: { email: v.string() },
  handler: async (_ctx, { email }) => {
    const key = process.env.AUTH_RESEND_KEY;
    if (!key) return;
    const site = (process.env.SITE_URL ?? "https://kalorax.netlify.app").replace(/\/$/, "");
    const link = `${site}/auth?mode=signup&email=${encodeURIComponent(email)}`;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.AUTH_EMAIL_FROM ?? "Kalorax <no-reply@kalorax.ng>",
          to: [email],
          subject: "You're invited to try Kalorax early",
          text:
            `You've been invited to try Kalorax before it opens to everyone.\n\n` +
            `Create your account with this email address (${email}) here:\n${link}\n\n` +
            `Kalorax helps you track meals, water and activity with portions that match real Nigerian plates, and get plans from verified dietitians.\n\n` +
            `If you weren't expecting this, you can ignore it.\n\n— The Kalorax team`,
        }),
      });
      if (!res.ok) console.error("invite email failed", res.status);
    } catch (err) {
      console.error("invite email unreachable", (err as Error).name);
    }
  },
});

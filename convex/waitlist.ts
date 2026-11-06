import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { logAdminAction, requireAdmin } from "./helpers";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const role = v.union(v.literal("member"), v.literal("student"), v.literal("dietitian"));
/** At most this many welcome emails an hour, so the form can't be used to spam people. */
const WELCOME_PER_HOUR = 60;

/** Invite 3 friends who join with your link and you move into the first invite group. */
export const REFERRAL_GOAL = 3;
const CODE = /^[a-z2-9]{8}$/;
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

async function uniqueCode(ctx: MutationCtx) {
  for (;;) {
    const code = newCode();
    if (!(await ctx.db.query("waitlist").withIndex("by_code", (q) => q.eq("code", code)).unique())) return code;
  }
}

/** Invite order: people who reached the referral goal first (in the order they reached it), then everyone else by join date. */
export function inviteOrder<T extends Pick<Doc<"waitlist">, "createdAt" | "boostedAt">>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    a.boostedAt !== undefined && b.boostedAt !== undefined ? a.boostedAt - b.boostedAt
      : a.boostedAt !== undefined ? -1
        : b.boostedAt !== undefined ? 1
          : a.createdAt - b.createdAt,
  );
}

/** Where an entry stands: place in line, out of how many, and their referrals. */
async function standing(ctx: QueryCtx, entry: Doc<"waitlist">) {
  const all = inviteOrder(await ctx.db.query("waitlist").take(20000));
  const referrals = entry.referrals ?? 0;
  return {
    code: entry.code ?? null,
    position: all.findIndex((r) => r._id === entry._id) + 1,
    total: all.length,
    referrals,
    goal: REFERRAL_GOAL,
    boosted: entry.boostedAt !== undefined,
  };
}

/** Public: join the launch waitlist from the landing page. Idempotent per email; new joiners get a welcome email. */
export const join = mutation({
  args: { email: v.string(), role, ref: v.optional(v.string()) },
  handler: async (ctx, { email, role, ref }) => {
    const clean = email.trim().toLowerCase();
    if (clean.length > 254 || !EMAIL.test(clean)) throw new ConvexError("Please enter a valid email address.");
    const existing = await ctx.db.query("waitlist").withIndex("by_email", (q) => q.eq("email", clean)).unique();
    if (existing) {
      // Coming back: give older entries a code so they can share too. Joining again never counts as a referral.
      if (!existing.code) await ctx.db.patch(existing._id, { code: await uniqueCode(ctx) });
      return { alreadyJoined: true, emailed: false, code: (await ctx.db.get(existing._id))!.code! };
    }
    const refCode = ref?.trim().toLowerCase();
    const referrer = refCode && CODE.test(refCode) ? await ctx.db.query("waitlist").withIndex("by_code", (q) => q.eq("code", refCode)).unique() : null;
    const code = await uniqueCode(ctx);
    await ctx.db.insert("waitlist", { email: clean, role, createdAt: Date.now(), code, ...(referrer ? { referredBy: referrer._id } : {}) });
    if (referrer) {
      const referrals = (referrer.referrals ?? 0) + 1;
      await ctx.db.patch(referrer._id, { referrals, ...(referrals >= REFERRAL_GOAL && referrer.boostedAt === undefined ? { boostedAt: Date.now() } : {}) });
    }
    // One welcome email per address (the dedupe above), and a cap per hour across everyone.
    let emailed = false;
    if (process.env.AUTH_RESEND_KEY) {
      const lastHour = await ctx.db.query("waitlist").withIndex("by_creation_time", (q) => q.gt("_creationTime", Date.now() - 3_600_000)).take(WELCOME_PER_HOUR + 1);
      if (lastHour.length <= WELCOME_PER_HOUR) {
        await ctx.scheduler.runAfter(0, internal.waitlist.sendWelcome, { email: clean, role, code });
        emailed = true;
      }
    }
    return { alreadyJoined: false, emailed, code };
  },
});

/** Public: someone's place in line, by their private referral code (kept in their browser after joining). */
export const status = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const c = code.trim().toLowerCase();
    if (!CODE.test(c)) return null;
    const entry = await ctx.db.query("waitlist").withIndex("by_code", (q) => q.eq("code", c)).unique();
    return entry ? await standing(ctx, entry) : null;
  },
});

const WELCOME: Record<"member" | "student" | "dietitian", string> = {
  member: "We'll email you when Kalorax opens to everyone, with a few tips to get your first week off to a good start.",
  student: "We'll email you when Kalorax opens, including how to get your student account verified so you can use the Workbench.",
  dietitian: "We'll email you when Kalorax opens, including how to get verified and start offering paid programmes to clients.",
};

/** "You're on the list" email through Resend (same key and sender as password reset). */
export const sendWelcome = internalAction({
  args: { email: v.string(), role, code: v.string() },
  handler: async (_ctx, { email, role, code }) => {
    const key = process.env.AUTH_RESEND_KEY;
    if (!key) return;
    const site = (process.env.SITE_URL ?? "https://kalorax.app").replace(/\/$/, "");
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.AUTH_EMAIL_FROM ?? "Kalorax <no-reply@kalorax.app>",
          to: [email],
          subject: "You're on the Kalorax waitlist",
          text:
            `Thanks for joining the Kalorax waitlist!\n\n${WELCOME[role]}\n\n` +
            `Want an earlier invite? Share your link and when ${REFERRAL_GOAL} friends join, you move into the first group: ${site}/?ref=${code}\n\n` +
            `If you didn't sign up, you can ignore this email and we won't write again.\n\n— The Kalorax team`,
        }),
      });
      if (!res.ok) console.error("waitlist welcome failed", res.status);
    } catch (err) {
      console.error("waitlist welcome unreachable", (err as Error).name);
    }
  },
});

/** Admin: everyone on the waitlist in invite order (referral goal reached first, then by join date). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = inviteOrder(await ctx.db.query("waitlist").take(20000));
    return rows.map((r, i) => ({
      id: r._id, email: r.email, role: r.role, joinedAt: new Date(r.createdAt).toISOString(),
      position: i + 1, referrals: r.referrals ?? 0, boosted: r.boostedAt !== undefined,
    }));
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

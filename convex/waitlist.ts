import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { logAdminAction, requireAdmin } from "./helpers";
import { take, tryTake } from "./rateLimit";
import { emailConfigured, sendEmail } from "./email";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const role = v.union(v.literal("member"), v.literal("student"), v.literal("dietitian"));

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

const COUNTER = "waitlist";

/**
 * Gives every entry its join number the first time it's needed (entries made before join numbers existed),
 * and returns the counter. After that, each join just adds one.
 */
async function waitlistCounter(ctx: MutationCtx) {
  const row = await ctx.db.query("counters").withIndex("by_name", (q) => q.eq("name", COUNTER)).unique();
  if (row) return row;
  const all = (await ctx.db.query("waitlist").take(20000)).sort((a, b) => a.createdAt - b.createdAt);
  for (const [i, r] of all.entries()) if (r.seq !== i + 1) await ctx.db.patch(r._id, { seq: i + 1 });
  const id = await ctx.db.insert("counters", { name: COUNTER, value: all.length });
  return (await ctx.db.get(id))!;
}

/**
 * Where an entry stands: place in line, out of how many, and their referrals. Reads the counter and the
 * (short) list of people in the first invite group, not the whole waitlist, so it stays cheap as the list grows.
 */
async function standing(ctx: QueryCtx, entry: Doc<"waitlist">) {
  const referrals = entry.referrals ?? 0;
  const base = { code: entry.code ?? null, referrals, goal: REFERRAL_GOAL, boosted: entry.boostedAt !== undefined };
  const counter = await ctx.db.query("counters").withIndex("by_name", (q) => q.eq("name", COUNTER)).unique();
  if (!counter || entry.seq === undefined) {
    // Before the first join numbers are given out (right after this update): the old, full count.
    const all = inviteOrder(await ctx.db.query("waitlist").take(20000));
    return { ...base, position: all.findIndex((r) => r._id === entry._id) + 1, total: all.length };
  }
  const boosted = await ctx.db.query("waitlist").withIndex("by_boosted", (q) => q.gte("boostedAt", 0)).take(5000);
  if (entry.boostedAt !== undefined) {
    const ahead = boosted.filter((b) => b._id !== entry._id && (b.boostedAt! < entry.boostedAt! || (b.boostedAt === entry.boostedAt && b.createdAt < entry.createdAt))).length;
    return { ...base, position: ahead + 1, total: counter.value };
  }
  // Everyone who joined before me, minus those who've moved into the first group, plus that whole group.
  const boostedBefore = boosted.filter((b) => (b.seq ?? 0) < entry.seq!).length;
  return { ...base, position: boosted.length + (entry.seq - 1 - boostedBefore) + 1, total: counter.value };
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
    // Open to the internet without sign-in: a cap for everyone together stops scripted floods.
    await take(ctx, "waitlistJoinGlobal");
    const refCode = ref?.trim().toLowerCase();
    const referrer = refCode && CODE.test(refCode) ? await ctx.db.query("waitlist").withIndex("by_code", (q) => q.eq("code", refCode)).unique() : null;
    const code = await uniqueCode(ctx);
    const counter = await waitlistCounter(ctx);
    const seq = counter.value + 1;
    await ctx.db.patch(counter._id, { value: seq });
    const confirmToken = emailConfigured() ? randomToken() : undefined;
    const id = await ctx.db.insert("waitlist", {
      email: clean, role, createdAt: Date.now(), code, seq, ...(confirmToken ? { confirmToken } : {}), ...(referrer ? { referredBy: referrer._id } : {}),
    });
    // With email on, a referral counts only once the friend confirms their address (made-up emails never do).
    // Without email there's no way to confirm, so it counts straight away.
    if (referrer && !confirmToken) await creditReferral(ctx, id);
    // One welcome email per address (the dedupe above), within the day's share of the email quota.
    let emailed = false;
    if (confirmToken && (await tryTake(ctx, "welcomeEmailsDaily", "", 1, welcomePerDay()))) {
      await ctx.scheduler.runAfter(0, internal.waitlist.sendWelcome, { email: clean, role, code, confirmToken });
      emailed = true;
    }
    return { alreadyJoined: false, emailed, code };
  },
});

/** Welcome emails a day (WELCOME_EMAILS_PER_DAY, default 40), leaving the rest of Resend's quota for codes. */
const welcomePerDay = () => {
  const n = Number(process.env.WELCOME_EMAILS_PER_DAY);
  return Number.isFinite(n) && n >= 0 ? n : 40;
};

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Counts this entry towards its referrer (once), moving them into the first group at the goal. */
async function creditReferral(ctx: MutationCtx, entryId: Doc<"waitlist">["_id"]) {
  const entry = await ctx.db.get(entryId);
  if (!entry?.referredBy || entry.referralCredited) return;
  const referrer = await ctx.db.get(entry.referredBy);
  await ctx.db.patch(entry._id, { referralCredited: true });
  if (!referrer) return;
  const referrals = (referrer.referrals ?? 0) + 1;
  await ctx.db.patch(referrer._id, { referrals, ...(referrals >= REFERRAL_GOAL && referrer.boostedAt === undefined ? { boostedAt: Date.now() } : {}) });
}

/** Public: the confirm link in the welcome email (/?confirm=TOKEN). Confirms the address and credits the referral. */
export const confirm = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const t = token.trim().toLowerCase();
    if (!/^[0-9a-f]{36}$/.test(t)) return { ok: false as const };
    const entry = await ctx.db.query("waitlist").withIndex("by_confirm_token", (q) => q.eq("confirmToken", t)).unique();
    if (!entry) return { ok: false as const };
    if (!entry.confirmedAt) await ctx.db.patch(entry._id, { confirmedAt: Date.now() });
    await creditReferral(ctx, entry._id);
    return { ok: true as const, code: entry.code ?? null };
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

/** "You're on the list" email, with the confirm link and their share link (Resend; see email.ts). */
export const sendWelcome = internalAction({
  args: { email: v.string(), role, code: v.string(), confirmToken: v.string() },
  handler: async (_ctx, { email, role, code, confirmToken }) => {
    if (!emailConfigured()) return;
    const site = (process.env.SITE_URL ?? "https://kalorax.app").replace(/\/$/, "");
    try {
      await sendEmail({
        to: email,
        subject: "Confirm your place on the Kalorax waitlist",
        text:
          `Thanks for joining the Kalorax waitlist!\n\nPlease confirm your email so we can send your invite:\n${site}/?confirm=${confirmToken}\n\n` +
          `${WELCOME[role]}\n\n` +
          `Want an earlier invite? Share your link. When ${REFERRAL_GOAL} friends join and confirm, you move into the first group:\n${site}/?ref=${code}\n\n` +
          `If you didn't sign up, you can ignore this email and we won't write again.\n\n— The Kalorax team`,
        // One welcome per address.
        idempotencyKey: `welcome/${email}`,
      });
    } catch {
      // Logged by sendEmail; the person is on the list either way.
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
      position: i + 1, referrals: r.referrals ?? 0, boosted: r.boostedAt !== undefined, confirmed: r.confirmedAt !== undefined,
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

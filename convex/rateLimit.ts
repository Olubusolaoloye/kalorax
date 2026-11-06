// Rate limits for anything that costs money (AI, email, WhatsApp, storage) or can be spammed from the
// open internet. Fixed windows per key, e.g. "coach_photo:<userId>" or "waitlist_join" for everyone at once.
// Old windows are cleared daily (crons.ts).
import { ConvexError, v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";

export interface Limit {
  /** Most uses per window. */
  max: number;
  windowMs: number;
  /** Shown to the person when they hit the limit. */
  message: string;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Every limit in one place, so they're easy to review and tune. */
export const LIMITS = {
  // Uploads: each photo or document costs storage.
  coachPhotoPerUser: { max: 30, windowMs: DAY, message: "That's a lot of photos today. Please try again tomorrow." },
  documentUploadPerUser: { max: 10, windowMs: DAY, message: "Too many uploads today. Please try again tomorrow." },
  // Email and WhatsApp: each message costs money and could be aimed at someone who didn't ask.
  passwordResetPerEmail: { max: 3, windowMs: HOUR, message: "Too many reset codes. Please check your email or try again in an hour." },
  passwordResetGlobal: { max: 200, windowMs: HOUR, message: "Password reset is busy. Please try again in a few minutes." },
  verifyCodePerEmail: { max: 5, windowMs: HOUR, message: "Too many codes. Please check your email or try again in an hour." },
  verifyCodeGlobal: { max: 300, windowMs: HOUR, message: "Sign-up is busy. Please try again in a few minutes." },
  // Resend's free plan sends 100 emails a day (UTC), shared by codes and welcome emails. Welcome emails get only
  // part of it, so reset and sign-up codes keep working (WELCOME_EMAILS_PER_DAY raises it on a paid plan).
  welcomeEmailsDaily: { max: 40, windowMs: DAY, message: "" },
  whatsappCodePerPhone: { max: 3, windowMs: DAY, message: "Too many codes to this number today. Please try again tomorrow." },
  whatsappCodeGlobal: { max: 300, windowMs: HOUR, message: "WhatsApp codes are busy. Please try again in a few minutes." },
  // Public, no sign-in: caps for everyone together.
  waitlistJoinGlobal: { max: 600, windowMs: HOUR, message: "Lots of people are joining right now. Please try again in a few minutes." },
  vitalsGlobal: { max: 3000, windowMs: HOUR, message: "" },
  // Spam and runaway clients.
  newChatsPerUser: { max: 30, windowMs: DAY, message: "You've started a lot of new chats today. Please try again tomorrow." },
  diaryEntriesPerUser: { max: 300, windowMs: DAY, message: "That's a lot of entries for one day. Please try again tomorrow." },
  paymentStartsPerUser: { max: 20, windowMs: HOUR, message: "Too many payment attempts. Please wait a while and try again." },
  paymentChecksPerUser: { max: 60, windowMs: HOUR, message: "Too many payment checks. Please wait a while and try again." },
  teamsCreatedPerUser: { max: 10, windowMs: DAY, message: "You've created a lot of teams today. Please try again tomorrow." },
} satisfies Record<string, Limit>;

export type LimitName = keyof typeof LIMITS;

/** Uses one slot. Returns false when the window is full (nothing is recorded then). */
export async function tryTake(ctx: MutationCtx, name: LimitName, scope: string, count = 1, max?: number): Promise<boolean> {
  const limit: Limit = { ...LIMITS[name], ...(max !== undefined ? { max } : {}) };
  const key = scope ? `${name}:${scope}` : name;
  const now = Date.now();
  const windowStart = now - (now % limit.windowMs);
  const row = await ctx.db.query("rateLimits").withIndex("by_key", (q) => q.eq("key", key)).unique();
  const used = row && row.windowStart === windowStart ? row.count : 0;
  if (used + count > limit.max) return false;
  if (row) await ctx.db.patch(row._id, { windowStart, count: used + count });
  else await ctx.db.insert("rateLimits", { key, windowStart, count: used + count });
  return true;
}

/** Uses one slot, or stops with the limit's message. */
export async function take(ctx: MutationCtx, name: LimitName, scope = "", count = 1) {
  if (!(await tryTake(ctx, name, scope, count))) throw new ConvexError(LIMITS[name].message);
}

/** For actions (e.g. the password-reset email), which can't write to the database directly. */
export const takeInternal = internalMutation({
  args: { name: v.string(), scope: v.string() },
  handler: async (ctx, { name, scope }) => {
    if (!(name in LIMITS)) throw new Error(`Unknown limit ${name}`);
    return tryTake(ctx, name as LimitName, scope);
  },
});

/** Clears finished windows (runs daily). */
export const prune = internalMutation({
  args: {},
  handler: async (ctx) => {
    const old = await ctx.db.query("rateLimits").withIndex("by_window", (q) => q.lt("windowStart", Date.now() - 2 * DAY)).take(4000);
    for (const r of old) await ctx.db.delete(r._id);
  },
});

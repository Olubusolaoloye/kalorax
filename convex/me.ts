import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { checkDate, getProfile, isAdmin } from "./helpers";
import { activeTarget } from "./interventions";

/** How much dated history the snapshot carries. Older days load on demand through `history`. */
export const HISTORY_DAYS = 180;

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Dated rows (diary, water, notes, exercises, events, plan) for one member between two dates, inclusive. */
async function datedRows(ctx: QueryCtx, userId: Id<"users">, from: string, to: string) {
  const [diary, water, notes, exercises, events, plan] = await Promise.all([
    ctx.db.query("diary").withIndex("by_user_date", (q) => q.eq("userId", userId).gte("date", from).lte("date", to)).collect(),
    ctx.db.query("water").withIndex("by_user_date", (q) => q.eq("userId", userId).gte("date", from).lte("date", to)).collect(),
    ctx.db.query("notes").withIndex("by_user_date_slot", (q) => q.eq("userId", userId).gte("date", from).lte("date", to)).collect(),
    ctx.db.query("exercises").withIndex("by_user_date", (q) => q.eq("userId", userId).gte("date", from).lte("date", to)).collect(),
    ctx.db.query("events").withIndex("by_user_date", (q) => q.eq("userId", userId).gte("date", from).lte("date", to)).collect(),
    ctx.db.query("plan").withIndex("by_user_date_meal", (q) => q.eq("userId", userId).gte("date", from).lte("date", to)).collect(),
  ]);
  return { diary, water, notes, exercises, events, plan };
}

/**
 * Everything the app needs for the signed-in user, in one reactive query.
 * Dated rows cover the last HISTORY_DAYS days (plus planned days ahead), so the payload stays
 * small however long someone has used the app. Returns null when signed out.
 */
export const snapshot = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const historyFrom = isoDay(Date.now() - HISTORY_DAYS * 86_400_000);
    const [user, profile, dated, weights, grocery, verifications, settings, admin, dietitianTarget] = await Promise.all([
      ctx.db.get(userId),
      getProfile(ctx, userId),
      datedRows(ctx, userId, historyFrom, "9999-12-31"),
      // Weigh-ins are few and the progress chart shows them all.
      ctx.db.query("weights").withIndex("by_user_date", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("grocery").withIndex("by_user", (q) => q.eq("userId", userId)).unique(),
      ctx.db.query("verifications").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("settings").withIndex("by_user", (q) => q.eq("userId", userId)).unique(),
      isAdmin(ctx, userId),
      activeTarget(ctx, userId),
    ]);
    const { diary, water, notes, exercises, events, plan } = dated;
    const latest = verifications.sort((a, b) => b.submittedAt - a.submittedAt)[0] ?? null;

    return {
      email: user?.email ?? null,
      isAdmin: admin,
      profile,
      verification: latest && { status: latest.status, credential: latest.credential, reviewerNote: latest.reviewerNote ?? null, hasDocument: !!latest.documentId },
      diary,
      water,
      weights,
      events,
      exercises,
      notes,
      plan,
      grocery,
      planPrefs: settings?.planPrefs ?? null,
      reminders: settings?.reminders ?? null,
      /** Set by the member's dietitian on an active programme; replaces the automatic target. */
      dietitianTarget,
      /** First date the dated rows above cover; older days come from `history`. */
      historyFrom,
    };
  },
});

/** Older days (before the snapshot's historyFrom), for the diary and calendar when you go back. Up to 62 days at a time. */
export const history = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    checkDate(from);
    checkDate(to);
    if (from > to || Date.parse(to) - Date.parse(from) > 62 * 86_400_000) throw new ConvexError("Choose up to two months at a time.");
    return datedRows(ctx, userId, from, to);
  },
});

// Weekly challenges on the server: friends' leaderboard. Scores come from each person's own logs with the
// same scoring as the app (src/lib/challenges.ts), so nobody can post a made-up score. Only points, days
// logged and active minutes are shared: never food, weight or water amounts.
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { scoreWeek } from "../src/lib/challenges";
import { shiftDate } from "../src/lib/dates";
import { dailyWaterTargetMl } from "../src/lib/nutrition/water";
import { checkDate, getProfile, requireUser } from "./helpers";

/** At most this many friends on the leaderboard (most recent chats first). */
const MAX_FRIENDS = 50;

export const weekOf = (weekStart: string) => Array.from({ length: 7 }, (_, i) => shiftDate(weekStart, i));

/** One person's score for the week starting `weekStart` (up to `today`). */
export async function weekScore(ctx: QueryCtx, userId: Id<"users">, weekStart: string, today: string) {
  const dates = weekOf(weekStart);
  const [diary, water, exercises, weights, latest] = await Promise.all([
    ctx.db.query("diary").withIndex("by_user_date", (q) => q.eq("userId", userId).gte("date", dates[0]).lte("date", dates[6])).take(400),
    ctx.db.query("water").withIndex("by_user_date", (q) => q.eq("userId", userId).gte("date", dates[0]).lte("date", dates[6])).take(50),
    ctx.db.query("exercises").withIndex("by_user_date", (q) => q.eq("userId", userId).gte("date", dates[0]).lte("date", dates[6])).take(200),
    ctx.db.query("weights").withIndex("by_user_date", (q) => q.eq("userId", userId).gte("date", dates[0]).lte("date", dates[6])).take(50),
    ctx.db.query("weights").withIndex("by_user_date", (q) => q.eq("userId", userId)).order("desc").first(),
  ]);
  return scoreWeek({ dates, today, diary, water, exercises, weights, waterTargetMl: latest ? dailyWaterTargetMl(latest.weightKg) : 0 });
}

const settingsOf = (ctx: QueryCtx, userId: Id<"users">) => ctx.db.query("settings").withIndex("by_user", (q) => q.eq("userId", userId)).unique();

/** People you chat with (not blocked), most recent first. */
async function friendIds(ctx: QueryCtx, me: Id<"users">) {
  const [asA, asB] = await Promise.all([
    ctx.db.query("conversations").withIndex("by_a", (q) => q.eq("a", me)).order("desc").take(200),
    ctx.db.query("conversations").withIndex("by_b", (q) => q.eq("b", me)).order("desc").take(200),
  ]);
  return [...asA, ...asB]
    .filter((c) => !c.blockedBy)
    .sort((x, y) => y.lastMessageAt - x.lastMessageAt)
    .map((c) => (c.a === me ? c.b : c.a))
    .slice(0, MAX_FRIENDS);
}

/** Join or leave friends' leaderboards. */
export const setLeaderboard = mutation({
  args: { on: v.boolean() },
  handler: async (ctx, { on }) => {
    const userId = await requireUser(ctx);
    const row = await settingsOf(ctx, userId);
    if (row) await ctx.db.patch(row._id, { leaderboard: on });
    else await ctx.db.insert("settings", { userId, leaderboard: on });
  },
});

/** This week's points for you and the friends who joined the leaderboard. Empty until you join too. */
export const friends = query({
  args: { weekStart: v.string(), today: v.string() },
  handler: async (ctx, { weekStart, today }) => {
    const me = await requireUser(ctx);
    checkDate(weekStart);
    checkDate(today);
    const joined = !!(await settingsOf(ctx, me))?.leaderboard;
    if (!joined) return { joined, rows: [], friendsCount: (await friendIds(ctx, me)).length };
    const ids = await friendIds(ctx, me);
    const optedIn = (await Promise.all(ids.map(async (id) => ((await settingsOf(ctx, id))?.leaderboard ? id : null)))).filter((id): id is Id<"users"> => !!id);
    const rows = await Promise.all(
      [me, ...optedIn].map(async (id) => {
        const [profile, score] = await Promise.all([getProfile(ctx, id), weekScore(ctx, id, weekStart, today)]);
        return {
          me: id === me,
          name: profile?.name.split(" ")[0] ?? "Member",
          username: profile?.username ?? null,
          points: score.points,
          daysLogged: score.daysLogged,
          activeMinutes: score.activeMinutes,
          challengesDone: score.challenges.filter((c) => c.done).length,
        };
      }),
    );
    rows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
    return { joined, rows, friendsCount: ids.length };
  },
});

// Weekly challenges on the server: friends' leaderboard. Scores come from each person's own logs with the
// same scoring as the app (src/lib/challenges.ts), so nobody can post a made-up score. Only points, days
// logged and active minutes are shared: never food, weight or water amounts.
//
// Boards are cached (boardCache): a page asks for a refresh when it opens and every few minutes, and the
// board is rebuilt at most every REFRESH_MS. Without this, every meal anyone logged would make every open
// board re-read everyone's week, which costs a lot of database reads as teams and friend lists grow.
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { scoreWeek } from "../src/lib/challenges";
import { shiftDate } from "../src/lib/dates";
import { dailyWaterTargetMl } from "../src/lib/nutrition/water";
import { checkDate, getProfile, requireUser } from "./helpers";

/** At most this many friends on the leaderboard (most recent chats first). */
const MAX_FRIENDS = 50;
/** A cached board is rebuilt at most this often. */
export const REFRESH_MS = 3 * 60_000;

export const weekOf = (weekStart: string) => Array.from({ length: 7 }, (_, i) => shiftDate(weekStart, i));

/** One person's score for the week starting `weekStart` (up to `today`). */
export async function weekScore(ctx: QueryCtx, userId: Id<"users">, weekStart: string, today: string) {
  const dates = weekOf(weekStart);
  const range = { from: dates[0], to: dates[6] };
  const [diary, water, exercises, weights, latest] = await Promise.all([
    ctx.db.query("diary").withIndex("by_user_date", (q) => q.eq("userId", userId).gte("date", range.from).lte("date", range.to)).take(150),
    ctx.db.query("water").withIndex("by_user_date", (q) => q.eq("userId", userId).gte("date", range.from).lte("date", range.to)).take(14),
    ctx.db.query("exercises").withIndex("by_user_date", (q) => q.eq("userId", userId).gte("date", range.from).lte("date", range.to)).take(60),
    ctx.db.query("weights").withIndex("by_user_date", (q) => q.eq("userId", userId).gte("date", range.from).lte("date", range.to)).take(14),
    ctx.db.query("weights").withIndex("by_user_date", (q) => q.eq("userId", userId)).order("desc").first(),
  ]);
  return scoreWeek({ dates, today, diary, water, exercises, weights, waterTargetMl: latest ? dailyWaterTargetMl(latest.weightKg) : 0 });
}

/** A leaderboard row: never food, weight or water amounts. */
export async function boardRow(ctx: QueryCtx, userId: Id<"users">, me: Id<"users">, weekStart: string, today: string) {
  const [profile, score] = await Promise.all([getProfile(ctx, userId), weekScore(ctx, userId, weekStart, today)]);
  return {
    userId,
    me: userId === me,
    name: profile?.name.split(" ")[0] ?? "Member",
    username: profile?.username ?? null,
    points: score.points,
    daysLogged: score.daysLogged,
    activeMinutes: score.activeMinutes,
    challengesDone: score.challenges.filter((c) => c.done).length,
  };
}
export type BoardRow = Awaited<ReturnType<typeof boardRow>>;
export const rankRows = <T extends { points: number; name: string }>(rows: T[]) => rows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

/* ---------- Cache ---------- */

export const readCache = (ctx: QueryCtx, key: string) => ctx.db.query("boardCache").withIndex("by_key", (q) => q.eq("key", key)).unique();

export async function writeCache(ctx: MutationCtx, key: string, data: unknown) {
  const row = await readCache(ctx, key);
  if (row) await ctx.db.patch(row._id, { data, computedAt: Date.now() });
  else await ctx.db.insert("boardCache", { key, data, computedAt: Date.now() });
}

export async function dropCache(ctx: MutationCtx, key: string) {
  const row = await readCache(ctx, key);
  if (row) await ctx.db.delete(row._id);
}

/** Fresh enough to skip a rebuild: same week and day, and built in the last few minutes. */
export const isFresh = (row: { computedAt: number; data: { weekStart?: string; today?: string } } | null, weekStart: string, today: string) =>
  !!row && row.data.weekStart === weekStart && row.data.today === today && Date.now() - row.computedAt < REFRESH_MS;

/* ---------- Friends ---------- */

const settingsOf = (ctx: QueryCtx, userId: Id<"users">) => ctx.db.query("settings").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
const friendsKey = (me: Id<"users">) => `friends:${me}`;

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
    // Show the change straight away: on your own board and on your friends' boards.
    for (const id of [userId, ...(await friendIds(ctx, userId))]) await dropCache(ctx, friendsKey(id));
  },
});

type FriendsData = { weekStart: string; today: string; rows: Array<Omit<BoardRow, "userId">>; friendsCount: number };

/** Rebuilds your friends' board if it's older than a few minutes. Called by the page when it opens and every few minutes. */
export const refreshFriends = mutation({
  args: { weekStart: v.string(), today: v.string() },
  handler: async (ctx, { weekStart, today }) => {
    const me = await requireUser(ctx);
    checkDate(weekStart);
    checkDate(today);
    if (!(await settingsOf(ctx, me))?.leaderboard) return;
    if (isFresh(await readCache(ctx, friendsKey(me)), weekStart, today)) return;
    const ids = await friendIds(ctx, me);
    const optedIn = (await Promise.all(ids.map(async (id) => ((await settingsOf(ctx, id))?.leaderboard ? id : null)))).filter((id): id is Id<"users"> => !!id);
    const rows = rankRows(await Promise.all([me, ...optedIn].map((id) => boardRow(ctx, id, me, weekStart, today))))
      .map(({ userId: _u, ...r }) => r);
    const data: FriendsData = { weekStart, today, rows, friendsCount: ids.length };
    await writeCache(ctx, friendsKey(me), data);
  },
});

/** This week's points for you and the friends who joined the leaderboard (from the cache). Empty until you join too. */
export const friends = query({
  args: { weekStart: v.string(), today: v.string() },
  handler: async (ctx, { weekStart }) => {
    const me = await requireUser(ctx);
    checkDate(weekStart);
    const joined = !!(await settingsOf(ctx, me))?.leaderboard;
    const cache = joined ? await readCache(ctx, friendsKey(me)) : null;
    const data = cache && (cache.data as FriendsData).weekStart === weekStart ? (cache.data as FriendsData) : null;
    return { joined, rows: data?.rows ?? [], friendsCount: data?.friendsCount ?? null, updatedAt: cache ? cache.computedAt : null };
  },
});

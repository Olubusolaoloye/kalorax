// Team challenges for companies, gyms and clubs: one person creates a team and shares its code; members see a
// weekly leaderboard and a shared goal. Only weekly points, days logged and active minutes are shared.
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { ACTIVE_GOAL } from "../src/lib/challenges";
import { checkDate, checkText, getProfile, requireUser } from "./helpers";
import { weekScore } from "./challenges";

/** A team's shared goal: everyone together reaching the weekly active-minutes guideline. */
export const TEAM_MAX = 200;
/** Teams one person can be in at once. */
const TEAMS_PER_PERSON = 5;
const CODE = /^[a-z2-9]{8}$/;
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const kind = v.union(v.literal("company"), v.literal("gym"), v.literal("club"));

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}
async function uniqueCode(ctx: MutationCtx) {
  for (;;) {
    const code = newCode();
    if (!(await ctx.db.query("teams").withIndex("by_code", (q) => q.eq("code", code)).unique())) return code;
  }
}

const membership = (ctx: QueryCtx, teamId: Id<"teams">, userId: Id<"users">) =>
  ctx.db.query("teamMembers").withIndex("by_team_user", (q) => q.eq("teamId", teamId).eq("userId", userId)).unique();

async function myTeamCount(ctx: QueryCtx, userId: Id<"users">) {
  return (await ctx.db.query("teamMembers").withIndex("by_user", (q) => q.eq("userId", userId)).take(TEAMS_PER_PERSON + 1)).length;
}

function cleanName(name: string) {
  const n = name.trim().replace(/\s+/g, " ");
  if (n.length < 2) throw new ConvexError("Give the team a name.");
  checkText(n, 60, "Team name");
  return n;
}

async function ownTeam(ctx: MutationCtx, teamId: Id<"teams">, userId: Id<"users">): Promise<Doc<"teams">> {
  const team = await ctx.db.get(teamId);
  if (!team || team.ownerId !== userId) throw new ConvexError("Only the person who created this team can do that.");
  return team;
}

/** Start a team. You're its first member and can share its code. */
export const create = mutation({
  args: { name: v.string(), kind },
  handler: async (ctx, { name, kind }) => {
    const userId = await requireUser(ctx);
    if (!(await getProfile(ctx, userId))) throw new ConvexError("Finish setting up your profile first.");
    if ((await myTeamCount(ctx, userId)) >= TEAMS_PER_PERSON) throw new ConvexError(`You can be in up to ${TEAMS_PER_PERSON} teams.`);
    const now = Date.now();
    const teamId = await ctx.db.insert("teams", { name: cleanName(name), kind, code: await uniqueCode(ctx), ownerId: userId, createdAt: now });
    await ctx.db.insert("teamMembers", { teamId, userId, joinedAt: now });
    return teamId;
  },
});

/** Join with a team's code. */
export const join = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await requireUser(ctx);
    if (!(await getProfile(ctx, userId))) throw new ConvexError("Finish setting up your profile first.");
    const c = code.trim().toLowerCase();
    const team = CODE.test(c) ? await ctx.db.query("teams").withIndex("by_code", (q) => q.eq("code", c)).unique() : null;
    if (!team) throw new ConvexError("That code doesn't match a team. Check it with whoever shared it.");
    if (await membership(ctx, team._id, userId)) return team._id;
    if ((await myTeamCount(ctx, userId)) >= TEAMS_PER_PERSON) throw new ConvexError(`You can be in up to ${TEAMS_PER_PERSON} teams.`);
    const members = await ctx.db.query("teamMembers").withIndex("by_team", (q) => q.eq("teamId", team._id)).take(TEAM_MAX + 1);
    if (members.length >= TEAM_MAX) throw new ConvexError(`This team is full (${TEAM_MAX} people).`);
    await ctx.db.insert("teamMembers", { teamId: team._id, userId, joinedAt: Date.now() });
    return team._id;
  },
});

/** Leave a team. If the owner leaves, the longest-standing member takes over; the last one out closes it. */
export const leave = mutation({
  args: { teamId: v.id("teams") },
  handler: async (ctx, { teamId }) => {
    const userId = await requireUser(ctx);
    const row = await membership(ctx, teamId, userId);
    if (!row) return;
    await ctx.db.delete(row._id);
    const team = await ctx.db.get(teamId);
    if (!team) return;
    const next = await ctx.db.query("teamMembers").withIndex("by_team", (q) => q.eq("teamId", teamId)).first();
    if (!next) await ctx.db.delete(teamId);
    else if (team.ownerId === userId) await ctx.db.patch(teamId, { ownerId: next.userId });
  },
});

/** Owner: remove someone from the team. */
export const removeMember = mutation({
  args: { teamId: v.id("teams"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    await ownTeam(ctx, args.teamId, me);
    if (args.userId === me) throw new ConvexError("To leave your own team, use Leave team.");
    const row = await membership(ctx, args.teamId, args.userId);
    if (row) await ctx.db.delete(row._id);
  },
});

/** Owner: rename the team. */
export const rename = mutation({
  args: { teamId: v.id("teams"), name: v.string() },
  handler: async (ctx, { teamId, name }) => {
    const me = await requireUser(ctx);
    await ownTeam(ctx, teamId, me);
    await ctx.db.patch(teamId, { name: cleanName(name) });
  },
});

/** Owner: make a new code so the old one stops working (e.g. it was posted somewhere public). */
export const newTeamCode = mutation({
  args: { teamId: v.id("teams") },
  handler: async (ctx, { teamId }) => {
    const me = await requireUser(ctx);
    await ownTeam(ctx, teamId, me);
    await ctx.db.patch(teamId, { code: await uniqueCode(ctx) });
  },
});

/** Your teams, with this week's team total. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const rows = await ctx.db.query("teamMembers").withIndex("by_user", (q) => q.eq("userId", me)).take(TEAMS_PER_PERSON);
    const teams = await Promise.all(rows.map(async (r) => {
      const team = await ctx.db.get(r.teamId);
      if (!team) return null;
      const members = await ctx.db.query("teamMembers").withIndex("by_team", (q) => q.eq("teamId", team._id)).take(TEAM_MAX);
      return { id: team._id, name: team.name, kind: team.kind, members: members.length, owner: team.ownerId === me };
    }));
    return teams.filter((t) => t !== null);
  },
});

/** A team's weekly leaderboard and shared goal. Members only. */
export const board = query({
  args: { teamId: v.id("teams"), weekStart: v.string(), today: v.string() },
  handler: async (ctx, { teamId, weekStart, today }) => {
    const me = await requireUser(ctx);
    checkDate(weekStart);
    checkDate(today);
    const team = await ctx.db.get(teamId);
    if (!team || !(await membership(ctx, teamId, me))) return null;
    const members = await ctx.db.query("teamMembers").withIndex("by_team", (q) => q.eq("teamId", teamId)).take(TEAM_MAX);
    const rows = await Promise.all(members.map(async (m) => {
      const [profile, score] = await Promise.all([getProfile(ctx, m.userId), weekScore(ctx, m.userId, weekStart, today)]);
      return {
        userId: m.userId,
        me: m.userId === me,
        name: profile?.name.split(" ")[0] ?? "Member",
        username: profile?.username ?? null,
        points: score.points,
        daysLogged: score.daysLogged,
        activeMinutes: score.activeMinutes,
      };
    }));
    rows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
    const activeMinutes = rows.reduce((t, r) => t + r.activeMinutes, 0);
    return {
      id: team._id,
      name: team.name,
      kind: team.kind,
      owner: team.ownerId === me,
      // Only the owner sees the code (to share it); members can ask them.
      code: team.ownerId === me ? team.code : null,
      totalPoints: rows.reduce((t, r) => t + r.points, 0),
      averagePoints: rows.length ? Math.round(rows.reduce((t, r) => t + r.points, 0) / rows.length) : 0,
      activeMinutes,
      activeGoal: ACTIVE_GOAL * rows.length,
      rows,
    };
  },
});

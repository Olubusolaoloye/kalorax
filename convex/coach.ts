// Kalorax Coach: an AI chat that sees the member's own logs and suggests meals, logs and plans.
// The model runs in coachAgent.ts (Node action); this file holds the thread, the daily limit,
// one-tap actions and the context the model reads. The coach never changes data by itself:
// it proposes actions, and the member applies each one with a tap.
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { checkText, getProfile, hasAccess, isAdmin, requireAdmin, requireUser } from "./helpers";
import { activeTarget, lagosToday } from "./interventions";
import { foodById, nutrientsFor } from "../src/data/foods";
import { recipeById } from "../src/data/recipes";
import { consumerDailyTarget } from "../src/lib/nutrition";

/** Replies per member per Lagos day (admins aren't limited, for testing). */
export const DAILY_LIMIT = 15;
const HISTORY = 16;
const MAX_TEXT = 1000;

const dayStart = (day: string) => Date.parse(`${day}T00:00:00+01:00`);
const coachOn = () => !!process.env.ANTHROPIC_API_KEY;

async function settingsOf(ctx: QueryCtx, userId: Id<"users">) {
  return ctx.db.query("settings").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
}

/** Replies used today (failed ones don't count). */
async function usedToday(ctx: QueryCtx, userId: Id<"users">) {
  const rows = await ctx.db
    .query("coachMessages")
    .withIndex("by_user", (q) => q.eq("userId", userId).gte("createdAt", dayStart(lagosToday())))
    .collect();
  return rows.filter((m) => m.role === "assistant" && m.status !== "error").length;
}

/** The member's coach chat (latest 60 messages), whether it's switched on, consent and today's allowance. */
export const thread = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId || !(await hasAccess(ctx, userId))) return null;
    const [settings, admin, rows] = await Promise.all([
      settingsOf(ctx, userId),
      isAdmin(ctx, userId),
      ctx.db.query("coachMessages").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").take(60),
    ]);
    const used = await usedToday(ctx, userId);
    return {
      enabled: coachOn(),
      consented: !!settings?.coachConsentAt,
      limit: admin ? null : DAILY_LIMIT,
      remaining: admin ? null : Math.max(0, DAILY_LIMIT - used),
      messages: rows.reverse().map((m) => ({
        id: m._id,
        role: m.role,
        text: m.text,
        status: m.status,
        actions: m.actions ?? [],
        createdAt: new Date(m.createdAt).toISOString(),
      })),
    };
  },
});

/** The member agrees that the coach may read their logs (sent to Anthropic to generate replies). */
export const consent = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const row = await settingsOf(ctx, userId);
    if (row) await ctx.db.patch(row._id, { coachConsentAt: Date.now() });
    else await ctx.db.insert("settings", { userId, coachConsentAt: Date.now() });
  },
});

/** Ask the coach something. The reply streams into a new assistant message. */
export const send = mutation({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const userId = await requireUser(ctx);
    if (!coachOn()) throw new ConvexError("The AI coach isn't switched on yet.");
    if (!(await settingsOf(ctx, userId))?.coachConsentAt) throw new ConvexError("Please agree to share your logs with the coach first.");
    if (!(await getProfile(ctx, userId))) throw new ConvexError("Finish setting up your profile first.");
    const clean = text.trim();
    if (!clean) throw new ConvexError("Type a message first.");
    checkText(clean, MAX_TEXT, "Message");
    const last = await ctx.db.query("coachMessages").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").first();
    if (last?.status === "streaming") throw new ConvexError("The coach is still replying. Give it a moment.");
    if (!(await isAdmin(ctx, userId)) && (await usedToday(ctx, userId)) >= DAILY_LIMIT)
      throw new ConvexError(`You've used today's ${DAILY_LIMIT} coach messages. They reset at midnight.`);

    const now = Date.now();
    await ctx.db.insert("coachMessages", { userId, role: "user", text: clean, status: "done", createdAt: now });
    const replyId = await ctx.db.insert("coachMessages", { userId, role: "assistant", text: "", status: "streaming", createdAt: now + 1 });
    await ctx.scheduler.runAfter(0, internal.coachAgent.respond, { userId, replyId });
  },
});

type Action = NonNullable<Doc<"coachMessages">["actions"]>[number];

async function ownedAction(ctx: QueryCtx, userId: Id<"users">, messageId: Id<"coachMessages">, actionId: string) {
  const m = await ctx.db.get(messageId);
  if (!m || m.userId !== userId || m.role !== "assistant") throw new ConvexError("Not found.");
  const action = m.actions?.find((a) => a.id === actionId);
  if (!action) throw new ConvexError("Not found.");
  return { m, action };
}

/** One tap: add the suggested food to the diary, or the suggested dish to the meal plan. */
export const applyAction = mutation({
  args: { messageId: v.id("coachMessages"), actionId: v.string() },
  handler: async (ctx, { messageId, actionId }) => {
    const userId = await requireUser(ctx);
    const { m, action } = await ownedAction(ctx, userId, messageId, actionId);
    if (action.state !== "pending") return action.state;
    if (action.kind === "log_food") {
      // Re-checked here: the action came from the model.
      if (!action.foodId || !foodById(action.foodId) || !action.grams || action.grams < 1 || action.grams > 5000) throw new ConvexError("That suggestion is no longer valid.");
      await ctx.db.insert("diary", {
        userId, date: action.date, meal: action.meal, foodId: action.foodId, grams: action.grams,
        portionLabel: (action.portionLabel ?? `${action.grams} g`).slice(0, 60), loggedAt: new Date().toISOString(),
      });
    } else {
      if (!action.recipeId || !recipeById(action.recipeId)) throw new ConvexError("That suggestion is no longer valid.");
      const portion = action.portion && action.portion !== 1 ? action.portion : undefined;
      const slot = await ctx.db
        .query("plan")
        .withIndex("by_user_date_meal", (q) => q.eq("userId", userId).eq("date", action.date).eq("meal", action.meal))
        .unique();
      if (slot) await ctx.db.patch(slot._id, { recipeId: action.recipeId, portion });
      else await ctx.db.insert("plan", { userId, date: action.date, meal: action.meal, recipeId: action.recipeId, portion });
    }
    await ctx.db.patch(m._id, { actions: m.actions!.map((a) => (a.id === actionId ? { ...a, state: "done" as const } : a)) });
    return "done";
  },
});

export const dismissAction = mutation({
  args: { messageId: v.id("coachMessages"), actionId: v.string() },
  handler: async (ctx, { messageId, actionId }) => {
    const userId = await requireUser(ctx);
    const { m, action } = await ownedAction(ctx, userId, messageId, actionId);
    if (action.state !== "pending") return;
    await ctx.db.patch(m._id, { actions: m.actions!.map((a) => (a.id === actionId ? { ...a, state: "dismissed" as const } : a)) });
  },
});

/** Start over: deletes the member's coach chat (not their logs). */
export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    for (const m of await ctx.db.query("coachMessages").withIndex("by_user", (q) => q.eq("userId", userId)).collect()) {
      if (m.status !== "streaming") await ctx.db.delete(m._id);
    }
  },
});

/* ---------- Used by the model (internal) ---------- */

const ageFrom = (birthDate: string, today: string) => {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
};
const shift = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** What the coach knows about the member right now: profile, target, today, the last 7 days, and the chat so far. */
export const context = internalQuery({
  args: { userId: v.id("users"), replyId: v.id("coachMessages") },
  handler: async (ctx, { userId, replyId }) => {
    const today = lagosToday();
    const weekAgo = shift(today, -6);
    const [profile, weights, diary, water, plan, settings, target, history] = await Promise.all([
      getProfile(ctx, userId),
      ctx.db.query("weights").withIndex("by_user_date", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("diary").withIndex("by_user_date", (q) => q.eq("userId", userId).gte("date", weekAgo).lte("date", today)).collect(),
      ctx.db.query("water").withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today)).unique(),
      ctx.db.query("plan").withIndex("by_user_date_meal", (q) => q.eq("userId", userId).gte("date", today).lte("date", shift(today, 6))).collect(),
      settingsOf(ctx, userId),
      activeTarget(ctx, userId),
      ctx.db.query("coachMessages").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").take(HISTORY + 1),
    ]);
    if (!profile) return null;
    const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
    const weightKg = sorted.at(-1)?.weightKg ?? null;
    const ageYears = ageFrom(profile.birthDate, today);
    const auto = weightKg
      ? consumerDailyTarget({ sex: profile.sex, ageYears, weightKg, heightCm: profile.heightCm, activity: profile.activity, goal: profile.goal, conditions: profile.conditions })
      : null;
    const kcalOf = (d: Doc<"diary">) => {
      const f = foodById(d.foodId);
      return f ? nutrientsFor(f, d.grams) : null;
    };
    const days: Record<string, number> = {};
    for (const d of diary) days[d.date] = (days[d.date] ?? 0) + (kcalOf(d)?.kcal ?? 0);
    const todayEntries = diary.filter((d) => d.date === today).map((d) => {
      const n = kcalOf(d);
      return { meal: d.meal, food: foodById(d.foodId)?.name ?? d.foodId, portion: d.portionLabel, kcal: Math.round(n?.kcal ?? 0), protein: Math.round(n?.protein ?? 0) };
    });
    return {
      today,
      member: {
        name: profile.name.split(" ")[0],
        role: profile.role,
        sex: profile.sex,
        ageYears,
        heightCm: profile.heightCm,
        weightKg,
        firstWeightKg: sorted[0]?.weightKg ?? null,
        goal: profile.goal,
        activity: profile.activity,
        conditions: profile.conditions,
      },
      target: target
        ? { kind: "dietitian", kcal: target.kcal }
        : auto?.kind === "target"
          ? { kind: "automatic", kcal: Math.round(auto.kcal) }
          : { kind: "needs_dietitian", reason: auto?.kind === "needs_dietitian" ? auto.reason : "no_weight" },
      todayEntries,
      todayKcal: Math.round(days[today] ?? 0),
      waterMlToday: water?.ml ?? 0,
      last7Days: Object.entries(days).sort().map(([date, kcal]) => ({ date, kcal: Math.round(kcal) })),
      planNext7Days: plan.sort((a, b) => (a.date + a.meal).localeCompare(b.date + b.meal)).map((p) => ({ date: p.date, meal: p.meal, dish: recipeById(p.recipeId)?.name ?? p.recipeId })),
      prefs: settings?.planPrefs ?? null,
      // The chat so far, oldest first, without the reply being written now.
      history: history.filter((m) => m._id !== replyId && m.status === "done" && m.text).reverse().map((m) => ({ role: m.role, text: m.text })),
    };
  },
});

/** The reply so far, while it streams. */
export const updateReply = internalMutation({
  args: { replyId: v.id("coachMessages"), text: v.string() },
  handler: async (ctx, { replyId, text }) => {
    const m = await ctx.db.get(replyId);
    if (m?.status === "streaming") await ctx.db.patch(replyId, { text });
  },
});

const action = v.object({
  id: v.string(), kind: v.union(v.literal("log_food"), v.literal("plan_meal")), label: v.string(), date: v.string(),
  meal: v.union(v.literal("Breakfast"), v.literal("Lunch"), v.literal("Dinner"), v.literal("Snacks")), kcal: v.number(),
  foodId: v.optional(v.string()), grams: v.optional(v.number()), portionLabel: v.optional(v.string()),
  recipeId: v.optional(v.string()), portion: v.optional(v.number()),
  state: v.union(v.literal("pending"), v.literal("done"), v.literal("dismissed")),
});

/** The finished reply, its one-tap actions, and the day's usage totals (tokens and cost, no content). */
export const finishReply = internalMutation({
  args: {
    replyId: v.id("coachMessages"),
    text: v.string(),
    status: v.union(v.literal("done"), v.literal("error")),
    actions: v.array(action),
    usage: v.object({ inputTokens: v.number(), outputTokens: v.number(), costUsd: v.number() }),
  },
  handler: async (ctx, { replyId, text, status, actions, usage }) => {
    const m = await ctx.db.get(replyId);
    if (!m) return;
    await ctx.db.patch(replyId, { text, status, actions: actions.length ? (actions as Action[]) : undefined });
    const day = lagosToday();
    const row = await ctx.db.query("coachDaily").withIndex("by_day", (q) => q.eq("day", day)).unique();
    const add = { replies: status === "done" ? 1 : 0, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, costUsd: usage.costUsd };
    if (row) {
      await ctx.db.patch(row._id, {
        replies: row.replies + add.replies, inputTokens: row.inputTokens + add.inputTokens,
        outputTokens: row.outputTokens + add.outputTokens, costUsd: row.costUsd + add.costUsd,
      });
    } else await ctx.db.insert("coachDaily", { day, ...add });
  },
});

/** Admin: coach usage and cost, today and over the last 30 days. No message content. */
export const adminStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const today = lagosToday();
    const rows = await ctx.db.query("coachDaily").withIndex("by_day", (q) => q.gte("day", shift(today, -29))).collect();
    const sum = (rs: typeof rows) => rs.reduce((t, r) => ({ replies: t.replies + r.replies, costUsd: t.costUsd + r.costUsd }), { replies: 0, costUsd: 0 });
    return {
      enabled: coachOn(),
      dailyLimit: DAILY_LIMIT,
      today: sum(rows.filter((r) => r.day === today)),
      last30: sum(rows),
    };
  },
});

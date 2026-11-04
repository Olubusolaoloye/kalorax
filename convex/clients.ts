// Dietitian client tools. A dietitian only sees a member's logs through an active, paid enrolment
// that the member consented to; nothing here is reachable by anyone else.
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { checkDate, checkRange, checkText, getProfile, logAdminAction, requireAdmin } from "./helpers";
import { confirmEnd, dietitianCard, enrolmentFor, lagosToday, requireDietitian, sideRows, threadFor } from "./interventions";
import { dietitianTarget, meal } from "./validators";
import { LANGUAGES, programmeById } from "../src/data/programmes";
import { recipeById } from "../src/data/recipes";
import { adherence, priceError, programmeWeek, targetError, type ClientSummary } from "../src/lib/interventions";
import { shiftDate } from "../src/lib/dates";

/* ---------- Practice: profile, offerings, earnings ---------- */

async function earningsFor(ctx: QueryCtx, dietitianId: Id<"users">) {
  const [enrolments, payouts] = await Promise.all([
    ctx.db.query("enrolments").withIndex("by_dietitian", (q) => q.eq("dietitianId", dietitianId)).collect(),
    ctx.db.query("payouts").withIndex("by_dietitian", (q) => q.eq("dietitianId", dietitianId)).collect(),
  ]);
  const paid = enrolments.filter((e) => (e.status === "active" || e.status === "completed") && !e.demoPayment);
  const gross = paid.reduce((t, e) => t + e.priceNaira, 0);
  const fee = paid.reduce((t, e) => t + e.feeNaira, 0);
  const paidOut = payouts.reduce((t, p) => t + p.amountNaira, 0);
  return {
    grossNaira: gross,
    feeNaira: fee,
    netNaira: gross - fee,
    paidOutNaira: paidOut,
    balanceNaira: gross - fee - paidOut,
    activeClients: enrolments.filter((e) => e.status === "active").length,
  };
}

export const myPractice = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireDietitian(ctx);
    const [dp, offerings] = await Promise.all([
      ctx.db.query("dietitianProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique(),
      ctx.db.query("offerings").withIndex("by_dietitian", (q) => q.eq("dietitianId", userId)).collect(),
    ]);
    return {
      card: await dietitianCard(ctx, userId),
      payout: dp?.payout ?? null,
      offerings: offerings.map((o) => ({ id: o._id as string, programmeId: o.programmeId, priceNaira: o.priceNaira, active: o.active })),
      earnings: await earningsFor(ctx, userId),
    };
  },
});

export const saveProfile = mutation({
  args: {
    bio: v.string(),
    languages: v.array(v.string()),
    yearsExperience: v.number(),
    payout: v.optional(v.object({ bankName: v.string(), accountNumber: v.string(), accountName: v.string() })),
  },
  handler: async (ctx, args) => {
    const userId = await requireDietitian(ctx);
    checkText(args.bio, 600, "Bio");
    checkRange(args.yearsExperience, 0, 60, "Years of experience");
    if (args.languages.some((l) => !LANGUAGES.includes(l))) throw new ConvexError("Unknown language.");
    if (args.payout) {
      if (!/^\d{10}$/.test(args.payout.accountNumber)) throw new ConvexError("Account number must be 10 digits (NUBAN).");
      checkText(args.payout.bankName, 80, "Bank");
      checkText(args.payout.accountName, 120, "Account name");
    }
    const row = await ctx.db.query("dietitianProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
    if (row) await ctx.db.patch(row._id, args);
    else await ctx.db.insert("dietitianProfiles", { userId, ...args });
  },
});

export const saveOffering = mutation({
  args: { programmeId: v.string(), priceNaira: v.number(), active: v.boolean() },
  handler: async (ctx, { programmeId, priceNaira, active }) => {
    const userId = await requireDietitian(ctx);
    const err = priceError(programmeId, priceNaira);
    if (err) throw new ConvexError(err);
    const mine = await ctx.db.query("offerings").withIndex("by_dietitian", (q) => q.eq("dietitianId", userId)).collect();
    const row = mine.find((o) => o.programmeId === programmeId);
    if (active) {
      const dp = await ctx.db.query("dietitianProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
      if (!dp?.bio.trim()) throw new ConvexError("Add a short bio before you start offering programmes.");
    }
    // Price changes apply to new enrolments only; existing ones keep the price they paid.
    if (row) await ctx.db.patch(row._id, { priceNaira, active });
    else await ctx.db.insert("offerings", { dietitianId: userId, programmeId, priceNaira, active });
  },
});

/* ---------- Clients ---------- */

async function summaryFor(ctx: QueryCtx, e: Doc<"enrolments">): Promise<ClientSummary> {
  const today = lagosToday();
  const [profile, diary, weights, unread] = await Promise.all([
    getProfile(ctx, e.memberId),
    ctx.db.query("diary").withIndex("by_user_date", (q) => q.eq("userId", e.memberId).gte("date", shiftDate(today, -30))).collect(),
    ctx.db.query("weights").withIndex("by_user_date", (q) => q.eq("userId", e.memberId)).collect(),
    // Only messages after the dietitian last read the chat, not the whole history.
    ctx.db.query("messages").withIndex("by_enrolment_sent", (q) => q.eq("enrolmentId", e._id).gt("sentAt", e.dietitianReadAt ?? 0)).collect(),
  ]);
  const sorted = weights.sort((a, b) => a.date.localeCompare(b.date));
  const atStart = [...sorted].reverse().find((w) => !e.startDate || w.date <= e.startDate) ?? sorted[0];
  const latest = sorted.at(-1);
  const active = e.status === "active";
  const a = active ? adherence(diary.map((d) => d.date), today) : { daysLogged7: 0, lastLogDate: null };
  return {
    enrolmentId: e._id,
    name: e.memberDeleted ? "Deleted member" : profile?.name ?? "Member",
    programmeId: e.programmeId,
    status: e.status,
    startDate: e.startDate,
    ...a,
    latestWeightKg: active ? latest?.weightKg ?? null : null,
    weightChangeKg: active && latest && atStart ? Math.round((latest.weightKg - atStart.weightKg) * 10) / 10 : null,
    unread: unread.filter((m) => m.senderId === e.memberId).length,
  };
}

export const myClients = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireDietitian(ctx);
    const rows = (await ctx.db.query("enrolments").withIndex("by_dietitian", (q) => q.eq("dietitianId", userId)).collect()).filter(
      (e) => e.status === "active" || e.status === "completed",
    );
    return Promise.all(rows.map((e) => summaryFor(ctx, e)));
  },
});

/** Everything about one client. Health logs are only included while the programme is active. */
export const clientDetail = query({
  args: { enrolmentId: v.id("enrolments") },
  handler: async (ctx, { enrolmentId }) => {
    const userId = await requireDietitian(ctx);
    const e = await enrolmentFor(ctx, enrolmentId, userId, "dietitian");
    if (e.status !== "active" && e.status !== "completed") throw new ConvexError("Not found.");
    const profile = await getProfile(ctx, e.memberId);
    const active = e.status === "active" && e.intake.consent && !!profile;
    const from = shiftDate(lagosToday(), -27);
    const m = e.memberId;
    const [diary, water, notes, weights] = active
      ? await Promise.all([
          ctx.db.query("diary").withIndex("by_user_date", (q) => q.eq("userId", m).gte("date", from)).collect(),
          ctx.db.query("water").withIndex("by_user_date", (q) => q.eq("userId", m).gte("date", from)).collect(),
          ctx.db.query("notes").withIndex("by_user_date_slot", (q) => q.eq("userId", m).gte("date", from)).collect(),
          ctx.db.query("weights").withIndex("by_user_date", (q) => q.eq("userId", m)).collect(),
        ])
      : [[], [], [], []];
    return {
      ...(await summaryFor(ctx, e)),
      sex: profile?.sex ?? "female",
      birthDate: profile?.birthDate ?? "2000-01-01",
      heightCm: profile?.heightCm ?? 0,
      activity: profile?.activity ?? "light",
      goal: profile?.goal ?? "eat_healthier",
      conditions: profile?.conditions ?? [],
      intake: e.intake,
      weights: weights.map((w) => ({ date: w.date, weightKg: w.weightKg })).sort((a, b) => a.date.localeCompare(b.date)),
      diary: diary.map(({ date, meal, foodId, grams, portionLabel }) => ({ date, meal, foodId, grams, portionLabel })),
      water: Object.fromEntries(water.map((w) => [w.date, w.ml])),
      notes: notes.map(({ date, slot, feeling, tags, text }) => ({ date, slot, feeling, tags, text })),
      target: e.target,
      planWeekStart: e.planWeekStart,
      ...(await sideRows(ctx, e._id)),
      messages: await threadFor(ctx, e._id, userId),
    };
  },
});

async function activeEnrolment(ctx: Parameters<typeof enrolmentFor>[0], enrolmentId: Id<"enrolments">) {
  const userId = await requireDietitian(ctx);
  const e = await enrolmentFor(ctx, enrolmentId, userId, "dietitian");
  if (e.status !== "active") throw new ConvexError("This programme isn't active.");
  return { userId, e };
}

export const setTarget = mutation({
  args: { enrolmentId: v.id("enrolments"), target: dietitianTarget },
  handler: async (ctx, { enrolmentId, target }) => {
    const { e } = await activeEnrolment(ctx, enrolmentId);
    const err = targetError(target);
    if (err) throw new ConvexError(err);
    checkText(target.note ?? "", 300, "Note");
    await ctx.db.patch(e._id, { target: { ...target, kcal: Math.round(target.kcal), setAt: new Date().toISOString() } });
  },
});

/** Write a week of meals into the client's own meal plan. */
export const sendPlan = mutation({
  args: {
    enrolmentId: v.id("enrolments"),
    weekStart: v.string(),
    items: v.array(v.object({ date: v.string(), meal, recipeId: v.string(), portion: v.optional(v.number()) })),
  },
  handler: async (ctx, { enrolmentId, weekStart, items }) => {
    const { e } = await activeEnrolment(ctx, enrolmentId);
    checkDate(weekStart);
    if (items.length === 0 || items.length > 28) throw new ConvexError("A plan has 1 to 28 meals.");
    const week = new Set(Array.from({ length: 7 }, (_, i) => shiftDate(weekStart, i)));
    for (const it of items) {
      if (!week.has(it.date)) throw new ConvexError("Every meal must be in the chosen week.");
      if (!recipeById(it.recipeId)) throw new ConvexError("Unknown recipe.");
      if (it.portion !== undefined) checkRange(it.portion, 0.25, 4, "Portion");
      const row = await ctx.db
        .query("plan")
        .withIndex("by_user_date_meal", (q) => q.eq("userId", e.memberId).eq("date", it.date).eq("meal", it.meal))
        .unique();
      const value = { recipeId: it.recipeId, portion: it.portion };
      if (row) await ctx.db.patch(row._id, value);
      else await ctx.db.insert("plan", { userId: e.memberId, date: it.date, meal: it.meal, ...value });
    }
    await ctx.db.patch(e._id, { planWeekStart: weekStart });
  },
});

export const addAdjunct = mutation({
  args: { enrolmentId: v.id("enrolments"), name: v.string(), dose: v.string(), timing: v.string(), reason: v.string() },
  handler: async (ctx, { enrolmentId, ...a }) => {
    const { userId, e } = await activeEnrolment(ctx, enrolmentId);
    if (!a.name.trim()) throw new ConvexError("Name the supplement or adjunct.");
    for (const [k, val] of Object.entries(a)) checkText(val, k === "reason" ? 400 : 120, k);
    const count = (await ctx.db.query("adjuncts").withIndex("by_enrolment", (q) => q.eq("enrolmentId", e._id)).collect()).length;
    if (count >= 20) throw new ConvexError("Too many items.");
    await ctx.db.insert("adjuncts", { enrolmentId: e._id, ...a, name: a.name.trim(), approvedBy: userId, approvedAt: Date.now() });
  },
});

export const removeAdjunct = mutation({
  args: { id: v.id("adjuncts") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row) throw new ConvexError("Not found.");
    await activeEnrolment(ctx, row.enrolmentId);
    await ctx.db.delete(id);
  },
});

export const addCheckIn = mutation({
  args: { enrolmentId: v.id("enrolments"), summary: v.string(), nextSteps: v.string(), weightKg: v.optional(v.number()) },
  handler: async (ctx, { enrolmentId, summary, nextSteps, weightKg }) => {
    const { e } = await activeEnrolment(ctx, enrolmentId);
    if (!summary.trim()) throw new ConvexError("Write a short summary.");
    checkText(summary, 1500, "Summary");
    checkText(nextSteps, 1500, "Next steps");
    if (weightKg !== undefined) checkRange(weightKg, 20, 350, "Weight (kg)");
    const weeks = programmeById(e.programmeId)?.weeks ?? 1;
    const week = programmeWeek(e.startDate, lagosToday(), weeks) ?? 1;
    await ctx.db.insert("checkIns", { enrolmentId: e._id, week, summary: summary.trim(), nextSteps: nextSteps.trim(), weightKg, createdAt: Date.now() });
  },
});

/** The dietitian's side of ending a programme; it completes once the member confirms too. */
export const completeEnrolment = mutation({
  args: { enrolmentId: v.id("enrolments") },
  handler: async (ctx, { enrolmentId }) => {
    const { userId, e } = await activeEnrolment(ctx, enrolmentId);
    return confirmEnd(ctx, e, userId, true);
  },
});

/* ---------- Admin: dietitian payouts ---------- */

export const payoutsOverview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const dietitians = new Set((await ctx.db.query("enrolments").collect()).map((e) => e.dietitianId));
    const out = [];
    for (const id of dietitians) {
      const [card, earnings, dp] = await Promise.all([
        dietitianCard(ctx, id),
        earningsFor(ctx, id),
        ctx.db.query("dietitianProfiles").withIndex("by_user", (q) => q.eq("userId", id)).unique(),
      ]);
      out.push({ dietitianId: id, name: card.name, payout: dp?.payout ?? null, ...earnings });
    }
    return out.sort((a, b) => b.balanceNaira - a.balanceNaira);
  },
});

export const recordPayout = mutation({
  args: { dietitianId: v.id("users"), amountNaira: v.number(), reference: v.string() },
  handler: async (ctx, { dietitianId, amountNaira, reference }) => {
    const adminId = await requireAdmin(ctx);
    const { balanceNaira } = await earningsFor(ctx, dietitianId);
    if (!Number.isInteger(amountNaira) || amountNaira <= 0 || amountNaira > balanceNaira) throw new ConvexError("Amount must be a whole number up to the balance owed.");
    if (!reference.trim()) throw new ConvexError("Add the bank transfer reference.");
    checkText(reference, 100, "Reference");
    await ctx.db.insert("payouts", { dietitianId, amountNaira, reference: reference.trim(), paidAt: Date.now(), recordedBy: adminId });
    const name = (await getProfile(ctx, dietitianId))?.name ?? "A dietitian";
    await logAdminAction(ctx, adminId, "payout_recorded", dietitianId, `₦${amountNaira.toLocaleString("en-NG")} to ${name} · ref ${reference.trim()}`);
  },
});


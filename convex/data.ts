import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { checkDate, checkRange, checkText, getProfile, ownRow, requireUser } from "./helpers";
import { diaryFields, eventFields, exerciseFields, isoDate, meal, noteFields, noteSlot } from "./validators";
import { deleteConversationsOf } from "./social";
import { take } from "./rateLimit";

export const addDiaryEntries = mutation({
  args: { entries: v.array(v.object(diaryFields)) },
  handler: async (ctx, { entries }) => {
    const userId = await requireUser(ctx);
    if (entries.length > 20) throw new ConvexError("Too many items at once.");
    await take(ctx, "diaryEntriesPerUser", userId, entries.length);
    for (const e of entries) {
      checkDate(e.date);
      checkRange(e.grams, 1, 5000, "Portion (g)");
      checkText(e.portionLabel, 60, "Portion label");
      await ctx.db.insert("diary", { ...e, userId, loggedAt: e.loggedAt ?? new Date().toISOString() });
    }
  },
});

export const removeDiaryEntry = mutation({
  args: { id: v.id("diary") },
  handler: async (ctx, { id }) => {
    const userId = await requireUser(ctx);
    await ownRow(ctx, "diary", id, userId);
    await ctx.db.delete(id);
  },
});

export const addWater = mutation({
  args: { date: isoDate, ml: v.number() },
  handler: async (ctx, { date, ml }) => {
    const userId = await requireUser(ctx);
    checkDate(date);
    checkRange(ml, -5000, 5000, "Water (ml)");
    const row = await ctx.db
      .query("water")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
      .unique();
    const total = Math.min(20000, Math.max(0, (row?.ml ?? 0) + ml));
    if (row) await ctx.db.patch(row._id, { ml: total });
    else await ctx.db.insert("water", { userId, date, ml: total });
  },
});

export const logWeight = mutation({
  args: { date: isoDate, weightKg: v.number() },
  handler: async (ctx, { date, weightKg }) => {
    const userId = await requireUser(ctx);
    checkDate(date);
    checkRange(weightKg, 20, 350, "Weight (kg)");
    const row = await ctx.db
      .query("weights")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
      .unique();
    if (row) await ctx.db.patch(row._id, { weightKg });
    else await ctx.db.insert("weights", { userId, date, weightKg });
  },
});

export const setNote = mutation({
  args: { date: isoDate, slot: noteSlot, note: v.union(v.object(noteFields), v.null()) },
  handler: async (ctx, { date, slot, note }) => {
    const userId = await requireUser(ctx);
    checkDate(date);
    const row = await ctx.db
      .query("notes")
      .withIndex("by_user_date_slot", (q) => q.eq("userId", userId).eq("date", date).eq("slot", slot))
      .unique();
    if (!note) {
      if (row) await ctx.db.delete(row._id);
      return;
    }
    checkText(note.text, 500, "Note");
    if (note.tags.length > 12) throw new ConvexError("Too many tags.");
    if (note.feeling !== undefined) checkRange(note.feeling, 1, 5, "Feeling");
    const value = { ...note, updatedAt: new Date().toISOString() };
    if (row) await ctx.db.replace(row._id, { userId, date, slot, ...value });
    else await ctx.db.insert("notes", { userId, date, slot, ...value });
  },
});

const checkPortion = (portion: number | undefined) => {
  if (portion !== undefined) checkRange(portion, 0.25, 4, "Portion");
};

export const setPlanSlot = mutation({
  args: { date: isoDate, meal, recipeId: v.union(v.string(), v.null()), portion: v.optional(v.number()) },
  handler: async (ctx, { date, meal, recipeId, portion }) => {
    const userId = await requireUser(ctx);
    checkDate(date);
    checkPortion(portion);
    const row = await ctx.db
      .query("plan")
      .withIndex("by_user_date_meal", (q) => q.eq("userId", userId).eq("date", date).eq("meal", meal))
      .unique();
    if (!recipeId) {
      if (row) await ctx.db.delete(row._id);
    } else if (row) await ctx.db.patch(row._id, { recipeId, portion });
    else await ctx.db.insert("plan", { userId, date, meal, recipeId, portion });
  },
});

export const replacePlan = mutation({
  args: { items: v.array(v.object({ date: isoDate, meal, recipeId: v.string(), portion: v.optional(v.number()) })) },
  handler: async (ctx, { items }) => {
    const userId = await requireUser(ctx);
    if (items.length > 60) throw new ConvexError("Too many plan items.");
    for (const it of items) {
      checkDate(it.date);
      checkPortion(it.portion);
      const row = await ctx.db
        .query("plan")
        .withIndex("by_user_date_meal", (q) => q.eq("userId", userId).eq("date", it.date).eq("meal", it.meal))
        .unique();
      if (row) await ctx.db.patch(row._id, { recipeId: it.recipeId, portion: it.portion });
      else await ctx.db.insert("plan", { userId, ...it });
    }
  },
});

export const updateGrocery = mutation({
  args: {
    people: v.optional(v.number()),
    purchased: v.optional(v.record(v.string(), v.boolean())),
    qtyOverride: v.optional(v.record(v.string(), v.number())),
  },
  handler: async (ctx, patch) => {
    const userId = await requireUser(ctx);
    if (patch.people !== undefined) checkRange(patch.people, 1, 12, "People");
    const row = await ctx.db.query("grocery").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
    const clean = Object.fromEntries(Object.entries(patch).filter(([, val]) => val !== undefined));
    if (row) await ctx.db.patch(row._id, clean);
    else await ctx.db.insert("grocery", { userId, people: 1, purchased: {}, qtyOverride: {}, ...clean });
  },
});

export const addEvent = mutation({
  args: eventFields,
  handler: async (ctx, e) => {
    const userId = await requireUser(ctx);
    checkDate(e.date);
    checkText(e.title, 120, "Title");
    checkText(e.location ?? "", 120, "Location");
    checkText(e.note ?? "", 500, "Note");
    await ctx.db.insert("events", { ...e, userId });
  },
});

export const removeEvent = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, { id }) => {
    const userId = await requireUser(ctx);
    await ownRow(ctx, "events", id, userId);
    await ctx.db.delete(id);
  },
});

export const addExercise = mutation({
  args: exerciseFields,
  handler: async (ctx, e) => {
    const userId = await requireUser(ctx);
    checkDate(e.date);
    checkRange(e.minutes, 1, 600, "Duration (min)");
    await ctx.db.insert("exercises", { ...e, userId });
  },
});

export const updateExercise = mutation({
  args: {
    id: v.id("exercises"),
    patch: v.object({
      minutes: v.optional(v.number()),
      sets: v.optional(v.number()),
      reps: v.optional(v.number()),
      status: v.optional(exerciseFields.status),
    }),
  },
  handler: async (ctx, { id, patch }) => {
    const userId = await requireUser(ctx);
    await ownRow(ctx, "exercises", id, userId);
    if (patch.minutes !== undefined) checkRange(patch.minutes, 1, 600, "Duration (min)");
    await ctx.db.patch(id, patch);
  },
});

export const removeExercise = mutation({
  args: { id: v.id("exercises") },
  handler: async (ctx, { id }) => {
    const userId = await requireUser(ctx);
    await ownRow(ctx, "exercises", id, userId);
    await ctx.db.delete(id);
  },
});

/**
 * Delete everything this user has stored (profile, logs, plans, verification files).
 * With deleteAccount, also remove the sign-in account itself.
 */
export const deleteMyData = mutation({
  args: { deleteAccount: v.optional(v.boolean()) },
  handler: async (ctx, { deleteAccount }) => {
    const userId = await requireUser(ctx);
    for (const table of ["diary", "water", "weights", "events", "exercises"] as const) {
      const rows = await ctx.db.query(table).withIndex("by_user_date", (q) => q.eq("userId", userId)).collect();
      for (const r of rows) await ctx.db.delete(r._id);
    }
    for (const r of await ctx.db.query("notes").withIndex("by_user_date_slot", (q) => q.eq("userId", userId)).collect()) await ctx.db.delete(r._id);
    for (const r of await ctx.db.query("plan").withIndex("by_user_date_meal", (q) => q.eq("userId", userId)).collect()) await ctx.db.delete(r._id);
    for (const table of ["grocery", "settings", "pushSubscriptions", "whatsapp"] as const) {
      for (const r of await ctx.db.query(table).withIndex("by_user", (q) => q.eq("userId", userId)).collect()) await ctx.db.delete(r._id);
    }
    for (const r of await ctx.db.query("reminderLog").withIndex("by_user_key", (q) => q.eq("userId", userId)).collect()) await ctx.db.delete(r._id);
    for (const r of await ctx.db.query("coachMessages").withIndex("by_user", (q) => q.eq("userId", userId)).collect()) {
      if (r.imageId) await ctx.storage.delete(r.imageId);
      await ctx.db.delete(r._id);
    }
    // Leave every team; a team they owned passes to the longest-standing member, or closes if they were the last.
    for (const m of await ctx.db.query("teamMembers").withIndex("by_user", (q) => q.eq("userId", userId)).collect()) {
      await ctx.db.delete(m._id);
      const team = await ctx.db.get(m.teamId);
      if (!team) continue;
      const next = await ctx.db.query("teamMembers").withIndex("by_team", (q) => q.eq("teamId", team._id)).first();
      if (!next) await ctx.db.delete(team._id);
      else if (team.ownerId === userId) await ctx.db.patch(team._id, { ownerId: next.userId });
    }
    for (const r of await ctx.db.query("verifications").withIndex("by_user", (q) => q.eq("userId", userId)).collect()) {
      if (r.documentId) await ctx.storage.delete(r.documentId);
      await ctx.db.delete(r._id);
    }
    // Programmes: messages, check-ins and supplements go; the enrolment stays as a payment record without health details.
    for (const e of await ctx.db.query("enrolments").withIndex("by_member", (q) => q.eq("memberId", userId)).collect()) {
      for (const table of ["messages", "checkIns", "adjuncts"] as const) {
        for (const r of await ctx.db.query(table).withIndex("by_enrolment", (q) => q.eq("enrolmentId", e._id)).collect()) await ctx.db.delete(r._id);
      }
      await ctx.db.patch(e._id, {
        memberDeleted: true,
        status: e.status === "pending_payment" ? "cancelled" : e.status === "active" ? "completed" : e.status,
        intake: { goals: "", conditions: [], medications: "", typicalDay: "", allergies: "", consent: false },
        target: undefined,
      });
    }
    // Member chats: the whole conversation goes, for both people.
    await deleteConversationsOf(ctx, userId);
    // A dietitian's own listing.
    for (const r of await ctx.db.query("offerings").withIndex("by_dietitian", (q) => q.eq("dietitianId", userId)).collect()) await ctx.db.patch(r._id, { active: false });
    for (const r of await ctx.db.query("dietitianProfiles").withIndex("by_user", (q) => q.eq("userId", userId)).collect()) await ctx.db.delete(r._id);

    const profile = await getProfile(ctx, userId);
    if (profile) await ctx.db.delete(profile._id);

    if (deleteAccount) {
      for (const s of await ctx.db.query("authSessions").withIndex("userId", (q) => q.eq("userId", userId)).collect()) {
        for (const t of await ctx.db.query("authRefreshTokens").withIndex("sessionId", (q) => q.eq("sessionId", s._id)).collect()) {
          await ctx.db.delete(t._id);
        }
        await ctx.db.delete(s._id);
      }
      for (const a of await ctx.db.query("authAccounts").withIndex("userIdAndProvider", (q) => q.eq("userId", userId)).collect()) {
        await ctx.db.delete(a._id);
      }
      await ctx.db.delete(userId);
    }
  },
});

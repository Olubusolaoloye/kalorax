// Paid interventions: the catalogue, enrolling, payment confirmation and the member's programme view.
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { scheduleMessageAlert } from "./alerts";
import { checkText, getProfile, requireUser } from "./helpers";
import { isBookable } from "./pro";
import { intake } from "./validators";
import { programmeById } from "../src/data/programmes";
import { intakeError, splitPayment, type DietitianCard, type ThreadMessage } from "../src/lib/interventions";
import { localParts } from "../src/lib/reminders";

type Ctx = QueryCtx | MutationCtx;

/** Today in Nigeria (the programme calendar runs on Lagos time). */
export const lagosToday = () => localParts(Date.now(), 60).date;

/** A dietitian who may take clients: verified, with the dietitian role. */
export async function isVerifiedDietitian(ctx: Ctx, userId: Id<"users">) {
  const p = await getProfile(ctx, userId);
  return !!p && p.role === "dietitian" && p.verification === "verified";
}

export async function requireDietitian(ctx: Ctx): Promise<Id<"users">> {
  const userId = await requireUser(ctx);
  if (!(await isVerifiedDietitian(ctx, userId))) throw new ConvexError("Only verified dietitians can do this.");
  return userId;
}

export async function dietitianCard(ctx: Ctx, dietitianId: Id<"users">): Promise<DietitianCard> {
  const [profile, dp, done] = await Promise.all([
    getProfile(ctx, dietitianId),
    ctx.db.query("dietitianProfiles").withIndex("by_user", (q) => q.eq("userId", dietitianId)).unique(),
    ctx.db.query("enrolments").withIndex("by_dietitian", (q) => q.eq("dietitianId", dietitianId)).collect(),
  ]);
  return {
    id: dietitianId,
    name: profile?.name ?? "Nutrintel dietitian",
    bio: dp?.bio ?? "",
    languages: dp?.languages ?? ["English"],
    yearsExperience: dp?.yearsExperience ?? 0,
    clientsHelped: done.filter((e) => e.status === "completed").length,
  };
}

/** Load an enrolment the signed-in user takes part in, as member or as dietitian. */
export async function enrolmentFor(ctx: Ctx, id: Id<"enrolments">, userId: Id<"users">, as: "member" | "dietitian" | "either" = "either") {
  const normalized = ctx.db.normalizeId("enrolments", id);
  const e = normalized && (await ctx.db.get(normalized));
  const ok = !!e && ((as !== "dietitian" && e.memberId === userId) || (as !== "member" && e.dietitianId === userId));
  if (!e || !ok) throw new ConvexError("Not found.");
  return e;
}

/** A programme chat shows its latest 200 messages (like member chats). */
const THREAD_LIMIT = 200;

export async function threadFor(ctx: Ctx, enrolmentId: Id<"enrolments">, viewerId: Id<"users">): Promise<ThreadMessage[]> {
  const rows = (
    await ctx.db.query("messages").withIndex("by_enrolment_sent", (q) => q.eq("enrolmentId", enrolmentId)).order("desc").take(THREAD_LIMIT)
  ).reverse();
  const names = new Map<string, string>();
  for (const id of new Set(rows.map((r) => r.senderId))) names.set(id, (await getProfile(ctx, id))?.name ?? "Nutrintel member");
  return rows.map((m) => ({ id: m._id, fromMe: m.senderId === viewerId, senderName: names.get(m.senderId)!, text: m.text, sentAt: new Date(m.sentAt).toISOString() }));
}

export async function sideRows(ctx: Ctx, enrolmentId: Id<"enrolments">) {
  const [adjuncts, checkIns] = await Promise.all([
    ctx.db.query("adjuncts").withIndex("by_enrolment", (q) => q.eq("enrolmentId", enrolmentId)).collect(),
    ctx.db.query("checkIns").withIndex("by_enrolment", (q) => q.eq("enrolmentId", enrolmentId)).collect(),
  ]);
  const approvers = new Map<string, string>();
  for (const id of new Set(adjuncts.map((a) => a.approvedBy))) approvers.set(id, (await getProfile(ctx, id))?.name ?? "Your dietitian");
  return {
    adjuncts: adjuncts.map((a) => ({
      id: a._id, name: a.name, dose: a.dose, timing: a.timing, reason: a.reason,
      approvedBy: approvers.get(a.approvedBy)!, approvedAt: new Date(a.approvedAt).toISOString(),
    })),
    checkIns: checkIns
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((c) => ({ id: c._id, week: c.week, summary: c.summary, nextSteps: c.nextSteps, weightKg: c.weightKg, createdAt: new Date(c.createdAt).toISOString() })),
  };
}

/** Public: programmes on offer and the verified dietitians offering them. */
export const catalogue = query({
  args: {},
  handler: async (ctx) => {
    const offerings = await ctx.db.query("offerings").withIndex("by_active", (q) => q.eq("active", true)).collect();
    const cards = new Map<string, DietitianCard | null>();
    const out = [];
    for (const o of offerings) {
      if (!cards.has(o.dietitianId)) cards.set(o.dietitianId, (await isBookable(ctx, o.dietitianId)) ? await dietitianCard(ctx, o.dietitianId) : null);
      const dietitian = cards.get(o.dietitianId);
      if (dietitian && programmeById(o.programmeId)) out.push({ id: o._id as string, programmeId: o.programmeId, priceNaira: o.priceNaira, dietitian });
    }
    return out;
  },
});

/** Start enrolling: saves the intake and the price; payment comes next. */
export const enrol = mutation({
  args: { offeringId: v.id("offerings"), intake },
  handler: async (ctx, args) => {
    const memberId = await requireUser(ctx);
    if (!(await getProfile(ctx, memberId))) throw new ConvexError("Please finish setting up your profile first.");
    const offering = await ctx.db.get(args.offeringId);
    if (!offering?.active || !(await isBookable(ctx, offering.dietitianId))) throw new ConvexError("This programme isn't available any more.");
    if (offering.dietitianId === memberId) throw new ConvexError("You can't enrol on your own programme.");
    const err = intakeError(args.intake);
    if (err) throw new ConvexError(err);
    if (args.intake.conditions.length > 5) throw new ConvexError("Too many conditions.");

    const mine = await ctx.db.query("enrolments").withIndex("by_member", (q) => q.eq("memberId", memberId)).collect();
    if (mine.some((e) => e.offeringId === offering._id && e.status === "active")) throw new ConvexError("You're already on this programme.");
    const { fee } = splitPayment(offering.priceNaira);
    const pending = mine.find((e) => e.offeringId === offering._id && e.status === "pending_payment");
    const fields = { intake: args.intake, priceNaira: offering.priceNaira, feeNaira: fee };
    if (pending) {
      await ctx.db.patch(pending._id, fields);
      return pending._id;
    }
    return ctx.db.insert("enrolments", {
      memberId, dietitianId: offering.dietitianId, offeringId: offering._id, programmeId: offering.programmeId,
      status: "pending_payment", createdAt: Date.now(), ...fields,
    });
  },
});

export const cancelPending = mutation({
  args: { enrolmentId: v.id("enrolments") },
  handler: async (ctx, { enrolmentId }) => {
    const userId = await requireUser(ctx);
    const e = await enrolmentFor(ctx, enrolmentId, userId, "member");
    if (e.status !== "pending_payment") throw new ConvexError("Only unpaid enrolments can be cancelled here. Message your dietitian about refunds.");
    await ctx.db.patch(e._id, { status: "cancelled" });
  },
});

/** The member's programmes, with everything their dietitian has shared. */
export const myEnrolments = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const rows = (await ctx.db.query("enrolments").withIndex("by_member", (q) => q.eq("memberId", userId)).collect()).filter((e) => e.status !== "cancelled");
    return Promise.all(rows.sort((a, b) => b.createdAt - a.createdAt).map(async (e) => {
      const messages = await threadFor(ctx, e._id, userId);
      return {
        id: e._id as string,
        programmeId: e.programmeId,
        priceNaira: e.priceNaira,
        status: e.status,
        createdAt: new Date(e.createdAt).toISOString(),
        startDate: e.startDate,
        dietitian: await dietitianCard(ctx, e.dietitianId),
        target: e.target,
        planWeekStart: e.planWeekStart,
        ...(await sideRows(ctx, e._id)),
        messages,
        unread: messages.filter((m) => !m.fromMe && Date.parse(m.sentAt) > (e.memberReadAt ?? 0)).length,
        demoPayment: !!e.demoPayment,
      };
    }));
  },
});

export const sendMessage = mutation({
  args: { enrolmentId: v.id("enrolments"), text: v.string() },
  handler: async (ctx, { enrolmentId, text }) => {
    const userId = await requireUser(ctx);
    const e = await enrolmentFor(ctx, enrolmentId, userId);
    if (e.status !== "active") throw new ConvexError("Messages open once the programme is paid for and stay open while it runs.");
    const clean = text.trim();
    if (!clean) return;
    checkText(clean, 2000, "Message");
    await postProgrammeMessage(ctx, e, userId, clean);
  },
});

export const markRead = mutation({
  args: { enrolmentId: v.id("enrolments") },
  handler: async (ctx, { enrolmentId }) => {
    const userId = await requireUser(ctx);
    const e = await enrolmentFor(ctx, enrolmentId, userId);
    await ctx.db.patch(e._id, e.memberId === userId ? { memberReadAt: Date.now() } : { dietitianReadAt: Date.now() });
  },
});

/* ---------- Programme chats on the Messages page ---------- */

/** Adds a message to a programme chat, marks it read for the sender and alerts the other side. */
async function postProgrammeMessage(ctx: MutationCtx, e: Doc<"enrolments">, senderId: Id<"users">, text: string) {
  const now = Date.now();
  await ctx.db.insert("messages", { enrolmentId: e._id, senderId, text, sentAt: now });
  await ctx.db.patch(e._id, e.memberId === senderId ? { memberReadAt: now } : { dietitianReadAt: now });
  await scheduleMessageAlert(ctx, { kind: "programme", chatId: e._id, to: e.memberId === senderId ? e.dietitianId : e.memberId, from: senderId, sentAt: now });
}

/**
 * Ending a programme takes both the member and the dietitian. Each side confirms (which posts a note in the chat);
 * it completes once both have. `ended: false` takes your confirmation back.
 */
export async function confirmEnd(ctx: MutationCtx, e: Doc<"enrolments">, userId: Id<"users">, ended: boolean) {
  if (e.status !== "active") throw new ConvexError("This programme isn't active.");
  const mine = e.memberId === userId ? "memberEndedAt" : "dietitianEndedAt";
  const theirs = mine === "memberEndedAt" ? "dietitianEndedAt" : "memberEndedAt";
  const note = (text: string) => postProgrammeMessage(ctx, e, userId, text);
  if (!ended) {
    if (e[mine]) {
      await ctx.db.patch(e._id, { [mine]: undefined });
      await note("↩️ Let's keep going — I've taken back my request to end the programme.");
    }
    return "active" as const;
  }
  if (e[mine]) return "waiting" as const;
  if (e[theirs]) {
    await ctx.db.patch(e._id, { [mine]: Date.now(), status: "completed" });
    await note("✅ Confirmed — this programme is now complete. Thank you!");
    return "completed" as const;
  }
  await ctx.db.patch(e._id, { [mine]: Date.now() });
  await note("🏁 I've marked this programme as finished. Please confirm to end it.");
  return "waiting" as const;
}

export const endProgramme = mutation({
  args: { enrolmentId: v.id("enrolments"), ended: v.boolean() },
  handler: async (ctx, { enrolmentId, ended }) => {
    const userId = await requireUser(ctx);
    const e = await enrolmentFor(ctx, enrolmentId, userId);
    return confirmEnd(ctx, e, userId, ended);
  },
});

async function chatHeader(ctx: QueryCtx, e: Doc<"enrolments">, userId: Id<"users">) {
  const role = e.memberId === userId ? ("member" as const) : ("dietitian" as const);
  const other = await getProfile(ctx, role === "member" ? e.dietitianId : e.memberId);
  const programme = programmeById(e.programmeId);
  return {
    id: e._id as string,
    role,
    name: other?.name ?? (role === "member" ? "Your dietitian" : "Nutrintel member"),
    programme: programme ? `${programme.emoji} ${programme.name}` : "Programme",
    status: e.status,
    endedByMe: !!(role === "member" ? e.memberEndedAt : e.dietitianEndedAt),
    endedByThem: !!(role === "member" ? e.dietitianEndedAt : e.memberEndedAt),
  };
}

/** Newest message in a programme chat, and how many from the other side arrived after `readAt`. */
export async function chatActivity(ctx: Ctx, enrolmentId: Id<"enrolments">, viewerId: Id<"users">, readAt: number) {
  const [last, after] = await Promise.all([
    ctx.db.query("messages").withIndex("by_enrolment_sent", (q) => q.eq("enrolmentId", enrolmentId)).order("desc").first(),
    ctx.db.query("messages").withIndex("by_enrolment_sent", (q) => q.eq("enrolmentId", enrolmentId).gt("sentAt", readAt)).collect(),
  ]);
  return { last, unread: after.filter((m) => m.senderId !== viewerId).length };
}

/** Running programmes the user is in (as member or dietitian): pinned at the top of Messages until both sides end them. */
export const programmeChats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const [asMember, asDietitian] = await Promise.all([
      ctx.db.query("enrolments").withIndex("by_member", (q) => q.eq("memberId", userId)).collect(),
      ctx.db.query("enrolments").withIndex("by_dietitian", (q) => q.eq("dietitianId", userId)).collect(),
    ]);
    const out = await Promise.all(
      [...asMember, ...asDietitian]
        .filter((x) => x.status === "active" && !x.memberDeleted)
        .map(async (e) => {
          const head = await chatHeader(ctx, e, userId);
          const readAt = (head.role === "member" ? e.memberReadAt : e.dietitianReadAt) ?? 0;
          const { last, unread } = await chatActivity(ctx, e._id, userId, readAt);
          return {
            ...head,
            unread,
            lastText: last ? last.text : "",
            lastFromMe: last ? last.senderId === userId : false,
            lastAt: new Date(last?.sentAt ?? e.paidAt ?? e.createdAt).toISOString(),
          };
        }),
    );
    return out.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  },
});

/** One programme chat, for the Messages page. */
export const programmeThread = query({
  args: { enrolmentId: v.string() },
  handler: async (ctx, { enrolmentId }) => {
    const userId = await requireUser(ctx);
    const id = ctx.db.normalizeId("enrolments", enrolmentId);
    const e = id && (await ctx.db.get(id));
    if (!e || (e.memberId !== userId && e.dietitianId !== userId) || e.status === "cancelled") return null;
    return { ...(await chatHeader(ctx, e, userId)), messages: await threadFor(ctx, e._id, userId) };
  },
});

/* ---------- Payments (called from payments.ts and http.ts) ---------- */

export const paymentInfo = internalQuery({
  args: { enrolmentId: v.id("enrolments"), userId: v.id("users") },
  handler: async (ctx, { enrolmentId, userId }) => {
    const e = await enrolmentFor(ctx, enrolmentId, userId, "member");
    const user = await ctx.db.get(userId);
    return { status: e.status, priceNaira: e.priceNaira, programmeId: e.programmeId, email: user?.email ?? null };
  },
});

export const setPaymentRef = internalMutation({
  args: { enrolmentId: v.id("enrolments"), reference: v.string() },
  handler: async (ctx, { enrolmentId, reference }) => {
    await ctx.db.patch(enrolmentId, { paymentRef: reference });
  },
});

/**
 * Activate an enrolment once Paystack confirms the charge. Safe to call more than once
 * (the webhook and the redirect check both call it). The amount must match the price exactly.
 */
export const markPaid = internalMutation({
  args: { reference: v.string(), amountKobo: v.number(), demo: v.optional(v.boolean()) },
  handler: async (ctx, { reference, amountKobo, demo }): Promise<"activated" | "already_active" | "unknown" | "amount_mismatch"> => {
    const e: Doc<"enrolments"> | null = await ctx.db.query("enrolments").withIndex("by_paymentRef", (q) => q.eq("paymentRef", reference)).unique();
    if (!e) return "unknown";
    if (e.status === "active" || e.status === "completed") return "already_active";
    if (amountKobo !== e.priceNaira * 100) {
      console.error("payment amount mismatch", reference, amountKobo, e.priceNaira);
      return "amount_mismatch";
    }
    await ctx.db.patch(e._id, { status: "active", paidAt: Date.now(), startDate: lagosToday(), demoPayment: demo || undefined });
    return "activated";
  },
});

/** The active dietitian-set target, if any (shown to the member instead of the automatic one). */
export async function activeTarget(ctx: Ctx, memberId: Id<"users">) {
  const rows = await ctx.db.query("enrolments").withIndex("by_member", (q) => q.eq("memberId", memberId)).collect();
  const withTarget = rows.filter((e) => e.status === "active" && e.target).sort((a, b) => b.target!.setAt.localeCompare(a.target!.setAt));
  return withTarget[0]?.target ?? null;
}

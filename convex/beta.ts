// Beta testing: the welcome email to every account (sent once each, paced to the daily email quota),
// in-app feedback that only admins read, and an opt-out from beta emails.
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { checkText, getProfile, logAdminAction, requireAdmin, requireUser } from "./helpers";
import { sendEmail } from "./email";
import { betaWelcomeEmail } from "./emails";
import { take, tryTake } from "./rateLimit";

const KIND = "beta_welcome";
const JOB = "beta_welcome_job";
const BATCH = 20;

/** Beta emails a day (BETA_EMAILS_PER_DAY, default 40): with welcome emails and codes, stays inside Resend's free 100 a day. */
const perDay = () => {
  const n = Number(process.env.BETA_EMAILS_PER_DAY);
  return Number.isFinite(n) && n >= 0 ? n : 40;
};

const settingsOf = (ctx: QueryCtx, userId: Id<"users">) => ctx.db.query("settings").withIndex("by_user", (q) => q.eq("userId", userId)).unique();

/* ---------- Feedback and opt-out (members) ---------- */

/** Send feedback to the Kalorax team (admins only can read it). */
export const sendFeedback = mutation({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const userId = await requireUser(ctx);
    const clean = text.trim();
    if (clean.length < 3) throw new ConvexError("Write a few words first.");
    checkText(clean, 2000, "Feedback");
    await take(ctx, "feedbackPerUser", userId);
    await ctx.db.insert("feedback", { userId, text: clean, createdAt: Date.now() });
  },
});

/** Whether you get beta emails (on unless you turned them off). */
export const myBetaEmails = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    return { on: !(await settingsOf(ctx, userId))?.betaEmailsOff };
  },
});

export const setBetaEmails = mutation({
  args: { on: v.boolean() },
  handler: async (ctx, { on }) => {
    const userId = await requireUser(ctx);
    const row = await settingsOf(ctx, userId);
    if (row) await ctx.db.patch(row._id, { betaEmailsOff: on ? undefined : true });
    else if (!on) await ctx.db.insert("settings", { userId, betaEmailsOff: true });
  },
});

/* ---------- Admin ---------- */

/** Admin: feedback from testers, newest first. */
export const feedbackList = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("feedback").withIndex("by_created").order("desc").take(200);
    return Promise.all(rows.map(async (r) => {
      const [user, profile] = await Promise.all([ctx.db.get(r.userId), getProfile(ctx, r.userId)]);
      return { id: r._id, text: r.text, at: new Date(r.createdAt).toISOString(), name: profile?.name ?? null, email: user?.email ?? null };
    }));
  },
});

/** Accounts that would get the beta welcome now: with an email, not opted out, not sent it yet. */
async function pending(ctx: QueryCtx, limit: number) {
  const out: Array<{ userId: Id<"users">; email: string; name: string }> = [];
  for (const u of await ctx.db.query("users").take(20000)) {
    if (out.length >= limit) break;
    if (!u.email) continue;
    if (await ctx.db.query("emailLog").withIndex("by_user_kind", (q) => q.eq("userId", u._id).eq("kind", KIND)).first()) continue;
    if ((await settingsOf(ctx, u._id))?.betaEmailsOff) continue;
    const profile = await getProfile(ctx, u._id);
    out.push({ userId: u._id, email: u.email, name: profile?.name.split(" ")[0] ?? "" });
  }
  return out;
}

/** Admin: how many accounts have had the beta welcome, how many are left, and whether it's sending. */
export const betaWelcomeStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [users, logs, job] = await Promise.all([
      ctx.db.query("users").take(20000),
      ctx.db.query("emailLog").withIndex("by_kind", (q) => q.eq("kind", KIND)).take(20000),
      ctx.db.query("counters").withIndex("by_name", (q) => q.eq("name", JOB)).unique(),
    ]);
    const withEmail = users.filter((u) => u.email).length;
    return {
      accounts: withEmail,
      sent: logs.filter((l) => l.status === "sent").length,
      failed: logs.filter((l) => l.status === "failed").length,
      left: (await pending(ctx, 20000)).length,
      sending: !!job?.value,
      perDay: perDay(),
    };
  },
});

/** Admin: start sending the beta welcome to every account that hasn't had it (each account gets it once). */
export const startBetaWelcome = mutation({
  args: {},
  handler: async (ctx) => {
    const adminId = await requireAdmin(ctx);
    const job = await ctx.db.query("counters").withIndex("by_name", (q) => q.eq("name", JOB)).unique();
    if (job?.value) return "already_sending";
    if (job) await ctx.db.patch(job._id, { value: 1 });
    else await ctx.db.insert("counters", { name: JOB, value: 1 });
    await logAdminAction(ctx, adminId, "beta_email_started", undefined, "Started sending the beta welcome email to all accounts");
    await ctx.scheduler.runAfter(0, internal.beta.runBetaWelcome, {});
    return "started";
  },
});

/* ---------- The send job (internal) ---------- */

export const nextBatch = internalQuery({ args: {}, handler: (ctx) => pending(ctx, BATCH) });

export const takeSlot = internalMutation({ args: {}, handler: (ctx) => tryTake(ctx, "broadcastEmailsDaily", "", 1, perDay()) });

export const markSent = internalMutation({
  args: { userId: v.id("users"), status: v.union(v.literal("sent"), v.literal("failed")), emailId: v.optional(v.string()) },
  handler: async (ctx, a) => {
    if (await ctx.db.query("emailLog").withIndex("by_user_kind", (q) => q.eq("userId", a.userId).eq("kind", KIND)).first()) return;
    await ctx.db.insert("emailLog", { userId: a.userId, kind: KIND, status: a.status, emailId: a.emailId, sentAt: Date.now() });
  },
});

export const setJob = internalMutation({
  args: { sending: v.boolean() },
  handler: async (ctx, { sending }) => {
    const job = await ctx.db.query("counters").withIndex("by_name", (q) => q.eq("name", JOB)).unique();
    if (job) await ctx.db.patch(job._id, { value: sending ? 1 : 0 });
  },
});

/** Sends in batches, at most the day's allowance; picks up again after midnight (UTC) until everyone has it. */
export const runBetaWelcome = internalAction({
  args: {},
  handler: async (ctx) => {
    for (;;) {
      const batch = await ctx.runQuery(internal.beta.nextBatch, {});
      if (batch.length === 0) {
        await ctx.runMutation(internal.beta.setJob, { sending: false });
        return;
      }
      for (const u of batch) {
        if (!(await ctx.runMutation(internal.beta.takeSlot, {}))) {
          // Today's allowance is used: carry on just after midnight UTC, when Resend's daily quota resets.
          const now = new Date();
          const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 10);
          await ctx.scheduler.runAt(next, internal.beta.runBetaWelcome, {});
          return;
        }
        try {
          const emailId = await sendEmail({ to: u.email, subject: "Welcome to the Kalorax beta 💚", content: betaWelcomeEmail(u.name), idempotencyKey: `beta-welcome/${u.userId}` });
          await ctx.runMutation(internal.beta.markSent, { userId: u.userId, status: "sent", emailId });
        } catch {
          // Logged by sendEmail; recorded so the job never loops on an address that can't receive.
          await ctx.runMutation(internal.beta.markSent, { userId: u.userId, status: "failed" });
        }
      }
    }
  },
});

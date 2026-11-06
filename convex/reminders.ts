import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireUser } from "./helpers";
import { dishLabel } from "../src/lib/planner";
import { dailyWaterTargetMl } from "../src/lib/nutrition";
import { dueReminders, localParts, normalizePhone, type ReminderContext, type ReminderMessage } from "../src/lib/reminders";
import { take } from "./rateLimit";

const CODE_TTL_MS = 10 * 60_000;
const MAX_CODES_PER_HOUR = 3;
const MAX_ATTEMPTS = 5;
const LOG_KEEP_MS = 3 * 24 * 3600_000;

export const whatsappConfigured = () =>
  !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && (process.env.WHATSAPP_TEMPLATE ?? "kalorax_reminder"));

/** Which channels the server can send on. Public: the app needs the push key before signing in to settings. */
export const config = query({
  args: {},
  handler: async () => ({
    pushPublicKey: process.env.VAPID_PUBLIC_KEY ?? null,
    whatsappAvailable: whatsappConfigured(),
  }),
});

/** Channel status for the signed-in member. */
export const myChannels = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const [subs, wa] = await Promise.all([
      ctx.db.query("pushSubscriptions").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("whatsapp").withIndex("by_user", (q) => q.eq("userId", userId)).unique(),
    ]);
    return {
      pushEndpoints: subs.map((s) => s.endpoint),
      whatsapp: wa ? { phone: wa.phone, verified: !!wa.verifiedAt, codePending: !!wa.codeHash && (wa.codeExpiresAt ?? 0) > Date.now() } : null,
    };
  },
});

export const savePushSubscription = mutation({
  args: { endpoint: v.string(), p256dh: v.string(), auth: v.string() },
  handler: async (ctx, sub) => {
    const userId = await requireUser(ctx);
    if (!/^https:\/\//.test(sub.endpoint) || sub.endpoint.length > 1000 || sub.p256dh.length > 200 || sub.auth.length > 100) {
      throw new ConvexError("That push subscription doesn't look right.");
    }
    // An endpoint belongs to one browser; if someone else signed in on it before, it moves to this account.
    for (const row of await ctx.db.query("pushSubscriptions").withIndex("by_endpoint", (q) => q.eq("endpoint", sub.endpoint)).collect()) {
      await ctx.db.delete(row._id);
    }
    const mine = await ctx.db.query("pushSubscriptions").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    if (mine.length >= 10) await ctx.db.delete(mine.sort((a, b) => a.createdAt - b.createdAt)[0]._id);
    await ctx.db.insert("pushSubscriptions", { userId, ...sub, createdAt: Date.now() });
  },
});

export const removePushSubscription = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const userId = await requireUser(ctx);
    for (const row of await ctx.db.query("pushSubscriptions").withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint)).collect()) {
      if (row.userId === userId) await ctx.db.delete(row._id);
    }
  },
});

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Save a WhatsApp number and send it a 6-digit code. Reminders only go to confirmed numbers. */
export const startWhatsApp = mutation({
  args: { phone: v.string() },
  handler: async (ctx, { phone: input }) => {
    const userId = await requireUser(ctx);
    if (!whatsappConfigured()) throw new ConvexError("WhatsApp reminders aren't switched on yet.");
    const phone = normalizePhone(input);
    if (!phone) throw new ConvexError("Please enter a valid phone number, e.g. 0803 123 4567.");
    const row = await ctx.db.query("whatsapp").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
    const now = Date.now();
    const recent = (row?.codesSentAt ?? []).filter((t) => now - t < 3600_000);
    if (recent.length >= MAX_CODES_PER_HOUR) throw new ConvexError("Too many codes. Please try again in an hour.");
    // Each code costs money and goes to whatever number was typed: cap per number and for everyone.
    await take(ctx, "whatsappCodePerPhone", phone);
    await take(ctx, "whatsappCodeGlobal");

    const digits = new Uint32Array(1);
    crypto.getRandomValues(digits);
    const code = String(digits[0] % 1_000_000).padStart(6, "0");
    const fields = {
      phone,
      verifiedAt: undefined,
      codeHash: await sha256(`${userId}:${code}`),
      codeExpiresAt: now + CODE_TTL_MS,
      attempts: 0,
      codesSentAt: [...recent, now],
    };
    if (row) await ctx.db.patch(row._id, fields);
    else await ctx.db.insert("whatsapp", { userId, ...fields });
    await ctx.scheduler.runAfter(0, internal.notify.sendWhatsAppCode, { phone, code });
    return { phone };
  },
});

export const confirmWhatsApp = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db.query("whatsapp").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
    if (!row?.codeHash || (row.codeExpiresAt ?? 0) < Date.now()) throw new ConvexError("That code has expired. Please ask for a new one.");
    if (row.attempts >= MAX_ATTEMPTS) throw new ConvexError("Too many tries. Please ask for a new code.");
    if ((await sha256(`${userId}:${code.trim()}`)) !== row.codeHash) {
      await ctx.db.patch(row._id, { attempts: row.attempts + 1 });
      throw new ConvexError("That code isn't right. Please check the WhatsApp message.");
    }
    await ctx.db.patch(row._id, { verifiedAt: Date.now(), codeHash: undefined, codeExpiresAt: undefined, attempts: 0 });
  },
});

export const removeWhatsApp = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db.query("whatsapp").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
    if (row) await ctx.db.delete(row._id);
  },
});

/** Send a test reminder (or a test alarm) to all of this member's channels (at most once a minute). */
export const sendTest = mutation({
  args: { alarm: v.optional(v.boolean()) },
  handler: async (ctx, { alarm }) => {
    const userId = await requireUser(ctx);
    const key = `test|${Math.floor(Date.now() / 60_000)}`;
    if (await ctx.db.query("reminderLog").withIndex("by_user_key", (q) => q.eq("userId", userId).eq("key", key)).unique()) {
      throw new ConvexError("Test sent. Please wait a minute before sending another.");
    }
    await ctx.db.insert("reminderLog", { userId, key, sentAt: Date.now() });
    const msg: ReminderMessage = alarm
      ? { key, title: "⏰ Test alarm", body: "Alarms stay on screen until you tap Done or Snooze.", url: "/reminders", priority: true }
      : { key, title: "Kalorax reminders are on ✅", body: "This is how your reminders will look.", url: "/reminders" };
    // An alarm test only goes to push (WhatsApp can't show alarms).
    const delivery = await deliveryFor(ctx, userId, [msg], { ignoreChannelSwitches: true, whatsapp: !alarm });
    if (alarm && !delivery?.push.length) throw new ConvexError("Turn on notifications on this device first.");
    if (!delivery) throw new ConvexError("Turn on notifications on this device or confirm your WhatsApp number first.");
    await ctx.scheduler.runAfter(0, internal.notify.deliver, { deliveries: [delivery] });
  },
});

export interface Delivery {
  messages: ReminderMessage[];
  push: Array<{ endpoint: string; p256dh: string; auth: string }>;
  whatsapp: string | null;
  /** Replaces the reminder text on WhatsApp (message alerts leave the message itself out). */
  whatsappText?: string;
  name: string;
  userId: Id<"users">;
  /** For a snoozed alarm: how many times it has been snoozed. */
  snoozes?: number;
}

export async function deliveryFor(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  messages: ReminderMessage[],
  opts: { settings?: Doc<"settings">; ignoreChannelSwitches?: boolean; whatsapp?: boolean } = {},
): Promise<Delivery | null> {
  const settings = opts.settings ?? (await ctx.db.query("settings").withIndex("by_user", (q) => q.eq("userId", userId)).unique());
  const wantPush = opts.ignoreChannelSwitches || !!settings?.reminders?.push;
  const wantWhatsApp = opts.whatsapp !== false && (opts.ignoreChannelSwitches || !!settings?.reminders?.whatsapp);
  const push = wantPush
    ? (await ctx.db.query("pushSubscriptions").withIndex("by_user", (q) => q.eq("userId", userId)).collect()).map(({ endpoint, p256dh, auth }) => ({ endpoint, p256dh, auth }))
    : [];
  const wa = wantWhatsApp && whatsappConfigured() ? await ctx.db.query("whatsapp").withIndex("by_user", (q) => q.eq("userId", userId)).unique() : null;
  const whatsapp = wa?.verifiedAt ? wa.phone : null;
  if (push.length === 0 && !whatsapp) return null;
  const profile = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
  return { messages, push, whatsapp, name: profile?.name.split(" ")[0] ?? "there", userId };
}

/** Everything the reminder rules need to know about one member's day. */
async function contextFor(ctx: MutationCtx, userId: Id<"users">, date: string): Promise<ReminderContext> {
  const [planRows, water, weight, events] = await Promise.all([
    ctx.db.query("plan").withIndex("by_user_date_meal", (q) => q.eq("userId", userId).eq("date", date)).collect(),
    ctx.db.query("water").withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date)).unique(),
    ctx.db.query("weights").withIndex("by_user_date", (q) => q.eq("userId", userId)).order("desc").first(),
    ctx.db.query("events").withIndex("by_user_date", (q) => q.eq("userId", userId).gte("date", date)).take(50),
  ]);
  const plan: ReminderContext["plan"] = {};
  for (const p of planRows) {
    const label = dishLabel(p.recipeId, p.portion ?? 1);
    if (label) plan[p.meal] = label;
  }
  return {
    plan,
    events: events.map((e) => ({ id: e._id, date: e.date, time: e.time, title: e.title, type: e.type })),
    waterMl: water?.ml ?? 0,
    waterTargetMl: weight ? dailyWaterTargetMl(weight.weightKg) : null,
  };
}

/**
 * Called by the cron: works out which reminders are due for everyone, records them as sent
 * (so a retry or overlapping run never sends twice) and returns what to deliver.
 */
export const claimDue = internalMutation({
  args: { now: v.number() },
  handler: async (ctx, { now }): Promise<Delivery[]> => {
    const out: Delivery[] = [];
    for (const settings of await ctx.db.query("settings").collect()) {
      const r = settings.reminders;
      if (!r || (!r.push && !r.whatsapp)) continue;
      const { date } = localParts(now, r.utcOffsetMinutes);
      const due = dueReminders(r, now, await contextFor(ctx, settings.userId, date));
      const fresh: ReminderMessage[] = [];
      for (const m of due) {
        const sent = await ctx.db.query("reminderLog").withIndex("by_user_key", (q) => q.eq("userId", settings.userId).eq("key", m.key)).unique();
        if (!sent) fresh.push(m);
      }
      if (fresh.length === 0) continue;
      const delivery = await deliveryFor(ctx, settings.userId, fresh, { settings });
      if (!delivery) continue;
      for (const m of fresh) await ctx.db.insert("reminderLog", { userId: settings.userId, key: m.key, sentAt: now });
      out.push(delivery);
    }
    for (const old of await ctx.db.query("reminderLog").withIndex("by_sentAt", (q) => q.lt("sentAt", now - LOG_KEEP_MS)).take(200)) {
      await ctx.db.delete(old._id);
    }
    return out;
  },
});

/** Records a snooze once, so replaying the same link can't schedule the alarm again. */
export const claimSnooze = internalMutation({
  args: { userId: v.id("users"), key: v.string(), snoozes: v.number() },
  handler: async (ctx, { userId, key, snoozes }) => {
    const logKey = `snooze|${key}|${snoozes}`;
    if (!(await ctx.db.get(userId))) return false;
    if (await ctx.db.query("reminderLog").withIndex("by_user_key", (q) => q.eq("userId", userId).eq("key", logKey)).unique()) return false;
    await ctx.db.insert("reminderLog", { userId, key: logKey, sentAt: Date.now() });
    return true;
  },
});

/** A snoozed alarm, due again now: push only, to the member's current devices. */
export const snoozedDelivery = internalMutation({
  args: { userId: v.id("users"), message: v.object({ key: v.string(), title: v.string(), body: v.string(), url: v.string() }), snoozes: v.number() },
  handler: async (ctx, { userId, message, snoozes }): Promise<Delivery | null> => {
    const d = await deliveryFor(ctx, userId, [{ ...message, priority: true }], { whatsapp: false });
    return d && { ...d, snoozes };
  },
});

/** Push services answer 404/410 for subscriptions that were removed; forget them. */
export const removeEndpoints = internalMutation({
  args: { endpoints: v.array(v.string()) },
  handler: async (ctx, { endpoints }) => {
    for (const endpoint of endpoints) {
      for (const row of await ctx.db.query("pushSubscriptions").withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint)).collect()) {
        await ctx.db.delete(row._id);
      }
    }
  },
});

/** For tests and debugging: how many reminders are logged for a user. */
export const logCount = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => (await ctx.db.query("reminderLog").withIndex("by_user_key", (q) => q.eq("userId", userId)).collect()).length,
});

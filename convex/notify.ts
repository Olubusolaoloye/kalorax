"use node";
// Sends reminders and new-message alerts: web push (VAPID) and WhatsApp (Meta WhatsApp Cloud API template messages).
import { v } from "convex/values";
import webpush from "web-push";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import type { Delivery } from "./reminders";
import { MAX_SNOOZES, signSnooze } from "./snooze";

const GRAPH = "https://graph.facebook.com/v21.0";

function pushReady(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:hello@nutrintel.ng", pub, priv);
  return true;
}

/** Returns the endpoints that no longer exist. */
async function sendPush(d: Delivery): Promise<string[]> {
  if (d.push.length === 0 || !pushReady()) return [];
  const gone: string[] = [];
  for (const m of d.messages) {
    const snoozes = d.snoozes ?? 0;
    // Alarms: high urgency (delivered right away, even in battery saver) and dropped if over 15 minutes late.
    const snooze = m.priority && snoozes < MAX_SNOOZES && process.env.CONVEX_SITE_URL
      ? { snoozeUrl: `${process.env.CONVEX_SITE_URL}/reminders/snooze`, snoozeToken: await signSnooze(process.env.VAPID_PRIVATE_KEY!, { u: d.userId, m: { key: m.key, title: m.title, body: m.body, url: m.url }, n: snoozes }) }
      : {};
    const payload = JSON.stringify({ title: m.title, body: m.body, url: m.url, tag: m.key, priority: !!m.priority, ...snooze });
    // Give up on a push service after 10 seconds so one slow endpoint doesn't hold up the rest.
    const options = m.priority ? { TTL: 900, urgency: "high" as const, timeout: 10_000 } : { TTL: 3600, urgency: "normal" as const, timeout: 10_000 };
    await Promise.all(
      d.push.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, options);
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) gone.push(s.endpoint);
          else console.error("push failed", status, (err as Error).message);
        }
      }),
    );
  }
  return [...new Set(gone)];
}

/** WhatsApp business-initiated messages must use an approved template. */
async function sendTemplate(to: string, template: string, components: unknown[]) {
  try {
    await postTemplate(to, template, components);
  } catch (err) {
    // A timeout or network error skips this message instead of stopping everyone else's.
    console.error("whatsapp unreachable", (err as Error).name);
  }
}

async function postTemplate(to: string, template: string, components: unknown[]) {
  const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/^\+/, ""),
      type: "template",
      template: { name: template, language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? "en" }, components },
    }),
  });
  if (!res.ok) console.error("whatsapp failed", res.status, await res.text());
}

/** The reminder template has two body variables: {{1}} first name, {{2}} the reminder text. */
const reminderTemplate = (name: string, text: string) => [
  { type: "body", parameters: [{ type: "text", text: name }, { type: "text", text: text.slice(0, 900) }] },
];

async function sendWhatsApp(d: Delivery) {
  if (!d.whatsapp || !process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) return;
  const template = process.env.WHATSAPP_TEMPLATE ?? "nutrintel_reminder";
  // One message per run, even when several reminders fall due together.
  const text = d.whatsappText ?? d.messages.map((m) => `${m.title} ${m.body}`).join(" · ");
  await sendTemplate(d.whatsapp, template, reminderTemplate(d.name, text));
}

export const deliver = internalAction({
  args: { deliveries: v.any() },
  handler: async (ctx, { deliveries }) => {
    const gone: string[] = [];
    // Members are independent, so send to several at once (10 at a time keeps providers happy).
    const queue = [...(deliveries as Delivery[])];
    const worker = async () => {
      for (let d = queue.shift(); d; d = queue.shift()) {
        const [expired] = await Promise.all([sendPush(d), sendWhatsApp(d)]);
        gone.push(...expired);
      }
    };
    await Promise.all(Array.from({ length: Math.min(10, queue.length) }, worker));
    if (gone.length) await ctx.runMutation(internal.reminders.removeEndpoints, { endpoints: gone });
  },
});

/** Runs every 5 minutes (see crons.ts). */
export const tick = internalAction({
  args: {},
  handler: async (ctx) => {
    const deliveries: Delivery[] = await ctx.runMutation(internal.reminders.claimDue, { now: Date.now() });
    if (deliveries.length) await ctx.runAction(internal.notify.deliver, { deliveries });
  },
});

/** A snoozed alarm comes back (scheduled by the /reminders/snooze endpoint). */
export const snoozed = internalAction({
  args: { userId: v.id("users"), message: v.object({ key: v.string(), title: v.string(), body: v.string(), url: v.string() }), snoozes: v.number() },
  handler: async (ctx, args) => {
    const delivery: Delivery | null = await ctx.runMutation(internal.reminders.snoozedDelivery, args);
    if (delivery) await ctx.runAction(internal.notify.deliver, { deliveries: [delivery] });
  },
});

/** A new chat message (scheduled by alerts.scheduleMessageAlert a few seconds after it was sent). */
export const messageAlert = internalAction({
  args: { kind: v.union(v.literal("direct"), v.literal("programme")), chatId: v.string(), to: v.id("users"), from: v.id("users"), sentAt: v.number() },
  handler: async (ctx, args) => {
    const delivery: Delivery | null = await ctx.runMutation(internal.alerts.claimMessageAlert, args);
    if (delivery) await ctx.runAction(internal.notify.deliver, { deliveries: [delivery] });
  },
});

export const sendWhatsAppCode = internalAction({
  args: { phone: v.string(), code: v.string() },
  handler: async (_ctx, { phone, code }) => {
    const authTemplate = process.env.WHATSAPP_CODE_TEMPLATE;
    if (authTemplate) {
      // Meta "authentication" template: the code goes in the body and the copy-code button.
      await sendTemplate(phone, authTemplate, [
        { type: "body", parameters: [{ type: "text", text: code }] },
        { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
      ]);
    } else {
      await sendTemplate(phone, process.env.WHATSAPP_TEMPLATE ?? "nutrintel_reminder", reminderTemplate("there", `your Nutrintel code is ${code}. Enter it in the app to switch on WhatsApp reminders.`));
    }
  },
});

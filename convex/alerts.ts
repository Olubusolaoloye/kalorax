// Notifications for new chat messages (friend chats and programme chats).
// Each message schedules an alert a few seconds later; it's only sent if the message is still unread then
// (someone reading the chat in the app gets nothing) and only for the latest message in a burst.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { getProfile } from "./helpers";
import { deliveryFor, type Delivery } from "./reminders";

export const ALERT_DELAY_MS = 15_000;
/** WhatsApp costs money per conversation: at most one message alert per chat per hour. */
const WHATSAPP_EVERY_MS = 3600_000;

const alertArgs = {
  kind: v.union(v.literal("direct"), v.literal("programme")),
  chatId: v.string(),
  to: v.id("users"),
  from: v.id("users"),
  sentAt: v.number(),
};

export async function scheduleMessageAlert(
  ctx: MutationCtx,
  a: { kind: "direct" | "programme"; chatId: string; to: Id<"users">; from: Id<"users">; sentAt: number },
) {
  await ctx.scheduler.runAfter(ALERT_DELAY_MS, internal.notify.messageAlert, a);
}

const preview = (m: { text: string; plan?: unknown; grocery?: unknown }) =>
  m.text ? (m.text.length > 120 ? `${m.text.slice(0, 117)}…` : m.text) : m.plan ? "📅 Sent you a meal plan" : m.grocery ? "🧺 Sent you a grocery list" : "New message";

/** Works out whether (and what) to notify; returns null when there's nothing to send. */
export const claimMessageAlert = internalMutation({
  args: alertArgs,
  handler: async (ctx, { kind, chatId, to, from, sentAt }): Promise<Delivery | null> => {
    let unread: Array<{ text: string; plan?: unknown; grocery?: unknown; sentAt: number }>;
    let url: string;
    if (kind === "direct") {
      const id = ctx.db.normalizeId("conversations", chatId);
      const c = id && (await ctx.db.get(id));
      if (!c || c.blockedBy) return null;
      const readAt = (c.a === to ? c.aReadAt : c.bReadAt) ?? 0;
      unread = (await ctx.db.query("directMessages").withIndex("by_conversation", (q) => q.eq("conversationId", c._id).gt("sentAt", readAt)).collect())
        .filter((m) => m.senderId === from);
      url = `/messages?c=${c._id}`;
    } else {
      const id = ctx.db.normalizeId("enrolments", chatId);
      const e = id && (await ctx.db.get(id));
      if (!e || e.memberDeleted) return null;
      const readAt = (e.memberId === to ? e.memberReadAt : e.dietitianReadAt) ?? 0;
      unread = (await ctx.db.query("messages").withIndex("by_enrolment_sent", (q) => q.eq("enrolmentId", e._id).gt("sentAt", readAt)).collect())
        .filter((m) => m.senderId === from);
      url = `/messages?p=${e._id}`;
    }
    // Read already, or a newer message will send its own alert.
    const last = unread[unread.length - 1];
    if (!last || last.sentAt !== sentAt) return null;

    const settings = await ctx.db.query("settings").withIndex("by_user", (q) => q.eq("userId", to)).unique();
    if (settings?.reminders?.messages === false) return null;
    const name = (await getProfile(ctx, from))?.name ?? "Someone";
    const waKey = `msg|${chatId}|${Math.floor(sentAt / WHATSAPP_EVERY_MS)}`;
    const waSent = !!(await ctx.db.query("reminderLog").withIndex("by_user_key", (q) => q.eq("userId", to).eq("key", waKey)).unique());
    const count = unread.length;
    const delivery = await deliveryFor(
      ctx,
      to,
      [{
        key: `chat-${chatId}`,
        title: kind === "programme" ? `🩺 ${name}` : `💬 ${name}`,
        // Programme chats are about someone's health: keep the text off the lock screen.
        body: kind === "programme" ? (count > 1 ? `${count} new messages about your programme` : "New message about your programme") : count > 1 ? `${count} new messages · ${preview(last)}` : preview(last),
        url,
      }],
      { settings: settings ?? undefined, whatsapp: !waSent },
    );
    if (!delivery) return null;
    if (delivery.whatsapp) {
      // No message text on WhatsApp either: just who wrote.
      delivery.whatsappText = `${name} sent you ${count > 1 ? `${count} messages` : "a message"} on Kalorax. Open the app to reply.`;
      await ctx.db.insert("reminderLog", { userId: to, key: waKey, sentAt: Date.now() });
    }
    return delivery;
  },
});

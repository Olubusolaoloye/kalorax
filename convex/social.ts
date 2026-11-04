// Member-to-member messages: chat with another Kalorax member and send them a week of your meal plan.
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { scheduleMessageAlert } from "./alerts";
import { checkRange, checkText, getProfile, hasAccess, requireUser } from "./helpers";
import { normalizeUsername, profileByUsername } from "./usernames";
import { sharedGrocery, sharedPlan } from "./validators";

type Ctx = QueryCtx | MutationCtx;

const MAX_PLAN_ITEMS = 28;
const MAX_GROCERY_ITEMS = 80;
/** At most this many messages a minute from one person in one chat. */
const MAX_PER_MINUTE = 20;
const THREAD_LIMIT = 200;
const NOT_FOUND = "There's no Kalorax member with that username. Check the spelling, or ask them for their @username.";

const otherOf = (c: Doc<"conversations">, userId: Id<"users">) => (c.a === userId ? c.b : c.a);
const readKey = (c: Doc<"conversations">, userId: Id<"users">) => (c.a === userId ? "aReadAt" : "bReadAt") as "aReadAt" | "bReadAt";
const whoIs = async (ctx: Ctx, userId: Id<"users">) => {
  const p = await getProfile(ctx, userId);
  return { name: p?.name ?? "Kalorax member", username: p?.username ?? null };
};

/** Load a conversation the signed-in user is part of. */
async function conversationFor(ctx: Ctx, id: Id<"conversations">, userId: Id<"users">) {
  const normalized = ctx.db.normalizeId("conversations", id);
  const c = normalized && (await ctx.db.get(normalized));
  if (!c || (c.a !== userId && c.b !== userId)) throw new ConvexError("Not found.");
  return c;
}

async function unreadIn(ctx: Ctx, c: Doc<"conversations">, userId: Id<"users">) {
  const since = c[readKey(c, userId)];
  const rows = await ctx.db
    .query("directMessages")
    .withIndex("by_conversation", (q) => q.eq("conversationId", c._id).gt("sentAt", since))
    .collect();
  return rows.filter((m) => m.senderId !== userId).length;
}

/** Your chats, newest first, with the other person's name, the last message and how many you haven't read. */
export const inbox = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId || !(await hasAccess(ctx, userId))) return null;
    const [asA, asB] = await Promise.all([
      ctx.db.query("conversations").withIndex("by_a", (q) => q.eq("a", userId)).collect(),
      ctx.db.query("conversations").withIndex("by_b", (q) => q.eq("b", userId)).collect(),
    ]);
    const rows = [...asA, ...asB].sort((x, y) => y.lastMessageAt - x.lastMessageAt);
    return Promise.all(
      rows.map(async (c) => {
        const last = await ctx.db.query("directMessages").withIndex("by_conversation", (q) => q.eq("conversationId", c._id)).order("desc").first();
        return {
          id: c._id,
          ...(await whoIs(ctx, otherOf(c, userId))),
          lastText: last ? (last.text || (last.plan ? `📅 ${last.plan.title}` : last.grocery ? `🧺 ${last.grocery.title}` : "")) : "",
          lastFromMe: last?.senderId === userId,
          lastAt: new Date(c.lastMessageAt).toISOString(),
          unread: await unreadIn(ctx, c, userId),
          blocked: !!c.blockedBy,
          blockedByMe: c.blockedBy === userId,
        };
      }),
    );
  },
});

/** One chat's messages (the latest 200), oldest first. */
export const thread = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const userId = await requireUser(ctx);
    const c = await conversationFor(ctx, conversationId, userId);
    const rows = await ctx.db
      .query("directMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", c._id))
      .order("desc")
      .take(THREAD_LIMIT);
    return {
      id: c._id,
      ...(await whoIs(ctx, otherOf(c, userId))),
      blocked: !!c.blockedBy,
      blockedByMe: c.blockedBy === userId,
      messages: rows.reverse().map((m) => ({
        id: m._id,
        fromMe: m.senderId === userId,
        text: m.text,
        plan: m.plan ?? null,
        grocery: m.grocery ?? null,
        checked: m.checked ?? [],
        sentAt: new Date(m.sentAt).toISOString(),
      })),
    };
  },
});

/** Members whose username starts with what was typed (at least 2 characters), for starting a chat. */
export const findPeople = query({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    const userId = await requireUser(ctx);
    const prefix = normalizeUsername(q);
    if (prefix.length < 2 || !/^[a-z0-9._]+$/.test(prefix)) return [];
    const rows = await ctx.db
      .query("profiles")
      .withIndex("by_username", (x) => x.gte("username", prefix).lt("username", `${prefix}\uffff`))
      .take(9);
    return rows
      .filter((p) => p.userId !== userId)
      .slice(0, 8)
      .map((p) => ({ username: p.username!, name: p.name, role: p.role, verified: p.verification === "verified" }));
  },
});

/** Opens (or finds) a chat with the member who has this @username. */
export const start = mutation({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const userId = await requireUser(ctx);
    if (!(await getProfile(ctx, userId))) throw new ConvexError("Finish setting up your profile first.");
    const u = normalizeUsername(username);
    checkText(u, 40, "Username");
    const other = u ? await profileByUsername(ctx, u) : null;
    if (!other) throw new ConvexError(NOT_FOUND);
    if (other.userId === userId) throw new ConvexError("That's your own username. Enter a friend's instead.");
    const [a, b] = userId < other.userId ? [userId, other.userId] : [other.userId, userId];
    const existing = await ctx.db.query("conversations").withIndex("by_pair", (q) => q.eq("a", a).eq("b", b)).unique();
    if (existing) return existing._id;
    // Nothing read yet, so a message sent in the same millisecond still counts as unread.
    return ctx.db.insert("conversations", { a, b, lastMessageAt: Date.now(), aReadAt: 0, bReadAt: 0 });
  },
});

export const send = mutation({
  args: { conversationId: v.id("conversations"), text: v.string(), plan: v.optional(sharedPlan), grocery: v.optional(sharedGrocery), checked: v.optional(v.array(v.string())) },
  handler: async (ctx, { conversationId, text, plan, grocery, checked }) => {
    const userId = await requireUser(ctx);
    const c = await conversationFor(ctx, conversationId, userId);
    if (c.blockedBy) throw new ConvexError("You can't send messages in this chat.");
    const clean = text.trim();
    checkText(clean, 2000, "Message");
    if (plan) {
      checkText(plan.title, 80, "Plan title");
      if (plan.items.length === 0 || plan.items.length > MAX_PLAN_ITEMS) throw new ConvexError("A shared plan has 1 to 28 meals.");
      for (const it of plan.items) {
        if (!Number.isInteger(it.day)) throw new ConvexError("Invalid plan day.");
        checkRange(it.day, 0, 6, "Plan day");
        checkText(it.recipeId, 60, "Recipe");
        if (it.portion !== undefined) checkRange(it.portion, 0.25, 4, "Portion");
      }
    }
    if (grocery) {
      checkText(grocery.title, 80, "List title");
      checkRange(grocery.people, 1, 12, "People");
      if (grocery.items.length === 0 || grocery.items.length > MAX_GROCERY_ITEMS) throw new ConvexError("A shared grocery list has 1 to 80 items.");
      for (const it of grocery.items) {
        checkText(it.key, 40, "Item");
        checkText(it.name, 60, "Item name");
        checkText(it.category, 30, "Category");
        checkText(it.unit, 20, "Unit");
        checkRange(it.qty, 0, 10_000, "Quantity");
        checkRange(it.costNaira, 0, 10_000_000, "Cost");
      }
    }
    if (plan && grocery) throw new ConvexError("Send a plan and a grocery list as separate messages.");
    const keys = new Set(grocery?.items.map((i) => i.key) ?? []);
    const ticked = grocery && checked ? [...new Set(checked)].filter((k) => keys.has(k)) : undefined;
    if (!clean && !plan && !grocery) return;
    const now = Date.now();
    const recent = await ctx.db
      .query("directMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", c._id).gt("sentAt", now - 60_000))
      .collect();
    if (recent.filter((m) => m.senderId === userId).length >= MAX_PER_MINUTE) throw new ConvexError("You're sending messages very fast. Please wait a minute.");
    await ctx.db.insert("directMessages", { conversationId: c._id, senderId: userId, text: clean, plan, grocery, checked: ticked, sentAt: now });
    await ctx.db.patch(c._id, { lastMessageAt: now, [readKey(c, userId)]: now });
    await scheduleMessageAlert(ctx, { kind: "direct", chatId: c._id, to: c.a === userId ? c.b : c.a, from: userId, sentAt: now });
  },
});

export const markRead = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const userId = await requireUser(ctx);
    const c = await conversationFor(ctx, conversationId, userId);
    await ctx.db.patch(c._id, { [readKey(c, userId)]: Date.now() });
  },
});

/** Tick or untick an item on a grocery list in a chat. Either person can, so whoever shops keeps it up to date. */
export const tickGroceryItem = mutation({
  args: { messageId: v.id("directMessages"), key: v.string(), done: v.boolean() },
  handler: async (ctx, { messageId, key, done }) => {
    const userId = await requireUser(ctx);
    const normalized = ctx.db.normalizeId("directMessages", messageId);
    const m = normalized && (await ctx.db.get(normalized));
    if (!m) throw new ConvexError("Not found.");
    const c = await conversationFor(ctx, m.conversationId, userId);
    if (c.blockedBy) throw new ConvexError("You can't change this list.");
    if (!m.grocery || !m.grocery.items.some((i) => i.key === key)) throw new ConvexError("Not found.");
    const set = new Set(m.checked ?? []);
    if (done) set.add(key);
    else set.delete(key);
    await ctx.db.patch(m._id, { checked: [...set] });
  },
});

/** Block stops messages both ways; only the person who blocked can unblock. */
export const setBlocked = mutation({
  args: { conversationId: v.id("conversations"), blocked: v.boolean() },
  handler: async (ctx, { conversationId, blocked }) => {
    const userId = await requireUser(ctx);
    const c = await conversationFor(ctx, conversationId, userId);
    if (blocked && !c.blockedBy) await ctx.db.patch(c._id, { blockedBy: userId });
    if (!blocked && c.blockedBy === userId) await ctx.db.patch(c._id, { blockedBy: undefined });
  },
});

/** Removes every chat the user is in, with all its messages (used when they delete their data). */
export async function deleteConversationsOf(ctx: MutationCtx, userId: Id<"users">) {
  const [asA, asB] = await Promise.all([
    ctx.db.query("conversations").withIndex("by_a", (q) => q.eq("a", userId)).collect(),
    ctx.db.query("conversations").withIndex("by_b", (q) => q.eq("b", userId)).collect(),
  ]);
  for (const c of [...asA, ...asB]) {
    for (const m of await ctx.db.query("directMessages").withIndex("by_conversation", (q) => q.eq("conversationId", c._id)).collect()) {
      await ctx.db.delete(m._id);
    }
    await ctx.db.delete(c._id);
  }
}

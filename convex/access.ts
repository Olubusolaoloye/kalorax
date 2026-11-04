// Private mode: while it's on, the public sees only the waitlist, and only confirmed admins and people who
// used a one-time invite link can create an account or use the app (enforced in requireUser and when an
// account is created, see auth.ts). Invite links are shared by the admin (e.g. on WhatsApp); no email needed.
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { accessConfig, adminEmails, checkText, hasAccess, isPrivateMode, logAdminAction, openInvite, requireAdmin } from "./helpers";

const role = v.union(v.literal("member"), v.literal("student"), v.literal("dietitian"));
/** An unused invite link stops working after 14 days. */
const INVITE_DAYS = 14;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** Accounts whose email is listed in ADMIN_EMAILS (their stored email may differ in case; both are tried). */
async function adminEmailAccounts(ctx: QueryCtx) {
  const found = new Map<Id<"users">, string>();
  for (const email of adminEmails()) {
    for (const u of await ctx.db.query("users").withIndex("email", (q) => q.eq("email", email)).collect()) found.set(u._id, email);
  }
  return found;
}

/** Public: whether the app is in private mode (the landing page shows only the waitlist). */
export const status = query({
  args: {},
  handler: async (ctx) => ({ privateMode: await isPrivateMode(ctx) }),
});

/**
 * Admin: turn private mode on or off. The first time it's turned on, the admin list is locked: the
 * ADMIN_EMAILS accounts that exist now become the confirmed admins, and later ones need confirming.
 */
export const setPrivateMode = mutation({
  args: { on: v.boolean() },
  handler: async (ctx, { on }) => {
    const adminId = await requireAdmin(ctx);
    const row = await accessConfig(ctx);
    if (!!row?.privateMode === on) return;
    const adminIds = row?.adminIds ?? (on ? [...new Set([adminId, ...(await adminEmailAccounts(ctx)).keys()])] : undefined);
    const patch = { privateMode: on, updatedAt: Date.now(), ...(adminIds ? { adminIds } : {}) };
    if (row) await ctx.db.patch(row._id, patch);
    else await ctx.db.insert("appConfig", { key: "access", ...patch });
    await logAdminAction(ctx, adminId, on ? "private_mode_on" : "private_mode_off", undefined,
      on ? "Private mode on: only admins and people with an invite link can sign up and use the app" : "Private mode off: anyone can sign up");
  },
});

/**
 * Admin: create a one-time invite link. The admin's browser makes the token (32 random bytes), so the server
 * never needs a random source; it only checks the format and that it's new.
 */
export const createInvite = mutation({
  args: { token: v.string(), label: v.string(), role },
  handler: async (ctx, { token, label, role }) => {
    const adminId = await requireAdmin(ctx);
    if (!TOKEN.test(token)) throw new ConvexError("Invalid invite token.");
    const clean = label.trim();
    if (!clean) throw new ConvexError("Add a name or email so you know who the link is for.");
    checkText(clean, 120, "Label");
    if (await ctx.db.query("invites").withIndex("by_token", (q) => q.eq("token", token)).unique()) throw new ConvexError("Please try again.");
    const now = Date.now();
    await ctx.db.insert("invites", { token, label: clean, role, invitedBy: adminId, createdAt: now, expiresAt: now + INVITE_DAYS * 86_400_000 });
    await logAdminAction(ctx, adminId, "invite_added", undefined, `Invite link for ${clean} (${role})`);
  },
});

/** Admin: cancel an invite link, or take access away from whoever used it (while private mode is on). */
export const removeInvite = mutation({
  args: { id: v.id("invites") },
  handler: async (ctx, { id }) => {
    const adminId = await requireAdmin(ctx);
    const invite = await ctx.db.get(id);
    if (!invite) return;
    await ctx.db.delete(id);
    await logAdminAction(ctx, adminId, "invite_removed", invite.usedBy, `${invite.usedBy ? "Removed access for" : "Cancelled the invite link for"} ${invite.label}`);
  },
});

/** Signed in (e.g. an account made before private mode) and opening an invite link: use it for this account. */
export const redeem = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Please sign in.");
    if (await hasAccess(ctx, userId)) return "already";
    const invite = await openInvite(ctx, token);
    if (!invite) throw new ConvexError("This invite link has already been used, has expired or isn't valid. Ask for a new one.");
    await ctx.db.patch(invite._id, { usedBy: userId, usedAt: Date.now() });
    return "joined";
  },
});

/** Admin: confirm an account with an ADMIN_EMAILS address that signed up after the admin list was locked. */
export const confirmAdmin = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const adminId = await requireAdmin(ctx);
    const row = await accessConfig(ctx);
    const user = await ctx.db.get(userId);
    if (!row?.adminIds || !user?.email || !adminEmails().includes(user.email.toLowerCase())) throw new ConvexError("This account isn't waiting for admin confirmation.");
    if (row.adminIds.includes(userId)) return;
    await ctx.db.patch(row._id, { adminIds: [...row.adminIds, userId] });
    await logAdminAction(ctx, adminId, "admin_confirmed", userId, `Confirmed ${user.email} as an admin`);
  },
});

/** Admin: the switch, the invite links (with who used each) and any admin accounts waiting for confirmation. */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const row = await accessConfig(ctx);
    const now = Date.now();
    const invites = await Promise.all(
      (await ctx.db.query("invites").order("desc").take(1000)).map(async (i) => {
        const user = i.usedBy ? await ctx.db.get(i.usedBy) : null;
        return {
          id: i._id,
          label: i.label,
          role: i.role,
          createdAt: new Date(i.createdAt).toISOString(),
          status: i.usedBy ? ("used" as const) : i.expiresAt <= now ? ("expired" as const) : ("open" as const),
          usedByEmail: user?.email ?? null,
          // The link is shown only while it can still be used.
          token: !i.usedBy && i.expiresAt > now ? i.token : null,
        };
      }),
    );
    const pendingAdmins = row?.adminIds
      ? [...(await adminEmailAccounts(ctx)).entries()].filter(([id]) => !row.adminIds!.includes(id)).map(([id, email]) => ({ id, email }))
      : [];
    return { privateMode: !!row?.privateMode, adminListLocked: !!row?.adminIds, invites, pendingAdmins };
  },
});

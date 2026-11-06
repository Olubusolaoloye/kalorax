// Private mode: while it's on, the public sees only the waitlist, and only confirmed admins and people who
// used a one-time invite link can create an account or use the app (enforced in requireUser and when an
// account is created, see auth.ts). Invite links are shared by the admin (copy link, WhatsApp), and an invite
// made from the waitlist is also emailed to that address with its link (inviteFromWaitlist).
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { emailConfigured, sendEmail } from "./email";
import { inviteEmail } from "./emails";
import { accessConfig, adminEmails, checkText, hasAccess, isPrivateMode, logAdminAction, openInvite, requireAdmin } from "./helpers";
import { LIMITS, tryTake } from "./rateLimit";

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

/**
 * Admin: invite someone from the waitlist. Makes their one-time link (or reuses the open one they already have)
 * and emails it to them in the Kalorax design. Calling it again for someone with an open link sends the email
 * again. The link is made either way; if email isn't set up or today's email allowance is used, the result
 * says why so the admin can copy the link or send it on WhatsApp instead.
 */
export const inviteFromWaitlist = mutation({
  args: { waitlistId: v.id("waitlist"), token: v.string() },
  handler: async (ctx, { waitlistId, token }) => {
    const adminId = await requireAdmin(ctx);
    const entry = await ctx.db.get(waitlistId);
    if (!entry) throw new ConvexError("This person is no longer on the waitlist.");
    const email = entry.email.toLowerCase();
    const now = Date.now();
    let invite = (await ctx.db.query("invites").withIndex("by_email", (q) => q.eq("email", email)).collect())
      .find((i) => !i.usedBy && i.expiresAt > now)
      ?? (await ctx.db.query("invites").order("desc").take(1000)).find((i) => !i.usedBy && i.expiresAt > now && i.label.toLowerCase() === email);
    if (invite) {
      if (!invite.email) await ctx.db.patch(invite._id, { email });
    } else {
      if (!TOKEN.test(token)) throw new ConvexError("Invalid invite token.");
      if (await ctx.db.query("invites").withIndex("by_token", (q) => q.eq("token", token)).unique()) throw new ConvexError("Please try again.");
      const id = await ctx.db.insert("invites", { token, label: email, email, role: entry.role, invitedBy: adminId, createdAt: now, expiresAt: now + INVITE_DAYS * 86_400_000 });
      invite = (await ctx.db.get(id))!;
    }
    const sent = await queueInviteEmail(ctx, invite._id, email);
    await logAdminAction(ctx, adminId, "invite_added", undefined,
      `Invite link for ${email} (${invite.role})${sent === "sending" ? ", emailed" : ""}`);
    return { token: invite.token, emailed: sent === "sending", note: sent === "sending" ? null : INVITE_EMAIL_NOTE[sent] };
  },
});

/** Schedules the invite email, within the per-person and daily limits. Returns what happened. */
async function queueInviteEmail(ctx: MutationCtx, inviteId: Id<"invites">, email: string): Promise<"sending" | "not_set_up" | "limit_person" | "limit_day"> {
  if (!emailConfigured()) return "not_set_up";
  if (!(await tryTake(ctx, "inviteEmailPerAddress", email))) return "limit_person";
  if (!(await tryTake(ctx, "inviteEmailsDaily", ""))) return "limit_day";
  const at = Date.now();
  await ctx.db.patch(inviteId, { emailStatus: "sending", emailedAt: at });
  await ctx.scheduler.runAfter(0, internal.access.sendInviteEmail, { inviteId, at });
  return "sending";
}

/** What the admin is told when an invite email couldn't go out (the link still works). */
const INVITE_EMAIL_NOTE = {
  not_set_up: "Email isn't set up yet, so copy the link or send it on WhatsApp.",
  limit_person: LIMITS.inviteEmailPerAddress.message,
  limit_day: LIMITS.inviteEmailsDaily.message,
} as const;

export const inviteForEmail = internalQuery({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, { inviteId }) => {
    const i = await ctx.db.get(inviteId);
    // Removed, used or expired since: nothing to send.
    if (!i?.email || i.usedBy || i.expiresAt <= Date.now()) return null;
    return { email: i.email, token: i.token, role: i.role, expiresAt: i.expiresAt };
  },
});

export const markInviteEmail = internalMutation({
  args: { inviteId: v.id("invites"), status: v.union(v.literal("sent"), v.literal("failed")) },
  handler: async (ctx, { inviteId, status }) => {
    if (await ctx.db.get(inviteId)) await ctx.db.patch(inviteId, { emailStatus: status });
  },
});

export const sendInviteEmail = internalAction({
  args: { inviteId: v.id("invites"), at: v.number() },
  handler: async (ctx, { inviteId, at }) => {
    const i = await ctx.runQuery(internal.access.inviteForEmail, { inviteId });
    if (!i) return;
    const days = Math.max(1, Math.round((i.expiresAt - Date.now()) / 86_400_000));
    try {
      await sendEmail({
        to: i.email,
        subject: "Your Kalorax invite is here 🎉",
        content: inviteEmail(i.role, i.token, days),
        // One per send the admin asks for (a resend is a new email; a retry of the same one isn't).
        idempotencyKey: `invite/${inviteId}/${at}`,
      });
      await ctx.runMutation(internal.access.markInviteEmail, { inviteId, status: "sent" });
    } catch {
      await ctx.runMutation(internal.access.markInviteEmail, { inviteId, status: "failed" });
    }
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
          emailStatus: i.emailStatus ?? null,
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

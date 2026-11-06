import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type Ctx = QueryCtx | MutationCtx;

export const PRIVATE_MESSAGE = "Kalorax is invite-only for now. Join the waitlist on the home page and we'll let you in soon.";

/** Signed-in user, who may use the app (in private mode: a confirmed admin, or an account that used an invite link). */
export async function requireUser(ctx: Ctx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Please sign in.");
  if (!(await hasAccess(ctx, userId))) throw new ConvexError(PRIVATE_MESSAGE);
  return userId;
}

export const adminEmails = () =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export const accessConfig = (ctx: Ctx) => ctx.db.query("appConfig").withIndex("by_key", (q) => q.eq("key", "access")).unique();

/**
 * Admins are listed by email in the ADMIN_EMAILS environment variable (comma-separated). Once the admin list
 * is locked (see appConfig.adminIds), the account must also be a confirmed admin.
 */
export async function isAdmin(ctx: Ctx, userId: Id<"users">): Promise<boolean> {
  const user = await ctx.db.get(userId);
  if (!user?.email || !adminEmails().includes(user.email.toLowerCase())) return false;
  const confirmed = (await accessConfig(ctx))?.adminIds;
  return confirmed === undefined || confirmed.includes(userId);
}

/** Private mode (admins only switch it); off unless turned on. */
export async function isPrivateMode(ctx: Ctx): Promise<boolean> {
  return !!(await accessConfig(ctx))?.privateMode;
}

/** May this account use the app right now? In private mode: confirmed admins and accounts that used an invite. */
export async function hasAccess(ctx: Ctx, userId: Id<"users">): Promise<boolean> {
  if (!(await isPrivateMode(ctx))) return true;
  if (await isAdmin(ctx, userId)) return true;
  return !!(await ctx.db.query("invites").withIndex("by_used_by", (q) => q.eq("usedBy", userId)).first());
}

/** A usable invite for this token, or null (unknown, already used, or expired). */
export async function openInvite(ctx: Ctx, token: unknown) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{32,64}$/.test(token)) return null;
  const invite = await ctx.db.query("invites").withIndex("by_token", (q) => q.eq("token", token)).unique();
  return invite && !invite.usedBy && invite.expiresAt > Date.now() ? invite : null;
}

export async function requireAdmin(ctx: Ctx): Promise<Id<"users">> {
  const userId = await requireUser(ctx);
  if (!(await isAdmin(ctx, userId))) throw new ConvexError("Admins only.");
  return userId;
}

export async function getProfile(ctx: Ctx, userId: Id<"users">) {
  return ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function checkDate(date: string) {
  if (!DATE.test(date)) throw new ConvexError(`Invalid date: ${date}`);
}

export function checkRange(value: number, min: number, max: number, name: string) {
  if (!Number.isFinite(value) || value < min || value > max) throw new ConvexError(`${name} must be between ${min} and ${max}.`);
}

export function checkText(text: string, max: number, name: string) {
  if (text.length > max) throw new ConvexError(`${name} is too long (max ${max} characters).`);
}

/** Load a row and make sure it belongs to the signed-in user. */
export async function ownRow<T extends "diary" | "events" | "exercises">(ctx: MutationCtx, table: T, id: Id<T>, userId: Id<"users">) {
  const normalized = ctx.db.normalizeId(table, id);
  const row = normalized && (await ctx.db.get(normalized));
  if (!row || row.userId !== userId) throw new ConvexError("Not found.");
  return row;
}

export type AdminAction =
  | "verification_approved" | "verification_rejected" | "payout_recorded" | "waitlist_exported"
  | "private_mode_on" | "private_mode_off" | "invite_added" | "invite_removed" | "admin_confirmed" | "beta_email_started";

/** Records an admin action in the audit log. Call it in the same mutation as the action, so both happen or neither does. */
export async function logAdminAction(ctx: MutationCtx, adminId: Id<"users">, action: AdminAction, subjectId: Id<"users"> | undefined, detail: string) {
  await ctx.db.insert("adminLog", { adminId, action, subjectId, detail: detail.slice(0, 300), at: Date.now() });
}

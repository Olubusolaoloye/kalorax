import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type Ctx = QueryCtx | MutationCtx;

export async function requireUser(ctx: Ctx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Please sign in.");
  return userId;
}

/** Admins are listed by email in the ADMIN_EMAILS environment variable (comma-separated). */
export async function isAdmin(ctx: Ctx, userId: Id<"users">): Promise<boolean> {
  const user = await ctx.db.get(userId);
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return !!user?.email && admins.includes(user.email.toLowerCase());
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

export type AdminAction = "verification_approved" | "verification_rejected" | "payout_recorded" | "waitlist_exported";

/** Records an admin action in the audit log. Call it in the same mutation as the action, so both happen or neither does. */
export async function logAdminAction(ctx: MutationCtx, adminId: Id<"users">, action: AdminAction, subjectId: Id<"users"> | undefined, detail: string) {
  await ctx.db.insert("adminLog", { adminId, action, subjectId, detail: detail.slice(0, 300), at: Date.now() });
}

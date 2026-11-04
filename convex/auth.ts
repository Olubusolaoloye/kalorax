import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { DataModel, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { emailHasAccess, PRIVATE_MESSAGE } from "./helpers";
import { PasswordReset } from "./passwordReset";

/**
 * Same as Convex Auth's default for password accounts, plus: in private mode, only admins and
 * invited emails can create a new account.
 */
export async function createOrUpdateUser(
  ctx: MutationCtx,
  { existingUserId, profile }: { existingUserId: Id<"users"> | null; profile: Record<string, unknown> & { email?: string; emailVerified?: boolean; phoneVerified?: boolean } },
): Promise<Id<"users">> {
  const { emailVerified, phoneVerified: _phone, ...data } = profile;
  const user = { ...(emailVerified ? { emailVerificationTime: Date.now() } : {}), ...(data as { email?: string }) };
  if (existingUserId) {
    await ctx.db.patch(existingUserId, user);
    return existingUserId;
  }
  if (!(await emailHasAccess(ctx, user.email))) throw new ConvexError(PRIVATE_MESSAGE);
  return ctx.db.insert("users", user);
}

// Email + password, with password reset by emailed code. Phone OTP can be added later with an SMS provider (e.g. Termii).
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password<DataModel>({ reset: PasswordReset })],
  callbacks: {
    createOrUpdateUser: (ctx, args) =>
      createOrUpdateUser(ctx as unknown as MutationCtx, { ...args, existingUserId: args.existingUserId as Id<"users"> | null }),
  },
});

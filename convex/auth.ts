import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { DataModel, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { isPrivateMode, openInvite, PRIVATE_MESSAGE } from "./helpers";
import { PasswordReset } from "./passwordReset";

type Profile = Record<string, unknown> & { email?: string; emailVerified?: boolean; phoneVerified?: boolean; inviteToken?: unknown };

/**
 * Same as Convex Auth's default for password accounts, plus: in private mode, a new account needs an
 * unused invite link (its token comes in with the sign-up). Sign-ups aren't email-verified, so an email
 * address alone never lets anyone in, admin addresses included.
 */
export async function createOrUpdateUser(
  ctx: MutationCtx,
  { existingUserId, profile }: { existingUserId: Id<"users"> | null; profile: Profile },
): Promise<Id<"users">> {
  const { emailVerified, phoneVerified: _phone, inviteToken, ...data } = profile;
  const user = { ...(emailVerified ? { emailVerificationTime: Date.now() } : {}), ...(data as { email?: string }) };
  if (existingUserId) {
    await ctx.db.patch(existingUserId, user);
    return existingUserId;
  }
  if (!(await isPrivateMode(ctx))) return ctx.db.insert("users", user);
  const invite = await openInvite(ctx, inviteToken);
  if (!invite) throw new ConvexError(PRIVATE_MESSAGE);
  const userId = await ctx.db.insert("users", user);
  await ctx.db.patch(invite._id, { usedBy: userId, usedAt: Date.now() });
  return userId;
}

// Email + password, with password reset by emailed code. Phone OTP can be added later with an SMS provider (e.g. Termii).
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
      reset: PasswordReset,
      // Default profile (the email as typed), plus the invite token from /join/<token> when there is one.
      profile: (params) =>
        ({ email: params.email as string, ...(typeof params.inviteToken === "string" ? { inviteToken: params.inviteToken } : {}) }) as { email: string },
    }),
  ],
  callbacks: {
    createOrUpdateUser: (ctx, args) =>
      createOrUpdateUser(ctx as unknown as MutationCtx, { existingUserId: args.existingUserId as Id<"users"> | null, profile: args.profile }),
  },
});

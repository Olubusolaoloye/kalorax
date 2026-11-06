import { Email } from "@convex-dev/auth/providers/Email";
import type { GenericActionCtx } from "convex/server";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { sendEmail } from "./email";
import { LIMITS, type LimitName } from "./rateLimit";

/** 8-digit code, from a secure random source. */
function code(): string {
  const n = new Uint32Array(2);
  crypto.getRandomValues(n);
  return String((n[0] * 2 ** 32 + n[1]) % 100_000_000).padStart(8, "0");
}

/**
 * Anyone can ask for a code for any address, so each kind of code is capped per address (nobody's inbox gets
 * flooded) and overall (cost, and the daily email quota). Convex Auth passes its action context as a second
 * argument (its types don't declare it yet); without it the limits can't be checked, so no email goes out.
 */
async function checkLimits(rest: unknown[], email: string, perEmail: LimitName, overall: LimitName) {
  const ctx = rest[0] as GenericActionCtx<DataModel> | undefined;
  if (!ctx?.runMutation) throw new Error("Email codes are unavailable right now.");
  for (const [name, scope] of [[perEmail, email.toLowerCase()], [overall, ""]] as const) {
    if (!(await ctx.runMutation(internal.rateLimit.takeInternal, { name, scope }))) throw new ConvexError(LIMITS[name].message);
  }
}

/** Emails a password-reset code (Resend; see email.ts). */
export const PasswordReset = Email({
  id: "password-reset",
  maxAge: 15 * 60,
  async generateVerificationToken() {
    return code();
  },
  async sendVerificationRequest({ identifier: email, token }, ...rest: unknown[]) {
    if (!process.env.AUTH_RESEND_KEY) throw new Error("Password reset email isn't set up yet.");
    await checkLimits(rest, email, "passwordResetPerEmail", "passwordResetGlobal");
    await sendEmail({
      to: email,
      subject: `Your Kalorax reset code: ${token}`,
      text: `Your Kalorax password reset code is ${token}.\n\nIt expires in 15 minutes. If you didn't ask to reset your password, you can ignore this email.`,
      idempotencyKey: `reset/${email.toLowerCase()}/${token}`,
    });
  },
});

/** Emails the code that confirms a new account's address (only while REQUIRE_EMAIL_VERIFICATION=true; see auth.ts). */
export const EmailVerification = Email({
  id: "email-verification",
  maxAge: 30 * 60,
  async generateVerificationToken() {
    return code();
  },
  async sendVerificationRequest({ identifier: email, token }, ...rest: unknown[]) {
    if (!process.env.AUTH_RESEND_KEY) throw new Error("Email verification isn't set up yet.");
    await checkLimits(rest, email, "verifyCodePerEmail", "verifyCodeGlobal");
    await sendEmail({
      to: email,
      subject: `Your Kalorax code: ${token}`,
      text: `Welcome to Kalorax! Your code to confirm this email is ${token}.\n\nIt expires in 30 minutes. If you didn't create a Kalorax account, you can ignore this email.`,
      idempotencyKey: `verify/${email.toLowerCase()}/${token}`,
    });
  },
});

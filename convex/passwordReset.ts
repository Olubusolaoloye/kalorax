import { Email } from "@convex-dev/auth/providers/Email";
import type { GenericActionCtx } from "convex/server";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { LIMITS } from "./rateLimit";

/** 8-digit code, from a secure random source. */
function code(): string {
  const n = new Uint32Array(2);
  crypto.getRandomValues(n);
  return String((n[0] * 2 ** 32 + n[1]) % 100_000_000).padStart(8, "0");
}

/**
 * Emails a password-reset code via Resend (https://resend.com).
 * Needs AUTH_RESEND_KEY; AUTH_EMAIL_FROM defaults to "Kalorax <no-reply@kalorax.app>" (a domain verified in Resend).
 */
export const PasswordReset = Email({
  id: "password-reset",
  maxAge: 15 * 60,
  async generateVerificationToken() {
    return code();
  },
  // Convex Auth passes its action context as a second argument (its types don't declare it yet).
  async sendVerificationRequest({ identifier: email, token }, ...rest: unknown[]) {
    const key = process.env.AUTH_RESEND_KEY;
    if (!key) throw new Error("Password reset email isn't set up yet.");
    const ctx = rest[0] as GenericActionCtx<DataModel> | undefined;
    // Without it the limits below can't be checked, so no email goes out.
    if (!ctx?.runMutation) throw new Error("Password reset is unavailable right now.");
    // Anyone can ask for a code for any address: cap per address (so nobody's inbox gets flooded) and overall (cost).
    for (const [name, scope] of [["passwordResetPerEmail", email.toLowerCase()], ["passwordResetGlobal", ""]] as const) {
      if (!(await ctx.runMutation(internal.rateLimit.takeInternal, { name, scope }))) throw new ConvexError(LIMITS[name].message);
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.AUTH_EMAIL_FROM ?? "Kalorax <no-reply@kalorax.app>",
        to: [email],
        subject: `Your Kalorax reset code: ${token}`,
        text: `Your Kalorax password reset code is ${token}.\n\nIt expires in 15 minutes. If you didn't ask to reset your password, you can ignore this email.`,
      }),
    });
    if (!res.ok) throw new Error(`Could not send the reset email (${res.status}).`);
  },
});

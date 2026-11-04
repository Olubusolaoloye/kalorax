import { Email } from "@convex-dev/auth/providers/Email";

/** 8-digit code, from a secure random source. */
function code(): string {
  const n = new Uint32Array(2);
  crypto.getRandomValues(n);
  return String((n[0] * 2 ** 32 + n[1]) % 100_000_000).padStart(8, "0");
}

/**
 * Emails a password-reset code via Resend (https://resend.com).
 * Needs AUTH_RESEND_KEY; AUTH_EMAIL_FROM defaults to "Kalorax <no-reply@kalorax.ng>" (a domain verified in Resend).
 */
export const PasswordReset = Email({
  id: "password-reset",
  maxAge: 15 * 60,
  async generateVerificationToken() {
    return code();
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const key = process.env.AUTH_RESEND_KEY;
    if (!key) throw new Error("Password reset email isn't set up yet.");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.AUTH_EMAIL_FROM ?? "Kalorax <no-reply@kalorax.ng>",
        to: [email],
        subject: `Your Kalorax reset code: ${token}`,
        text: `Your Kalorax password reset code is ${token}.\n\nIt expires in 15 minutes. If you didn't ask to reset your password, you can ignore this email.`,
      }),
    });
    if (!res.ok) throw new Error(`Could not send the reset email (${res.status}).`);
  },
});

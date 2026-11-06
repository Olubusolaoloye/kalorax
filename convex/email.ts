// Sending email through Resend (https://resend.com). One place for the sender, retries and idempotency.
// Every email uses the branded layout in emailLayout.ts (HTML plus a plain-text version).
// Needs AUTH_RESEND_KEY (a sending-only key for mail.kalorax.app) and AUTH_EMAIL_FROM; AUTH_EMAIL_REPLY_TO is optional.

import { renderEmail, type EmailContent } from "./emailLayout";

export const DEFAULT_FROM = "Kalorax <hello@mail.kalorax.app>";
const RESEND = "https://api.resend.com/emails";
const ATTEMPTS = 3;

export const emailConfigured = () => !!process.env.AUTH_RESEND_KEY;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends one email. The idempotency key makes a retry (ours or Resend's) send it at most once within 24 hours,
 * so use one per attempt the person makes (e.g. per reset code), not per address. Retries network errors,
 * 5xx and 429 (respecting Retry-After) with backoff; other 4xx errors aren't retried. Returns Resend's email id.
 */
export async function sendEmail(m: { to: string; subject: string; content: EmailContent; idempotencyKey: string }): Promise<string> {
  const key = process.env.AUTH_RESEND_KEY;
  if (!key) throw new Error("Email isn't set up yet.");
  // The sending domain doesn't receive mail, so replies go to AUTH_EMAIL_REPLY_TO (a real inbox) when it's set.
  const replyTo = process.env.AUTH_EMAIL_REPLY_TO;
  const { html, text } = renderEmail(m.content);
  const body = JSON.stringify({ from: process.env.AUTH_EMAIL_FROM ?? DEFAULT_FROM, to: [m.to], subject: m.subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) });
  let last = "";
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(RESEND, {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": m.idempotencyKey.slice(0, 256) },
        body,
      });
    } catch (err) {
      last = (err as Error).name;
      if (attempt < ATTEMPTS) await sleep(500 * 2 ** attempt);
      continue;
    }
    if (res.ok) {
      const { id } = (await res.json()) as { id: string };
      console.log("email sent", id);
      return id;
    }
    last = String(res.status);
    if (res.status !== 429 && res.status < 500) break;
    if (attempt < ATTEMPTS) {
      const wait = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(wait) && wait > 0 ? Math.min(wait, 10) * 1000 : 500 * 2 ** attempt);
    }
  }
  console.error("email failed", last);
  throw new Error(`Could not send the email (${last}).`);
}

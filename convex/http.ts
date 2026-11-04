import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { auth } from "./auth";
import { readSnooze, SNOOZE_MS } from "./snooze";

const http = httpRouter();
auth.addHttpRoutes(http);

async function hmacSha512Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison of two hex strings. */
function sameHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Paystack webhook (set https://<deployment>.convex.site/paystack/webhook in the Paystack dashboard). */
http.route({
  path: "/paystack/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return new Response("Payments not configured", { status: 503 });
    const body = await req.text();
    const signature = req.headers.get("x-paystack-signature") ?? "";
    if (!sameHex(await hmacSha512Hex(secret, body), signature.toLowerCase())) return new Response("Bad signature", { status: 401 });
    const event = JSON.parse(body) as { event: string; data?: { reference?: string; amount?: number; currency?: string; status?: string } };
    if (event.event === "charge.success" && event.data?.reference && event.data.currency === "NGN" && typeof event.data.amount === "number") {
      const paid = { reference: event.data.reference, amountKobo: event.data.amount };
      if (paid.reference.startsWith("np_")) await ctx.runMutation(internal.pro.markPaid, paid);
      else await ctx.runMutation(internal.interventions.markPaid, paid);
    }
    return new Response("ok", { status: 200 });
  }),
});

/** "Snooze" on an alarm notification (posted by the service worker with the signed token from the push). */
http.route({
  path: "/reminders/snooze",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const cors = { "Access-Control-Allow-Origin": "*" };
    const secret = process.env.VAPID_PRIVATE_KEY;
    if (!secret) return new Response("Push not configured", { status: 503, headers: cors });
    const p = await readSnooze(secret, (await req.text()).trim().slice(0, 4000));
    if (!p) return new Response("Invalid or expired", { status: 400, headers: cors });
    const userId = p.u as Id<"users">;
    if (!(await ctx.runMutation(internal.reminders.claimSnooze, { userId, key: p.m.key, snoozes: p.n }))) return new Response("ok", { status: 200, headers: cors });
    const title = p.m.title.startsWith("⏰") ? p.m.title : `⏰ ${p.m.title}`;
    await ctx.scheduler.runAfter(SNOOZE_MS, internal.notify.snoozed, { userId, message: { ...p.m, title }, snoozes: p.n + 1 });
    return new Response("ok", { status: 200, headers: cors });
  }),
});

/** Real-user speed reports from browsers (navigator.sendBeacon from src/lib/vitals.ts). */
http.route({
  path: "/vitals",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await req.text();
    if (body.length <= 4000) {
      try {
        const reports = JSON.parse(body);
        if (Array.isArray(reports) && reports.length) await ctx.runMutation(internal.vitals.record, { reports: reports.slice(0, 10) });
      } catch {
        // Not JSON: ignore.
      }
    }
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
  }),
});

export default http;

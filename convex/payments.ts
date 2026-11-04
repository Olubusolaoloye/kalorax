// Paystack checkout for paid programmes (references nf_…) and Dietitian Pro (np_…).
// Env: PAYSTACK_SECRET_KEY (sk_test_… / sk_live_…) and SITE_URL (already set for Convex Auth).
// PAYMENTS_DEMO=true simulates a successful payment instead (for testing only; never in production).
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { PRO_MONTHS } from "./pro";

const PAYSTACK = "https://api.paystack.co";

function reference(prefix: "nf" | "np") {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `${prefix}_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

const siteUrl = () => (process.env.SITE_URL ?? "").replace(/\/$/, "");

/** Paystack call that gives up after 15 seconds, so a member is never left waiting on a hung request. */
async function paystackFetch(path: string, init: RequestInit) {
  try {
    return await fetch(`${PAYSTACK}${path}`, { ...init, signal: AbortSignal.timeout(15_000) });
  } catch (err) {
    console.error("paystack unreachable", path.split("/").slice(0, 3).join("/"), (err as Error).name);
    throw new ConvexError("We couldn't reach the payment service. Please check your connection and try again.");
  }
}

/** Starts a Paystack checkout and returns the page to send the member to. */
async function paystackCheckout(secret: string, t: { email: string; amountNaira: number; reference: string; callbackPath: string; metadata: Record<string, unknown> }) {
  const res = await paystackFetch("/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: t.email,
      amount: String(t.amountNaira * 100),
      currency: "NGN",
      reference: t.reference,
      callback_url: `${siteUrl()}${t.callbackPath}`,
      metadata: t.metadata,
    }),
  });
  const body = (await res.json()) as { status: boolean; message?: string; data?: { authorization_url: string } };
  if (!res.ok || !body.status || !body.data) {
    console.error("paystack initialize failed", res.status, body.message);
    throw new ConvexError("We couldn't start the payment. Please try again.");
  }
  return body.data.authorization_url;
}

/** Asks Paystack whether a payment went through; returns the amount in kobo, or null. */
async function paystackPaidKobo(secret: string, ref: string): Promise<number | null> {
  const res = await paystackFetch(`/transaction/verify/${encodeURIComponent(ref)}`, { headers: { Authorization: `Bearer ${secret}` } });
  const body = (await res.json()) as { data?: { status: string; amount: number; currency: string } };
  return res.ok && body.data?.status === "success" && body.data.currency === "NGN" ? body.data.amount : null;
}

export const startPayment = action({
  args: { enrolmentId: v.id("enrolments") },
  handler: async (ctx, { enrolmentId }): Promise<{ url?: string; demo?: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Please sign in.");
    const info = await ctx.runQuery(internal.interventions.paymentInfo, { enrolmentId, userId });
    if (info.status !== "pending_payment") throw new ConvexError("This programme is already paid for.");
    const ref = reference("nf");
    await ctx.runMutation(internal.interventions.setPaymentRef, { enrolmentId, reference: ref });

    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      if (process.env.PAYMENTS_DEMO === "true") {
        await ctx.runMutation(internal.interventions.markPaid, { reference: ref, amountKobo: info.priceNaira * 100, demo: true });
        return { demo: true };
      }
      throw new ConvexError("Payments aren't switched on yet. Please check back soon.");
    }
    if (!info.email) throw new ConvexError("Your account needs an email address to pay.");
    const url = await paystackCheckout(secret, {
      email: info.email, amountNaira: info.priceNaira, reference: ref, callbackPath: "/programmes/paid", metadata: { enrolmentId, programmeId: info.programmeId },
    });
    return { url };
  },
});

/** Called when Paystack sends the member back to the app. The webhook does the same thing in the background. */
export const verifyPayment = action({
  args: { reference: v.string() },
  handler: async (ctx, { reference: ref }): Promise<"activated" | "already_active" | "unknown" | "amount_mismatch" | "not_paid"> => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new ConvexError("Payments aren't switched on yet.");
    if (!/^nf_[0-9a-f]{24}$/.test(ref)) return "unknown";
    const kobo = await paystackPaidKobo(secret, ref);
    if (kobo === null) return "not_paid";
    return ctx.runMutation(internal.interventions.markPaid, { reference: ref, amountKobo: kobo });
  },
});

/** Dietitian Pro: pay for 1, 3, 6 or 12 months. */
export const startProPayment = action({
  args: { months: v.number() },
  handler: async (ctx, { months }): Promise<{ url?: string; demo?: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Please sign in.");
    if (!(PRO_MONTHS as readonly number[]).includes(months)) throw new ConvexError("Choose 1, 3, 6 or 12 months.");
    const info = await ctx.runQuery(internal.pro.checkoutInfo, { userId });
    const amountNaira = info.priceNaira * months;
    const ref = reference("np");
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret && process.env.PAYMENTS_DEMO !== "true") throw new ConvexError("Payments aren't switched on yet. Pro is free until they are.");
    await ctx.runMutation(internal.pro.createPending, { userId, reference: ref, months, amountNaira });
    if (!secret) {
      await ctx.runMutation(internal.pro.markPaid, { reference: ref, amountKobo: amountNaira * 100, demo: true });
      return { demo: true };
    }
    if (!info.email) throw new ConvexError("Your account needs an email address to pay.");
    const url = await paystackCheckout(secret, { email: info.email, amountNaira, reference: ref, callbackPath: "/pro/paid", metadata: { kind: "pro", months } });
    return { url };
  },
});

export const verifyProPayment = action({
  args: { reference: v.string() },
  handler: async (ctx, { reference: ref }): Promise<"activated" | "already_active" | "unknown" | "amount_mismatch" | "not_paid"> => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new ConvexError("Payments aren't switched on yet.");
    if (!/^np_[0-9a-f]{24}$/.test(ref)) return "unknown";
    const kobo = await paystackPaidKobo(secret, ref);
    if (kobo === null) return "not_paid";
    return ctx.runMutation(internal.pro.markPaid, { reference: ref, amountKobo: kobo });
  },
});

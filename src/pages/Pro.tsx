// Dietitian Pro (accounts only): status and payment on Me, a paywall on the Workbench once Pro has ended,
// a banner on Clients, and the page Paystack returns to.
import { useAction, useQuery } from "convex/react";
import { BadgeCheck, Check, CreditCard, Sparkles } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Card, SkeletonPage } from "../components/ui";
import { errorText } from "../lib/errors";
import { fmt } from "../state/derived";
import { useStore } from "../state/store";

const MONTHS = [1, 3, 6, 12] as const;
const DAY_MS = 86_400_000;
const day = (ms: number) => new Date(ms).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
const daysLeft = (ms: number) => Math.max(0, Math.ceil((ms - Date.now()) / DAY_MS));

type ProStatus = NonNullable<ReturnType<typeof useProStatus>>;
const useProStatus = () => useQuery(api.pro.status);

function statusLine(s: ProStatus) {
  if (!s.live) return "Free during early access. Billing starts once payments are switched on.";
  if (!s.active) return `Your Pro ended on ${day(s.until)}.`;
  if (s.onTrial) return `Free trial: ${daysLeft(s.trialEndsAt)} days left (until ${day(s.trialEndsAt)}).`;
  return `Active until ${day(s.until)}.`;
}

/** Choose how many months and pay with Paystack. */
function PayPro({ s }: { s: ProStatus }) {
  const start = useAction(api.payments.startProPayment);
  const navigate = useNavigate();
  const [months, setMonths] = useState<(typeof MONTHS)[number]>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!s.live) return null;
  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await start({ months });
      if (res.url) window.location.assign(res.url);
      else navigate("/pro/paid?demo=1");
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };
  return (
    <div className="pro-pay">
      <div className="seg seg-pill" role="radiogroup" aria-label="How many months">
        {MONTHS.map((m) => (
          <button key={m} role="radio" aria-checked={months === m} className={months === m ? "on" : ""} onClick={() => setMonths(m)}>
            {m === 1 ? "1 month" : `${m} months`}
          </button>
        ))}
      </div>
      <button className="btn btn-primary" disabled={busy} onClick={pay}>
        <CreditCard size={17} /> {busy ? "Opening Paystack…" : `Pay ₦${fmt(s.priceNaira * months)}`}
      </button>
      <p className="small muted">
        Card, bank transfer or USSD via Paystack. Nothing renews automatically{s.active ? `; the new months start after ${day(s.until)}` : ""}.
      </p>
      {error && <p className="small error" role="alert">{error}</p>}
    </div>
  );
}

/** On Me, for verified dietitians with an account. */
export function CloudProCard() {
  const s = useProStatus();
  if (!s) return null;
  return (
    <Card title={<span className="row"><BadgeCheck size={18} /> Dietitian Pro</span>} className="card-accent">
      <p className={`small${s.active ? "" : " error"}`} style={{ marginTop: 0 }}>{statusLine(s)}</p>
      <ul className="pro-perks small">
        <li><Check size={14} aria-hidden /> Professional Workbench and reports</li>
        <li><Check size={14} aria-hidden /> Listed on Programmes, so new members can book you</li>
        <li><Check size={14} aria-hidden /> ₦{fmt(s.priceNaira)} a month after your 30-day free trial</li>
      </ul>
      <PayPro s={s} />
      {s.history.length > 0 && (
        <details className="small">
          <summary>Payment history</summary>
          <ul className="pro-history">
            {s.history.map((p) => (
              <li key={p.paidAt}>{day(Date.parse(p.paidAt))} · {p.months} {p.months === 1 ? "month" : "months"} · ₦{fmt(p.amountNaira)}{p.demo ? " (test)" : ""}</li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

/** On Clients: a nudge when Pro is ending or has ended (existing clients keep working either way). */
export function CloudProBanner() {
  const s = useProStatus();
  if (!s || !s.live) return null;
  if (!s.active)
    return (
      <div className="banner banner-warn" role="status">
        Your Pro has ended, so new members can't book you. You can keep working with your current clients. <Link to="/me" className="link">Renew Pro</Link>
      </div>
    );
  const left = daysLeft(s.until);
  if (left > 5) return null;
  return (
    <div className="banner banner-info" role="status">
      Your Pro {s.onTrial ? "trial " : ""}ends in {left} {left === 1 ? "day" : "days"}. <Link to="/me" className="link">Keep Pro</Link>
    </div>
  );
}

function CloudProGate({ children }: { children: ReactNode }) {
  const s = useProStatus();
  if (s === undefined) return <SkeletonPage />;
  if (!s || s.active) return <>{children}</>;
  return (
    <div className="page">
      <div className="card card-warm locked">
        <span className="lock-icon" aria-hidden><Sparkles size={24} /></span>
        <h2>Renew Dietitian Pro</h2>
        <p>{statusLine(s)} Renew to use the Workbench and to be listed on Programmes again. Your current clients aren't affected.</p>
        <PayPro s={s} />
      </div>
    </div>
  );
}

/** Wraps Pro-only pages: dietitians with an account need an active Pro (students and on-device use are unaffected). */
export function ProGate({ children }: { children: ReactNode }) {
  const { mode, profile } = useStore();
  if (mode !== "cloud" || profile?.role !== "dietitian" || profile.verification !== "verified") return <>{children}</>;
  return <CloudProGate>{children}</CloudProGate>;
}

/** Paystack sends the dietitian back here. */
export function ProPaymentReturn() {
  const [params] = useSearchParams();
  const verify = useAction(api.payments.verifyProPayment);
  const reference = params.get("reference") ?? params.get("trxref") ?? "";
  const demo = params.get("demo") === "1";
  const [state, setState] = useState<"checking" | "ok" | "failed">(demo ? "ok" : "checking");
  useEffect(() => {
    if (demo) return;
    if (!reference) return setState("failed");
    verify({ reference })
      .then((r) => setState(r === "activated" || r === "already_active" ? "ok" : "failed"))
      .catch(() => setState("failed"));
  }, [reference, demo, verify]);
  return (
    <div className="page">
      <div className="card empty-state">
        {state === "checking" && <><CreditCard size={30} aria-hidden /><h2>Confirming your payment…</h2></>}
        {state === "ok" && (
          <>
            <Check size={30} aria-hidden />
            <h2>Thank you, your Pro is active</h2>
            <p className="muted">The Workbench is ready, and members can book your programmes.</p>
            <div className="row" style={{ justifyContent: "center" }}>
              <Link to="/workbench" className="btn btn-primary">Open Workbench</Link>
              <Link to="/me" className="btn btn-secondary">See my Pro</Link>
            </div>
          </>
        )}
        {state === "failed" && (
          <>
            <h2>We couldn't confirm the payment yet</h2>
            <p className="muted">If you were charged, your Pro updates within a few minutes. You can check on Me.</p>
            <Link to="/me" className="btn btn-primary">Go to Me</Link>
          </>
        )}
      </div>
    </div>
  );
}

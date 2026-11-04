import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Logo } from "../components/Logo";

/** forgot: ask for a reset code. reset: enter the code and a new password. */
type Flow = "signIn" | "signUp" | "forgot" | "reset";

const TIMEOUT_MS = 20000;

/** Reject if the server doesn't answer in time (e.g. no connection), so the button never hangs. */
function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS))]);
}

/** Turn Convex Auth errors into plain language. */
function friendly(err: unknown, flow: Flow): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/invite-only/i.test(msg)) return "Kalorax is invite-only for now. If you were invited, use the email address the invite was sent to; otherwise join the waitlist on the home page.";
  if (/already exists/i.test(msg)) return "An account with this email already exists. Try signing in.";
  if (/isn't set up/i.test(msg)) return "Password reset isn't available yet. Please contact hello@kalorax.ng.";
  if (flow === "reset" && /InvalidSecret|code|expired|verif/i.test(msg)) return "That code is wrong or has expired. Check the email or ask for a new code.";
  if (/InvalidSecret|InvalidAccountId|Invalid password|could not/i.test(msg))
    return flow === "signIn" ? "That email and password don't match. Please try again." : "We couldn't create your account. Please try again.";
  if (/password/i.test(msg)) return "Please use a password of at least 8 characters.";
  if (/rate|too many/i.test(msg)) return "Too many attempts. Please wait a minute and try again.";
  if (msg === "timeout") return "We can't reach Kalorax right now. Check your internet connection and try again.";
  return "Something went wrong. Please check your connection and try again.";
}

export function Auth() {
  const { signIn } = useAuthActions();
  const [params] = useSearchParams();
  const [flow, setFlow] = useState<Flow>(params.get("mode") === "signup" ? "signUp" : "signIn");
  // An invite link carries the invited address (…/auth?mode=signup&email=…).
  const [email, setEmail] = useState(() => params.get("email") ?? "");
  const privateMode = useQuery(api.access.status)?.privateMode ?? false;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  /** Creating an account or setting a new password: ask for it twice so a typo can't lock you out. */
  const choosing = flow === "signUp" || flow === "reset";
  const [info, setInfo] = useState<string | null>(null);
  const go = (next: Flow) => {
    setFlow(next);
    setError(null);
    setInfo(null);
    setPassword("");
    setConfirm("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (choosing && password.length < 8) {
      setError("Please use a password of at least 8 characters.");
      return;
    }
    if (choosing && password !== confirm) {
      setError("The passwords don't match. Please type the same password in both boxes.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("email", email.trim().toLowerCase());
      if (flow === "forgot") {
        form.set("flow", "reset");
        try {
          await withTimeout(signIn("password", form));
        } catch (err) {
          // Don't reveal whether an account exists; only surface setup and connection problems.
          const m = friendly(err, flow);
          if (/available yet|reach Kalorax|Too many/.test(m)) throw err;
        }
        setFlow("reset");
        setPassword("");
        setConfirm("");
        setInfo("If there's a Kalorax account for this email, we've sent it an 8-digit code. It expires in 15 minutes.");
        setBusy(false);
        return;
      }
      if (flow === "reset") {
        form.set("flow", "reset-verification");
        form.set("code", code.trim());
        form.set("newPassword", password);
      } else {
        form.set("password", password);
        form.set("flow", flow);
      }
      await withTimeout(signIn("password", form));
      // Routing moves you on once the session is active.
    } catch (err) {
      setError(friendly(err, flow));
      setBusy(false);
    }
  };

  const recovering = flow === "forgot" || flow === "reset";
  const heading = { signIn: "Welcome back", signUp: "Create your account", forgot: "Reset your password", reset: "Choose a new password" }[flow];
  const lead = {
    signIn: "Sign in to pick up where you left off.",
    signUp: "Save your meals, plans and progress across your devices.",
    forgot: "Enter your email and we'll send you a code to reset your password.",
    reset: `Enter the code we emailed to ${email.trim() || "you"} and a new password.`,
  }[flow];
  const button = { signIn: "Sign in", signUp: "Create account", forgot: "Email me a code", reset: "Save password & sign in" }[flow];

  return (
    <div className="onboarding">
      <Link to="/" className="landing-brand" style={{ marginBottom: "1rem", textDecoration: "none", color: "inherit" }}>
        <Logo size={30} />
      </Link>
      <div className="onboarding-card">
        {recovering && (
          <button type="button" className="link-btn small auth-back" onClick={() => go("signIn")}>
            <ArrowLeft size={15} /> Back to sign in
          </button>
        )}
        <h1 style={{ marginBottom: "0.4rem" }}>{heading}</h1>
        <p className="muted" style={{ marginTop: 0 }}>{lead}</p>
        {!recovering && (
          <div className="seg" role="tablist" aria-label="Account" style={{ margin: "1.25rem 0 0.5rem" }}>
            <button role="tab" aria-selected={flow === "signIn"} className={flow === "signIn" ? "on" : ""} onClick={() => go("signIn")}>Sign in</button>
            <button role="tab" aria-selected={flow === "signUp"} className={flow === "signUp" ? "on" : ""} onClick={() => go("signUp")}>Create account</button>
          </div>
        )}
        {privateMode && flow === "signUp" && (
          <p className="banner banner-info small" role="status">Kalorax is invite-only for now. Create your account with the email address you were invited with.</p>
        )}
        {info && <p className="banner banner-info small" role="status">{info}</p>}
        <form onSubmit={submit}>
          {flow !== "reset" && (
            <label className="field">
              <span>Email</span>
              <div className="input-icon">
                <Mail size={17} aria-hidden />
                <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
            </label>
          )}
          {flow === "reset" && (
            <label className="field">
              <span>Reset code</span>
              <div className="input-icon">
                <KeyRound size={17} aria-hidden />
                <input inputMode="numeric" autoComplete="one-time-code" required maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="8-digit code" />
              </div>
            </label>
          )}
          {flow !== "forgot" && (
          <label className="field">
            <span className="row" style={{ justifyContent: "space-between" }}>
              {flow === "reset" ? "New password" : "Password"}
              {flow === "signIn" && <button type="button" className="link-btn small" onClick={() => go("forgot")}>Forgot password?</button>}
            </span>
            <div className="input-icon">
              <Lock size={17} aria-hidden />
              <input
                type={show ? "text" : "password"}
                autoComplete={flow === "signIn" ? "current-password" : "new-password"}
                required
                minLength={flow === "signIn" ? undefined : 8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={flow === "signIn" ? "Your password" : "At least 8 characters"}
              />
              <button type="button" className="icon-btn sm ghost input-trail" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          )}
          {choosing && (
            <label className="field">
              <span>Confirm {flow === "reset" ? "new password" : "password"}</span>
              <div className="input-icon">
                <Lock size={17} aria-hidden />
                <input
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Type it again"
                  aria-invalid={confirm.length > 0 && confirm !== password}
                />
              </div>
              {!error && confirm.length > 0 && confirm !== password && <span className="error small">Doesn't match yet.</span>}
            </label>
          )}
          {error && <p className="error small" role="alert">{error}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Please wait…" : button}
          </button>
          {flow === "reset" && (
            <button type="button" className="link-btn small auth-resend" onClick={() => go("forgot")}>Didn't get a code? Send another</button>
          )}
        </form>
        <p className="muted small center" style={{ marginTop: "1rem" }}>
          Your health data is private and protected under the Nigeria Data Protection Act.
        </p>
      </div>
    </div>
  );
}

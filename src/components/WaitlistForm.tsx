import { useMutation, useQuery } from "convex/react";
import { Check, Copy, Share2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";

type Role = "member" | "student" | "dietitian";

const CODE_KEY = "kalorax.waitlist.code";
const REF_KEY = "kalorax.waitlist.ref";
const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string | null) => {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* private mode */ }
};

/** The friend's code from a share link (/?ref=CODE), kept until this person joins. */
function useReferralCode() {
  const [ref] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("ref")?.trim().toLowerCase() ?? "";
    if (/^[a-z2-9]{8}$/.test(fromUrl)) write(REF_KEY, fromUrl);
    return read(REF_KEY);
  });
  return ref;
}

/** Landing-page waitlist (cloud mode only). After joining: your place in line and your invite link. */
export function WaitlistForm() {
  const join = useMutation(api.waitlist.join);
  const confirmEmail = useMutation(api.waitlist.confirm);
  const ref = useReferralCode();
  const [code, setCode] = useState<string | null>(() => read(CODE_KEY));
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");

  // The confirm link from the welcome email (/?confirm=TOKEN): confirm once, then show their place in line.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("confirm");
    if (!token) return;
    params.delete("confirm");
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
    void confirmEmail({ token }).then((r) => {
      if (r.ok && r.code) { write(CODE_KEY, r.code); setCode(r.code); }
      setNote(r.ok ? "Email confirmed. You're on the list!" : "That confirm link isn't valid. Try joining again with your email.");
    });
  }, [confirmEmail]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState("busy");
    try {
      const res = await join({ email, role, ref: ref ?? undefined });
      write(CODE_KEY, res.code);
      write(REF_KEY, null);
      setNote(res.alreadyJoined ? "You're already on the list." : res.emailed ? "You're on the list! Check your email to confirm it." : "You're on the list!");
      setCode(res.code);
      setState("idle");
    } catch (err) {
      setMessage(err instanceof Error ? err.message.replace(/^.*ConvexError: /, "").replace(/\s*Called by client$/, "") : "Something went wrong.");
      setState("error");
    }
  };

  if (code) return <WaitlistStatus code={code} note={note} onReset={() => { write(CODE_KEY, null); setCode(null); setNote(""); }} />;

  return (
    <form className="lp-waitlist" onSubmit={submit}>
      {ref && <p className="lp-ref-note small">A friend invited you. Joining moves them up the list too.</p>}
      <label className="sr-only" htmlFor="wl-email">Email</label>
      <input id="wl-email" type="email" required autoComplete="email" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label className="sr-only" htmlFor="wl-role">I am</label>
      <select id="wl-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
        <option value="member">I want to eat better</option>
        <option value="student">I'm a nutrition student</option>
        <option value="dietitian">I'm a dietitian</option>
      </select>
      <button className="lp-btn lp-btn-dark" disabled={state === "busy"}>{state === "busy" ? "Joining…" : "Join the waitlist"}</button>
      {state === "error" && <p className="error small" role="alert">{message}</p>}
    </form>
  );
}

/** Place in line, invite progress and the share link. Updates live as friends join. */
function WaitlistStatus({ code, note, onReset }: { code: string; note: string; onReset: () => void }) {
  const s = useQuery(api.waitlist.status, { code });
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (s === null) onReset(); }, [s, onReset]);
  if (!s) return <p className="lp-waitlist-done"><Check size={18} aria-hidden /> {note || "You're on the list."}</p>;

  const link = `${window.location.origin}/?ref=${code}`;
  const left = Math.max(0, s.goal - s.referrals);
  const shareText = `I'm on the Kalorax waitlist: calories, meal plans and an AI coach for the food you actually eat. Join with my link and we both move up: ${link}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* the link is still visible to copy by hand */ }
  };

  return (
    <div className="lp-referral" aria-live="polite">
      {note && <p className="lp-waitlist-done"><Check size={18} aria-hidden /> {note}</p>}
      <p className="lp-referral-place">
        {s.boosted ? <>You're in the <strong>first invite group</strong> 🎉</> : <>You're <strong>#{s.position.toLocaleString()}</strong> of {s.total.toLocaleString()} in line</>}
      </p>
      <div className="lp-referral-dots" aria-label={`${Math.min(s.referrals, s.goal)} of ${s.goal} friends joined`}>
        {Array.from({ length: s.goal }, (_, i) => <span key={i} className={i < s.referrals ? "on" : ""} />)}
      </div>
      <p className="small lp-referral-hint">
        {s.boosted
          ? `${s.referrals} friends joined with your link. Thank you! Keep sharing: everyone you bring gets in sooner too.`
          : `Invite ${left} more friend${left === 1 ? "" : "s"} to move up to the first invite group. Each friend counts once they confirm their email.`}
      </p>
      <div className="lp-referral-link">
        <label className="sr-only" htmlFor="wl-link">Your invite link</label>
        <input id="wl-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className="lp-btn lp-btn-dark" onClick={() => void copy()}><Copy size={16} aria-hidden /> {copied ? "Copied" : "Copy"}</button>
      </div>
      <a className="lp-btn lp-btn-lime lp-referral-wa" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">
        <Share2 size={16} aria-hidden /> Share on WhatsApp
      </a>
      <button type="button" className="lp-referral-reset small" onClick={onReset}>Not you? Join with another email</button>
    </div>
  );
}

import { useMutation } from "convex/react";
import { Check } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";

type Role = "member" | "student" | "dietitian";

/** Landing-page waitlist (cloud mode only). */
export function WaitlistForm() {
  const join = useMutation(api.waitlist.join);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState("busy");
    try {
      const res = await join({ email, role });
      setMessage(res.alreadyJoined ? "You're already on the list — we'll be in touch." : res.emailed ? "You're on the list! Look out for a welcome email." : "You're on the list! We'll email you at launch.");
      setState("done");
    } catch (err) {
      setMessage(err instanceof Error ? err.message.replace(/^.*ConvexError: /, "").replace(/\s*Called by client$/, "") : "Something went wrong.");
      setState("error");
    }
  };

  if (state === "done") return <p className="lp-waitlist-done"><Check size={18} aria-hidden /> {message}</p>;

  return (
    <form className="lp-waitlist" onSubmit={submit}>
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

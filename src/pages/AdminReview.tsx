import { useMutation, useQuery } from "convex/react";
import { Check, ExternalLink, FileText, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { errorText } from "../lib/errors";
import { fmt } from "../state/derived";
import { SkeletonLines } from "../components/ui";
export { VerificationQueue, Payouts };

/** Verification review queue. */
function VerificationQueue() {
  const pending = useQuery(api.verification.listPending);
  const review = useMutation(api.verification.review);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const decide = async (id: Id<"verifications">, decision: "verified" | "rejected") => {
    setBusy(id);
    try {
      await review({ id, decision, note: notes[id]?.trim() || undefined });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      {pending === undefined ? (
        <SkeletonLines />
      ) : pending.length === 0 ? (
        <div className="card empty-state">
          <ShieldCheck size={32} aria-hidden />
          <h2>All caught up</h2>
          <p className="muted">No verification requests waiting.</p>
        </div>
      ) : (
        <ul className="food-rows">
          {pending.map((r) => (
            <li key={r._id} className="card review-item">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <span className={`tag ${r.role === "dietitian" ? "tag-lunch" : "tag-breakfast"}`}>{r.role === "dietitian" ? "Dietitian" : "Student"}</span>
                  <h3 style={{ margin: "0.4rem 0 0.1rem" }}>{r.name ?? "Unnamed"}</h3>
                  <span className="muted small">{r.email} · submitted {new Date(r.submittedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                </div>
              </div>
              <dl className="details" style={{ margin: "0.75rem 0" }}>
                <dt>{r.role === "dietitian" ? "Licence no." : "Institution / matric"}</dt>
                <dd>{r.credential}</dd>
                <dt>Document</dt>
                <dd>
                  {r.documentUrl ? (
                    <a href={r.documentUrl} target="_blank" rel="noreferrer" className="link"><FileText size={14} aria-hidden /> Open file <ExternalLink size={12} aria-hidden /></a>
                  ) : (
                    <span className="muted">None uploaded</span>
                  )}
                </dd>
              </dl>
              <label className="field" style={{ margin: "0 0 0.75rem" }}>
                <span>Note to the applicant (shown if rejected)</span>
                <input value={notes[r._id] ?? ""} onChange={(e) => setNotes({ ...notes, [r._id]: e.target.value })} placeholder="e.g. Licence number not found on the register" />
              </label>
              <div className="row">
                <button className="btn btn-primary btn-small" disabled={busy === r._id} onClick={() => decide(r._id, "verified")}><Check size={15} /> Approve</button>
                <button className="btn btn-danger btn-small" disabled={busy === r._id} onClick={() => decide(r._id, "rejected")}><X size={15} /> Reject</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="sample-notice">
        Check licence numbers against the national dietetics register, and student details against the institution, before approving.
      </p>
    </div>
  );
}

/** What Kalorax owes each dietitian, and a record of bank transfers made. */
function Payouts() {
  const rows = useQuery(api.clients.payoutsOverview);
  const record = useMutation(api.clients.recordPayout);
  const [form, setForm] = useState<Record<string, { amount: string; reference: string }>>({});
  const [msg, setMsg] = useState<Record<string, string>>({});
  if (rows === undefined) return <SkeletonLines />;
  if (rows.length === 0) return <div className="card empty-state"><h2>No dietitian earnings yet</h2><p className="muted">Payouts appear here once members pay for programmes.</p></div>;
  return (
    <section>
      <div className="table-wrap card">
        <table className="table">
          <thead><tr><th>Dietitian</th><th>Earned</th><th>Paid</th><th>Owed</th><th>Account</th><th>Record transfer</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const f = form[r.dietitianId] ?? { amount: String(r.balanceNaira), reference: "" };
              return (
                <tr key={r.dietitianId}>
                  <td>{r.name}<br /><span className="muted small">{r.activeClients} active</span></td>
                  <td>₦{fmt(r.netNaira)}</td>
                  <td>₦{fmt(r.paidOutNaira)}</td>
                  <td><strong>₦{fmt(r.balanceNaira)}</strong></td>
                  <td className="small">{r.payout ? <>{r.payout.bankName}<br />{r.payout.accountNumber} · {r.payout.accountName}</> : <span className="muted">Not added</span>}</td>
                  <td>
                    {r.balanceNaira > 0 && (
                      <form
                        className="row"
                        onSubmit={(e) => {
                          e.preventDefault();
                          record({ dietitianId: r.dietitianId, amountNaira: Number(f.amount), reference: f.reference })
                            .then(() => setMsg({ ...msg, [r.dietitianId]: "Recorded" }))
                            .catch((err) => setMsg({ ...msg, [r.dietitianId]: errorText(err) }));
                        }}
                      >
                        <input style={{ width: "7rem" }} inputMode="numeric" value={f.amount} aria-label="Amount" onChange={(e) => setForm({ ...form, [r.dietitianId]: { ...f, amount: e.target.value.replace(/\D/g, "") } })} />
                        <input style={{ width: "9rem" }} value={f.reference} placeholder="Transfer ref" aria-label="Reference" onChange={(e) => setForm({ ...form, [r.dietitianId]: { ...f, reference: e.target.value } })} />
                        <button className="btn btn-secondary btn-small">Save</button>
                        {msg[r.dietitianId] && <span className="small muted">{msg[r.dietitianId]}</span>}
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

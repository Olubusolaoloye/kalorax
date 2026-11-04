import { ArrowLeft, CalendarCheck, CalendarRange, Check, ClipboardList, CreditCard, HeartPulse, MessageCircle, Pill, ShieldCheck, Target } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { DietitianInfo, Thread } from "../components/Thread";
import { Card, PageHeader, SampleNotice, Sheet, SkeletonLines, SkeletonPage } from "../components/ui";
import { PLATFORM_FEE_PERCENT, PROGRAMMES, programmeById, type Programme } from "../data/programmes";
import { errorText } from "../lib/errors";
import { intakeError, programmeEnd, programmeWeek, type Intake, type MemberEnrolment, type Offering } from "../lib/interventions";
import { CONDITION_LABEL, type Condition } from "../lib/nutrition";
import { fmt } from "../state/derived";
import { useInterventions } from "../state/interventions";
import { todayIso, useStore } from "../state/store";

const naira = (n: number) => `₦${fmt(n)}`;
const length = (p: Programme) => (p.weeks ? `${p.weeks} weeks` : "One session + 7 days chat");
const day = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
const STATUS_LABEL: Record<MemberEnrolment["status"], string> = {
  pending_payment: "Awaiting payment",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

function PreviewBanner() {
  const { mode } = useInterventions();
  return mode === "preview" ? (
    <div className="banner banner-info">
      Preview: these dietitians are samples and no payment is taken. Real, verified dietitians and Paystack checkout arrive with Nutrintel accounts.
    </div>
  ) : null;
}

function EnrolmentRow({ e }: { e: MemberEnrolment }) {
  const p = programmeById(e.programmeId)!;
  const week = programmeWeek(e.startDate, todayIso(), p.weeks);
  const unread = e.unread ?? 0;
  return (
    <Link to={`/my-programmes/${e.id}`} className="card enrolment-row">
      <span className="programme-emoji" aria-hidden>{p.emoji}</span>
      <div className="grow">
        <strong>{p.name}</strong>
        <span className="small muted">
          with {e.dietitian.name} · {STATUS_LABEL[e.status]}
          {e.status === "active" && week ? ` · week ${week}${p.weeks ? ` of ${p.weeks}` : ""}` : ""}
        </span>
      </div>
      {unread ? <span className="nav-badge">{unread}</span> : null}
      <span className="link small">Open →</span>
    </Link>
  );
}

export function Programmes() {
  const { profile } = useStore();
  const { catalogue, myEnrolments } = useInterventions();
  const conditions = profile?.conditions ?? [];
  const suggested = PROGRAMMES.filter((p) => p.forConditions.some((c) => conditions.includes(c)));
  const offersFor = (id: string) => (catalogue ?? []).filter((o) => o.programmeId === id);

  return (
    <div className="page page-wide">
      <PageHeader title="Programmes" subtitle="Work one-to-one with a verified dietitian on a plan made for you" />
      <PreviewBanner />

      {myEnrolments && myEnrolments.length > 0 && (
        <section>
          <h2 className="section-title">Your programmes</h2>
          <div className="stack">{myEnrolments.map((e) => <EnrolmentRow key={e.id} e={e} />)}</div>
        </section>
      )}

      <div className="card how-it-works">
        {[
          { icon: <ClipboardList size={18} />, title: "Tell us about you", text: "A short intake: goals, health and a typical day." },
          { icon: <CreditCard size={18} />, title: "Pay securely", text: "Card, bank transfer or USSD with Paystack." },
          { icon: <Target size={18} />, title: "Get your target & plan", text: "Your dietitian sets them from your logs." },
          { icon: <MessageCircle size={18} />, title: "Weekly check-ins", text: "Chat, progress reviews and adjustments." },
        ].map((s, i) => (
          <div key={s.title} className="how-step">
            <span className="how-num">{i + 1}</span>
            <span className="how-icon" aria-hidden>{s.icon}</span>
            <strong className="small">{s.title}</strong>
            <span className="small muted">{s.text}</span>
          </div>
        ))}
      </div>

      {suggested.length > 0 && <h2 className="section-title">Recommended for you</h2>}
      {suggested.length > 0 && <ProgrammeGrid list={suggested} offersFor={offersFor} />}
      <h2 className="section-title">{suggested.length ? "All programmes" : "Choose a programme"}</h2>
      <ProgrammeGrid list={PROGRAMMES.filter((p) => !suggested.includes(p))} offersFor={offersFor} />
      <SampleNotice>
        Programme descriptions are samples. Dietitians set their own prices; Nutrintel keeps {PLATFORM_FEE_PERCENT}% to run the platform.
      </SampleNotice>
    </div>
  );
}

function ProgrammeGrid({ list, offersFor }: { list: Programme[]; offersFor: (id: string) => Offering[] }) {
  return (
    <div className="programme-grid">
      {list.map((p) => {
        const offers = offersFor(p.id);
        const from = offers.length ? Math.min(...offers.map((o) => o.priceNaira)) : null;
        return (
          <Link key={p.id} to={`/programmes/${p.id}`} className="card programme-card">
            <span className="programme-emoji" aria-hidden>{p.emoji}</span>
            <strong>{p.name}</strong>
            <span className="small muted">{p.summary}</span>
            <div className="programme-meta">
              <span className="tag tag-outline">{length(p)}</span>
              <span className="small">
                {from ? <>from <strong>{naira(from)}</strong> · {offers.length} {offers.length === 1 ? "dietitian" : "dietitians"}</> : <span className="muted">No dietitians yet</span>}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export function ProgrammeDetail() {
  const { id = "" } = useParams();
  const p = programmeById(id);
  const { catalogue } = useInterventions();
  const [choosing, setChoosing] = useState<Offering | null>(null);
  if (!p) return <div className="page"><p>Programme not found. <Link to="/programmes" className="link">All programmes</Link></p></div>;
  const offers = (catalogue ?? []).filter((o) => o.programmeId === p.id).sort((a, b) => a.priceNaira - b.priceNaira);

  return (
    <div className="page page-wide">
      <Link to="/programmes" className="link-btn small back-link"><ArrowLeft size={15} /> All programmes</Link>
      <header className="programme-hero card">
        <span className="programme-emoji lg" aria-hidden>{p.emoji}</span>
        <div className="grow">
          <h1>{p.name}</h1>
          <p className="muted">{p.summary}</p>
          <div className="chip-row">
            <span className="tag tag-outline">{length(p)}</span>
            {p.forConditions.map((c) => <span key={c} className="tag">{CONDITION_LABEL[c]}</span>)}
          </div>
        </div>
      </header>
      <PreviewBanner />

      <div className="two-col programme-cols">
        <Card title="What's included">
          <ul className="check-list">
            {p.includes.map((x) => <li key={x}><Check size={16} aria-hidden /> {x}</li>)}
          </ul>
          <p className="small muted">
            Your dietitian sees your diary, water, weight and notes only while the programme runs, and only because you agree to it at sign-up.
          </p>
        </Card>
        <section>
          <h2 className="section-title">Choose your dietitian</h2>
          {catalogue === undefined ? (
            <SkeletonLines />
          ) : offers.length === 0 ? (
            <div className="card empty-state">
              <HeartPulse size={28} aria-hidden />
              <p className="muted">No dietitians offer this programme yet. Check back soon.</p>
            </div>
          ) : (
            <div className="stack">
              {offers.map((o) => (
                <div key={o.id} className="card offer-card">
                  <DietitianInfo d={o.dietitian}>
                    <div className="offer-price">
                      <strong>{naira(o.priceNaira)}</strong>
                      <button className="btn btn-primary btn-small" onClick={() => setChoosing(o)}>Choose</button>
                    </div>
                  </DietitianInfo>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      {choosing && <EnrolSheet programme={p} offering={choosing} onClose={() => setChoosing(null)} />}
    </div>
  );
}

const ALL_CONDITIONS = Object.keys(CONDITION_LABEL) as Condition[];

function EnrolSheet({ programme, offering, onClose }: { programme: Programme; offering: Offering; onClose: () => void }) {
  const { profile } = useStore();
  const { enrol, pay, mode } = useInterventions();
  const navigate = useNavigate();
  const [intake, setIntake] = useState<Intake>({
    goals: "", conditions: profile?.conditions ?? [], medications: "", typicalDay: "", allergies: "", consent: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Intake>) => setIntake((i) => ({ ...i, ...patch }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const err = intakeError(intake);
    if (err) return setError(err);
    setBusy(true);
    setError(null);
    try {
      const id = await enrol(offering.id, intake);
      const res = await pay(id);
      if (res.url) window.location.assign(res.url);
      // Paid: go straight to the chat with their dietitian (pinned at the top of Messages).
      else navigate(mode === "cloud" ? `/messages?p=${id}` : `/my-programmes/${id}`);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <Sheet title={`${programme.name} · ${offering.dietitian.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <h3>About you</h3>
        <label className="field">
          <span>What would you like to achieve?</span>
          <textarea required value={intake.goals} onChange={(e) => set({ goals: e.target.value })} placeholder="e.g. Bring my sugar down and lose 5 kg" maxLength={1000} />
        </label>
        <fieldset className="field">
          <span>Health conditions</span>
          <div className="chip-row">
            {ALL_CONDITIONS.map((c) => {
              const on = intake.conditions.includes(c);
              return (
                <button key={c} type="button" className={`chip chip-outline${on ? " on" : ""}`} aria-pressed={on} onClick={() => set({ conditions: on ? intake.conditions.filter((x) => x !== c) : [...intake.conditions, c] })}>
                  {CONDITION_LABEL[c]}
                </button>
              );
            })}
          </div>
        </fieldset>
        <label className="field">
          <span>Medicines or supplements you take</span>
          <input value={intake.medications} onChange={(e) => set({ medications: e.target.value })} placeholder="e.g. Metformin 500 mg twice a day" maxLength={1000} />
        </label>
        <label className="field">
          <span>What does a typical day of eating look like?</span>
          <textarea value={intake.typicalDay} onChange={(e) => set({ typicalDay: e.target.value })} placeholder="e.g. Bread and tea, rice at lunch, eba and soup at night" maxLength={1000} />
        </label>
        <label className="field">
          <span>Allergies or foods you avoid</span>
          <input value={intake.allergies} onChange={(e) => set({ allergies: e.target.value })} placeholder="e.g. Groundnuts" maxLength={1000} />
        </label>
        <label className="toggle consent">
          <input type="checkbox" checked={intake.consent} onChange={(e) => set({ consent: e.target.checked })} />
          <span className="small">
            I agree to share my food diary, water, weight and notes with {offering.dietitian.name} while this programme runs.
          </span>
        </label>

        <div className="price-box">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>{programme.name} ({length(programme)})</span>
            <strong>{naira(offering.priceNaira)}</strong>
          </div>
          <span className="small muted">Includes Nutrintel's platform fee. Paid securely with Paystack.</span>
        </div>
        {error && <p className="small error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          <ShieldCheck size={17} /> {busy ? "Please wait…" : mode === "preview" ? "Start preview (no payment)" : `Pay ${naira(offering.priceNaira)}`}
        </button>
      </form>
    </Sheet>
  );
}

/** Paystack sends members back here with ?reference=… */
export function PaymentReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { verify, myEnrolments } = useInterventions();
  const [state, setState] = useState<"checking" | "ok" | "failed">("checking");
  const reference = params.get("reference") ?? params.get("trxref") ?? "";

  useEffect(() => {
    if (!reference) return setState("failed");
    verify(reference)
      .then((r) => setState(r === "activated" || r === "already_active" ? "ok" : "failed"))
      .catch(() => setState("failed"));
  }, [reference, verify]);

  useEffect(() => {
    if (state !== "ok" || !myEnrolments?.[0]) return;
    const active = myEnrolments.find((e) => e.status === "active");
    navigate(active ? `/messages?p=${active.id}` : `/my-programmes/${myEnrolments[0].id}`, { replace: true });
  }, [state, myEnrolments, navigate]);

  return (
    <div className="page">
      <div className="card empty-state">
        {state === "checking" && <><CreditCard size={30} aria-hidden /><h2>Confirming your payment…</h2></>}
        {state === "ok" && <><Check size={30} aria-hidden /><h2>Payment received</h2><p className="muted">Opening the chat with your dietitian…</p></>}
        {state === "failed" && (
          <>
            <h2>We couldn't confirm the payment yet</h2>
            <p className="muted">If you were charged, it will show here within a few minutes. Otherwise you can try again from your programme.</p>
            <Link to="/programmes" className="btn btn-primary">Back to programmes</Link>
          </>
        )}
      </div>
    </div>
  );
}

export function MyProgramme() {
  const { id = "" } = useParams();
  const { myEnrolments, sendMessage, markRead, pay, cancel } = useInterventions();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const e = myEnrolments?.find((x) => x.id === id);
  const unread = e?.unread ?? 0;
  useEffect(() => {
    if (e && unread > 0) markRead(e.id);
  }, [e, unread, markRead]);

  if (myEnrolments === undefined) return <SkeletonPage />;
  if (!e) return <div className="page"><p>Programme not found. <Link to="/programmes" className="link">Programmes</Link></p></div>;
  const p = programmeById(e.programmeId)!;
  const today = todayIso();
  const week = programmeWeek(e.startDate, today, p.weeks);
  const total = Math.max(1, p.weeks);

  const retryPay = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await pay(e.id);
      if (res.url) window.location.assign(res.url);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page page-wide">
      <Link to="/programmes" className="link-btn small back-link"><ArrowLeft size={15} /> Programmes</Link>
      <header className="programme-hero card">
        <span className="programme-emoji lg" aria-hidden>{p.emoji}</span>
        <div className="grow">
          <h1>{p.name}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {STATUS_LABEL[e.status]}
            {e.startDate ? ` · started ${day(e.startDate)} · ends ${day(programmeEnd(e.startDate, p.weeks))}` : ""}
          </p>
          {e.status === "active" && week && (
            <div className="programme-progress">
              <div className="bar-track"><div className="bar-fill" style={{ width: `${(week / total) * 100}%` }} /></div>
              <span className="small">Week {week}{p.weeks ? ` of ${p.weeks}` : ""}</span>
            </div>
          )}
        </div>
      </header>
      {e.sample && <div className="banner banner-info">Preview with a sample dietitian. No payment was taken and messages stay on this device.</div>}

      {e.status === "pending_payment" && (
        <div className="card card-warm">
          <h2>Finish paying to start</h2>
          <p className="small">Your intake is saved. Your dietitian can see it once the payment goes through.</p>
          <div className="row">
            <button className="btn btn-primary" disabled={busy} onClick={retryPay}><CreditCard size={16} /> Pay {naira(e.priceNaira)}</button>
            <button className="btn btn-ghost" onClick={() => cancel(e.id).then(() => navigate("/programmes"))}>Cancel</button>
          </div>
          {error && <p className="small error" role="alert">{error}</p>}
        </div>
      )}

      <div className="two-col programme-cols">
        <div className="stack">
          <Card title="Your dietitian"><DietitianInfo d={e.dietitian} /></Card>

          <Card title={<span className="row"><Target size={18} /> Daily target</span>}>
            {e.target ? (
              <>
                <p className="target-big"><strong>{fmt(e.target.kcal)}</strong> kcal a day</p>
                <div className="chip-row">
                  <span className="tag tag-breakfast">Carbs {e.target.carbsPercent}%</span>
                  <span className="tag tag-lunch">Protein {e.target.proteinPercent}%</span>
                  <span className="tag tag-outline">Fat {e.target.fatPercent}%</span>
                </div>
                {e.target.note && <p className="small">“{e.target.note}”</p>}
                <p className="small muted">Set by {e.dietitian.name} on {day(e.target.setAt)}. Your dashboard and meal plan now use it.</p>
              </>
            ) : (
              <p className="small muted">{e.status === "active" ? "Your dietitian will set your target after reviewing your intake and first few days of logs." : "Set after you start."}</p>
            )}
          </Card>

          <Card title={<span className="row"><CalendarRange size={18} /> Meal plan</span>}>
            {e.planWeekStart ? (
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="small">Your dietitian sent a plan for the week of {day(e.planWeekStart)}.</span>
                <Link to="/plan" className="btn btn-secondary btn-small">Open plan</Link>
              </div>
            ) : (
              <p className="small muted">Your weekly plans from your dietitian appear in your meal plan.</p>
            )}
          </Card>

          <Card title={<span className="row"><Pill size={18} /> Supplements & adjuncts</span>}>
            {e.adjuncts.length === 0 ? (
              <p className="small muted">Only your dietitian can add these. Don't start new supplements without talking to them or your doctor.</p>
            ) : (
              <ul className="adjunct-list">
                {e.adjuncts.map((a) => (
                  <li key={a.id}>
                    <strong className="small">{a.name}</strong>
                    <span className="small">{[a.dose, a.timing].filter(Boolean).join(" · ")}</span>
                    {a.reason && <span className="small muted">{a.reason}</span>}
                    <span className="small muted">✓ Approved by {a.approvedBy}, {day(a.approvedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={<span className="row"><CalendarCheck size={18} /> Check-ins</span>}>
            {e.checkIns.length === 0 ? (
              <p className="small muted">Weekly reviews from your dietitian will appear here.</p>
            ) : (
              <ol className="checkin-list">
                {e.checkIns.map((c) => (
                  <li key={c.id}>
                    <span className="tag tag-outline">Week {c.week}</span> <span className="small muted">{day(c.createdAt)}{c.weightKg ? ` · ${c.weightKg} kg` : ""}</span>
                    <p className="small">{c.summary}</p>
                    {c.nextSteps && <p className="small"><strong>Next:</strong> {c.nextSteps}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <Card title={<span className="row"><MessageCircle size={18} /> Messages</span>} className="thread-card">
          <Thread
            messages={e.messages}
            onSend={(text) => sendMessage(e.id, text)}
            disabledReason={e.status === "active" ? undefined : e.status === "pending_payment" ? "Messages open once you've paid." : "This programme has ended."}
            placeholder={`Message ${e.dietitian.name.split(" ")[0]}…`}
          />
        </Card>
      </div>
      <SampleNotice>Your dietitian supports, not replaces, your doctor. In an emergency, go to the nearest hospital.</SampleNotice>
    </div>
  );
}

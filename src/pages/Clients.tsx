import { CloudProBanner } from "./Pro";
import { AlertTriangle, ArrowLeft, ArrowLeftRight, Banknote, CalendarCheck, CalendarRange, MessageCircle, Pill, Send, Target, Trash2, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Thread } from "../components/Thread";
import { Avatar } from "../components/Layout";
import { Card, Locked, PageHeader, SampleNotice, SkeletonLines, SkeletonPage, StatCard, Switch } from "../components/ui";
import { CUISINES, foodById, type Cuisine } from "../data/foods";
import { LANGUAGES, PLATFORM_FEE_PERCENT, PROGRAMMES, programmeById } from "../data/programmes";
import { ALLERGENS, recipeById, type Allergen } from "../data/recipes";
import { errorText } from "../lib/errors";
import { clientFlags, priceError, programmeWeek, splitPayment, targetError, type ClientDetail, type ClientSummary } from "../lib/interventions";
import { CONDITION_LABEL, MACRO_PRESETS, PAL, calculateBmi, calculateEnergy } from "../lib/nutrition";
import { DEFAULT_PLAN_PREFS, personalWeekPlan, portionLabel, swapOptions, type PlannedItem, RECIPE_CUISINES } from "../lib/planner";
import { dailyTotals, fmt } from "../state/derived";
import { useInterventions, type PlanItem } from "../state/interventions";
import { FEELINGS, MEALS, ageFromBirthDate, canUseWorkbench, shiftDate, todayIso, useStore, weekDates } from "../state/store";

const naira = (n: number) => `₦${fmt(n)}`;
const shortDay = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
const GOAL_LABEL = { lose: "Lose weight", maintain: "Maintain", gain: "Gain weight", eat_healthier: "Eat healthier" };

function useAsync() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg({ ok: true, text: ok });
      return true;
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
      return false;
    } finally {
      setBusy(false);
    }
  };
  const note = msg && <p className={`small ${msg.ok ? "ok" : "error"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</p>;
  return { busy, run, note, setMsg };
}

function DietitianOnly({ children }: { children: React.ReactNode }) {
  const { profile } = useStore();
  if (profile?.role !== "dietitian") return <div className="page"><PageHeader title="Clients" /><Locked /></div>;
  if (!canUseWorkbench(profile))
    return (
      <div className="page">
        <PageHeader title="Clients" />
        <div className="card card-warm"><h2>Verification pending</h2><p className="small">Client tools unlock once we've verified your licence.</p></div>
      </div>
    );
  return <>{children}</>;
}

/* ================= Workspace ================= */

type Tab = "clients" | "practice" | "earnings";

export function Clients() {
  const [tab, setTab] = useState<Tab>("clients");
  const { mode } = useInterventions();
  return (
    <DietitianOnly>
      <div className="page page-wide">
        <PageHeader title="Clients" subtitle="Your programme clients, offerings and earnings" />
        {mode === "cloud" && <CloudProBanner />}
        {mode === "preview" && (
          <div className="banner banner-info">Preview with sample clients. Changes stay on this device and nothing is sent to anyone.</div>
        )}
        <div className="seg seg-pill" role="tablist" aria-label="Sections" style={{ marginBottom: "1rem" }}>
          {([["clients", "Clients"], ["practice", "Programmes & prices"], ["earnings", "Earnings"]] as const).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        {tab === "clients" && <ClientList />}
        {tab === "practice" && <PracticeSettings />}
        {tab === "earnings" && <EarningsPanel />}
      </div>
    </DietitianOnly>
  );
}

function ClientList() {
  const { clients } = useInterventions();
  const today = todayIso();
  const [show, setShow] = useState<"active" | "completed">("active");
  if (clients === undefined) return <SkeletonLines />;
  const list = (clients ?? []).filter((c) => (show === "active" ? c.status === "active" : c.status === "completed"));
  const withFlags = list.map((c) => ({ c, flags: clientFlags(c, today) })).sort((a, b) => b.flags.length - a.flags.length || a.c.name.localeCompare(b.c.name));
  const needAttention = withFlags.filter((x) => x.flags.length > 0).length;

  return (
    <>
      <div className="stat-row">
        <StatCard icon={<Users size={20} />} tone="kcal" label="Active clients" value={String((clients ?? []).filter((c) => c.status === "active").length)} />
        <StatCard icon={<AlertTriangle size={20} />} tone="protein" label="Need attention" value={String(needAttention)} />
        <StatCard icon={<MessageCircle size={20} />} tone="carbs" label="Unread messages" value={String((clients ?? []).reduce((t, c) => t + c.unread, 0))} />
      </div>
      <div className="chip-row">
        <button className={`chip chip-outline${show === "active" ? " on" : ""}`} onClick={() => setShow("active")}>Active</button>
        <button className={`chip chip-outline${show === "completed" ? " on" : ""}`} onClick={() => setShow("completed")}>Completed</button>
      </div>
      {withFlags.length === 0 ? (
        <div className="card empty-state">
          <Users size={30} aria-hidden />
          <h2>{show === "active" ? "No active clients yet" : "No completed programmes yet"}</h2>
          <p className="muted">Turn on programmes under <strong>Programmes & prices</strong> and members can choose you.</p>
        </div>
      ) : (
        <div className="client-list">
          {withFlags.map(({ c, flags }) => <ClientRow key={c.enrolmentId} c={c} flags={flags} />)}
        </div>
      )}
    </>
  );
}

function ClientRow({ c, flags }: { c: ClientSummary; flags: string[] }) {
  const p = programmeById(c.programmeId);
  const week = programmeWeek(c.startDate, todayIso(), p?.weeks ?? 1);
  return (
    <Link to={`/clients/${c.enrolmentId}`} className="card client-row">
      <Avatar name={c.name} />
      <div className="client-main">
        <strong>{c.name}</strong>
        <span className="small muted">{p?.emoji} {p?.name}{week ? ` · week ${week}${p?.weeks ? `/${p.weeks}` : ""}` : ""}</span>
      </div>
      <div className="client-metric">
        <span className="small muted">Logged</span>
        <div className="logged-dots" aria-label={`${c.daysLogged7} of 7 days logged`}>
          {Array.from({ length: 7 }, (_, i) => <span key={i} className={i < c.daysLogged7 ? "on" : ""} />)}
        </div>
      </div>
      <div className="client-metric">
        <span className="small muted">Weight</span>
        <strong className="small">
          {c.latestWeightKg !== null ? `${fmt(c.latestWeightKg, 1)} kg` : "—"}
          {c.weightChangeKg ? <span className={c.weightChangeKg < 0 ? "ok" : "muted"}> {c.weightChangeKg > 0 ? "+" : ""}{fmt(c.weightChangeKg, 1)}</span> : null}
        </strong>
      </div>
      <div className="client-flags">
        {flags.map((f) => <span key={f} className={`tag${/unread/.test(f) ? " tag-breakfast" : " tag-lunch"}`}>{f}</span>)}
      </div>
    </Link>
  );
}

function PracticeSettings() {
  const { practice, saveProfile, saveOffering } = useInterventions();
  const [bio, setBio] = useState("");
  const [languages, setLanguages] = useState<string[]>(["English"]);
  const [years, setYears] = useState("0");
  const [bank, setBank] = useState({ bankName: "", accountNumber: "", accountName: "" });
  const [prices, setPrices] = useState<Record<string, string>>({});
  const profileSave = useAsync();
  const offerSave = useAsync();

  useEffect(() => {
    if (!practice) return;
    setBio(practice.card.bio);
    setLanguages(practice.card.languages.length ? practice.card.languages : ["English"]);
    setYears(String(practice.card.yearsExperience));
    if (practice.payout) setBank(practice.payout);
    // Load once; later edits come from this form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!practice]);

  if (practice === undefined) return <SkeletonLines />;
  if (!practice) return null;
  const offering = (id: string) => practice.offerings.find((o) => o.programmeId === id);

  const submitProfile = (e: FormEvent) => {
    e.preventDefault();
    const hasBank = bank.bankName || bank.accountNumber || bank.accountName;
    void profileSave.run(
      () => saveProfile({ bio: bio.trim(), languages, yearsExperience: Number(years) || 0, payout: hasBank ? bank : undefined }),
      "Profile saved.",
    );
  };

  return (
    <div className="two-col practice-cols">
      <Card title="Your public profile">
        <form onSubmit={submitProfile}>
          <label className="field">
            <span>Short bio (members see this)</span>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={600} placeholder="e.g. Registered dietitian in Lagos. I help people manage diabetes with everyday Nigerian food." />
          </label>
          <fieldset className="field">
            <span>Languages</span>
            <div className="chip-row">
              {LANGUAGES.map((l) => {
                const on = languages.includes(l);
                return <button type="button" key={l} className={`chip chip-outline${on ? " on" : ""}`} aria-pressed={on} onClick={() => setLanguages(on ? languages.filter((x) => x !== l) : [...languages, l])}>{l}</button>;
              })}
            </div>
          </fieldset>
          <label className="field">
            <span>Years of experience</span>
            <input inputMode="numeric" value={years} onChange={(e) => setYears(e.target.value.replace(/\D/g, ""))} />
          </label>
          <h3>Payout account</h3>
          <p className="small muted" style={{ marginTop: 0 }}>Kalorax pays your share by bank transfer. Only Kalorax admins can see this.</p>
          <div className="form-grid">
            <label className="field"><span>Bank</span><input value={bank.bankName} onChange={(e) => setBank({ ...bank, bankName: e.target.value })} placeholder="e.g. GTBank" /></label>
            <label className="field"><span>Account number</span><input inputMode="numeric" maxLength={10} value={bank.accountNumber} onChange={(e) => setBank({ ...bank, accountNumber: e.target.value.replace(/\D/g, "") })} placeholder="10 digits" /></label>
          </div>
          <label className="field"><span>Account name</span><input value={bank.accountName} onChange={(e) => setBank({ ...bank, accountName: e.target.value })} /></label>
          {profileSave.note}
          <button className="btn btn-primary" disabled={profileSave.busy}>Save profile</button>
        </form>
      </Card>

      <section>
        <h2 className="section-title">Programmes you offer</h2>
        <p className="small muted" style={{ marginTop: 0 }}>Set your own price within each range. Kalorax keeps {PLATFORM_FEE_PERCENT}%; price changes apply to new clients only.</p>
        {offerSave.note}
        <div className="stack">
          {PROGRAMMES.map((p) => {
            const o = offering(p.id);
            const raw = prices[p.id] ?? String(o?.priceNaira ?? p.suggestedPrice);
            const price = Number(raw);
            const err = priceError(p.id, price);
            const { payout } = splitPayment(price || 0);
            return (
              <div key={p.id} className={`card offer-setting${o?.active ? " is-on" : ""}`}>
                <span className="programme-emoji" aria-hidden>{p.emoji}</span>
                <div className="grow">
                  <strong className="small">{p.name}</strong>
                  <span className="small muted">{p.weeks ? `${p.weeks} weeks` : "One-off"} · {naira(p.minPrice)}–{naira(p.maxPrice)}</span>
                  <div className="row offer-price-row">
                    <div className="input-icon"><span aria-hidden className="muted">₦</span>
                      <input inputMode="numeric" value={raw} aria-label={`${p.name} price`} onChange={(e) => setPrices({ ...prices, [p.id]: e.target.value.replace(/\D/g, "") })} />
                    </div>
                    <span className="small muted">{err ? <span className="error">{err}</span> : <>You receive {naira(payout)}</>}</span>
                    {o && String(o.priceNaira) !== raw && !err && (
                      <button className="btn btn-secondary btn-small" disabled={offerSave.busy} onClick={() => offerSave.run(() => saveOffering({ programmeId: p.id, priceNaira: price, active: o.active }), "Price updated.")}>Save price</button>
                    )}
                  </div>
                </div>
                <Switch
                  label={`Offer ${p.name}`}
                  checked={!!o?.active}
                  disabled={!!err || offerSave.busy}
                  onChange={(active) => offerSave.run(() => saveOffering({ programmeId: p.id, priceNaira: price, active }), active ? `${p.name} is now listed.` : `${p.name} is hidden.`)}
                />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function EarningsPanel() {
  const { practice } = useInterventions();
  if (practice === undefined) return <SkeletonLines />;
  if (!practice) return null;
  const e = practice.earnings;
  return (
    <>
      <div className="stat-row">
        <StatCard icon={<Banknote size={20} />} tone="kcal" label="Client payments" value={naira(e.grossNaira)} />
        <StatCard icon={<TrendingDown size={20} />} tone="fat" label={`Platform fee (${PLATFORM_FEE_PERCENT}%)`} value={naira(e.feeNaira)} />
        <StatCard icon={<Wallet size={20} />} tone="protein" label="Your earnings" value={naira(e.netNaira)} />
        <StatCard icon={<TrendingUp size={20} />} tone="carbs" label="To be paid out" value={naira(e.balanceNaira)} unit={`${naira(e.paidOutNaira)} paid`} />
      </div>
      <Card title="How payouts work">
        <ul className="check-list small">
          <li>Members pay Kalorax through Paystack when they start a programme.</li>
          <li>Your share ({100 - PLATFORM_FEE_PERCENT}%) is paid to your bank account every week, by transfer.</li>
          <li>{practice.payout ? `Paying to ${practice.payout.bankName} ••••${practice.payout.accountNumber.slice(-4)} (${practice.payout.accountName}).` : "Add your payout account under Programmes & prices."}</li>
        </ul>
      </Card>
    </>
  );
}

/* ================= Client detail ================= */

export function ClientPage() {
  const { id = "" } = useParams();
  const { useClientDetail, markRead, sendMessage, complete } = useInterventions();
  const c = useClientDetail(id);
  const done = useAsync();
  useEffect(() => {
    if (c && c.unread > 0) markRead(c.enrolmentId);
  }, [c, markRead]);

  return (
    <DietitianOnly>
      {c === undefined ? (
        <SkeletonPage />
      ) : c === null ? (
        <div className="page"><p>Client not found. <Link to="/clients" className="link">All clients</Link></p></div>
      ) : (
        <div className="page page-wide">
          <Link to="/clients" className="link-btn small back-link"><ArrowLeft size={15} /> Clients</Link>
          <ClientHeader c={c} />
          {c.sample && <div className="banner banner-info">Sample client for the preview. Changes stay on this device.</div>}
          <div className="client-layout">
            <div className="stack">
              <ProfileCard c={c} />
              <DiaryCard c={c} />
              <WeightCard c={c} />
            </div>
            <div className="stack">
              {c.status === "active" && <TargetCard c={c} />}
              {c.status === "active" && <PlanCard c={c} />}
              <AdjunctCard c={c} />
              <CheckInCard c={c} />
              <Card title={<span className="row"><MessageCircle size={18} /> Messages</span>} className="thread-card">
                <Thread messages={c.messages} onSend={(text) => sendMessage(c.enrolmentId, text)} disabledReason={c.status === "active" ? undefined : "This programme has ended."} placeholder={`Message ${c.name.split(" ")[0]}…`} />
              </Card>
              {c.status === "active" && (
                <div className="row">
                  <button
                    className="btn btn-ghost btn-small"
                    disabled={done.busy}
                    onClick={() => confirm(`Mark ${c.name}'s programme as finished? It ends once they confirm too, and then their logs stop being shared with you.`) && done.run(() => complete(c.enrolmentId))}
                  >
                    Mark programme finished
                  </button>
                  {done.note}
                </div>
              )}
            </div>
          </div>
          <SampleNotice>Clinical decisions are yours. Kalorax's food values are sample estimates until the Nigerian food composition tables are loaded.</SampleNotice>
        </div>
      )}
    </DietitianOnly>
  );
}

function ClientHeader({ c }: { c: ClientDetail }) {
  const p = programmeById(c.programmeId);
  const week = programmeWeek(c.startDate, todayIso(), p?.weeks ?? 1);
  const flags = clientFlags(c, todayIso());
  return (
    <header className="card client-header">
      <Avatar name={c.name} />
      <div className="grow">
        <h1>{c.name}</h1>
        <span className="muted small">
          {p?.emoji} {p?.name} · {c.status === "active" ? `week ${week ?? 1}${p?.weeks ? ` of ${p.weeks}` : ""}` : "completed"}
          {c.startDate ? ` · since ${shortDay(c.startDate)}` : ""}
        </span>
        {flags.length > 0 && <div className="chip-row">{flags.map((f) => <span key={f} className="tag tag-lunch">{f}</span>)}</div>}
      </div>
    </header>
  );
}

function ProfileCard({ c }: { c: ClientDetail }) {
  const age = ageFromBirthDate(c.birthDate);
  const bmi = c.latestWeightKg && c.heightCm ? calculateBmi(c.latestWeightKg, c.heightCm) : null;
  return (
    <Card title="Profile & intake">
      <dl className="details">
        <dt>Age · sex</dt><dd>{age} · {c.sex === "female" ? "Female" : "Male"}</dd>
        <dt>Height · weight</dt><dd>{c.heightCm} cm · {c.latestWeightKg ? `${fmt(c.latestWeightKg, 1)} kg` : "—"}{bmi ? ` (BMI ${fmt(bmi, 1)})` : ""}</dd>
        <dt>Activity</dt><dd>{PAL[c.activity].consumerLabel}</dd>
        <dt>Goal</dt><dd>{GOAL_LABEL[c.goal]}</dd>
        <dt>Conditions</dt><dd>{c.intake.conditions.length ? c.intake.conditions.map((x) => CONDITION_LABEL[x]).join(", ") : "None reported"}</dd>
        <dt>Wants to</dt><dd>{c.intake.goals || "—"}</dd>
        <dt>Medicines</dt><dd>{c.intake.medications || "—"}</dd>
        <dt>Typical day</dt><dd>{c.intake.typicalDay || "—"}</dd>
        <dt>Avoids</dt><dd>{c.intake.allergies || "—"}</dd>
      </dl>
    </Card>
  );
}

function DiaryCard({ c }: { c: ClientDetail }) {
  const today = todayIso();
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(today, -i));
  const [open, setOpen] = useState<string | null>(null);
  if (c.status !== "active") return <Card title="Food diary"><p className="small muted">Logs are only shared while the programme is active.</p></Card>;
  return (
    <Card title="Food diary · last 7 days" action={c.target ? <span className="small muted">Target {fmt(c.target.kcal)} kcal</span> : null}>
      <div className="table-wrap">
        <table className="table diary-mini">
          <thead><tr><th>Day</th><th>kcal</th><th>C / P / F (g)</th><th>Water</th><th>Mood</th></tr></thead>
          <tbody>
            {days.map((d) => {
              const entries = c.diary.filter((e) => e.date === d);
              const t = dailyTotals(entries.map((e, i) => ({ ...e, id: String(i) })));
              const note = c.notes.find((n) => n.date === d && n.feeling);
              const over = c.target && t.kcal > c.target.kcal * 1.1;
              return (
                <tr key={d} className={entries.length ? "clickable" : "muted"} onClick={() => entries.length && setOpen(open === d ? null : d)}>
                  <td>{shortDay(d)}</td>
                  <td>{entries.length ? <span className={over ? "error" : ""}>{fmt(t.kcal)}</span> : "Not logged"}</td>
                  <td>{entries.length ? `${fmt(t.carbs)} / ${fmt(t.protein)} / ${fmt(t.fat)}` : ""}</td>
                  <td>{c.water[d] ? `${fmt(c.water[d] / 1000, 1)} L` : ""}</td>
                  <td>{note ? FEELINGS.find((f) => f.value === note.feeling)?.emoji : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {open && (
        <div className="diary-open">
          <strong className="small">{shortDay(open)}</strong>
          {MEALS.map((m) => {
            const items = c.diary.filter((e) => e.date === open && e.meal === m);
            return items.length ? <p key={m} className="small"><span className="muted">{m}:</span> {items.map((e) => `${foodById(e.foodId)?.name ?? e.foodId} (${e.portionLabel})`).join(", ")}</p> : null;
          })}
          {c.notes.filter((n) => n.date === open && n.text).map((n, i) => <p key={i} className="small">📝 {n.text} {n.tags.length ? <span className="muted">· {n.tags.join(", ")}</span> : null}</p>)}
        </div>
      )}
      <p className="small muted">Tap a day to see what they ate.</p>
    </Card>
  );
}

function WeightCard({ c }: { c: ClientDetail }) {
  if (c.weights.length === 0) return null;
  const ws = c.weights.slice(-12);
  const min = Math.min(...ws.map((w) => w.weightKg)) - 0.5;
  const max = Math.max(...ws.map((w) => w.weightKg)) + 0.5;
  const pts = ws.map((w, i) => `${ws.length === 1 ? 150 : (i / (ws.length - 1)) * 300},${80 - ((w.weightKg - min) / (max - min)) * 70}`).join(" ");
  return (
    <Card title="Weight" action={<span className="small muted">{ws.length} weigh-ins</span>}>
      <svg viewBox="-6 0 312 90" className="spark" role="img" aria-label={`Weight from ${ws[0].weightKg} to ${ws.at(-1)!.weightKg} kg`}>
        <polyline points={pts} fill="none" stroke="var(--lime-2)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {ws.map((w, i) => {
          const [x, y] = pts.split(" ")[i].split(",");
          return <circle key={w.date} cx={x} cy={y} r="3.5" fill="var(--ink)" />;
        })}
      </svg>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="small muted">{shortDay(ws[0].date)} · {fmt(ws[0].weightKg, 1)} kg</span>
        <span className="small"><strong>{fmt(ws.at(-1)!.weightKg, 1)} kg</strong> · {shortDay(ws.at(-1)!.date)}</span>
      </div>
    </Card>
  );
}

function TargetCard({ c }: { c: ClientDetail }) {
  const { setTarget } = useInterventions();
  const save = useAsync();
  const age = ageFromBirthDate(c.birthDate);
  const suggestion = useMemo(() => {
    if (!c.latestWeightKg || !c.heightCm) return null;
    const pregnant = c.conditions.includes("pregnant");
    return calculateEnergy({ sex: c.sex, ageYears: age, weightKg: c.latestWeightKg, heightCm: c.heightCm }, { equation: "mifflin", pal: PAL[c.activity].value, physiologicalState: pregnant ? "pregnant_t2" : "none" }).tee;
  }, [c, age]);
  // Starting point only: 500 kcal below maintenance for weight loss (not below 1,200 / 1,500), diabetic split for diabetes.
  const start = suggestion ? (c.goal === "lose" ? Math.max(suggestion - 500, c.sex === "female" ? 1200 : 1500) : suggestion) : 2000;
  const preset = MACRO_PRESETS[c.conditions.includes("diabetes") ? "diabetic" : "standard"].split;
  const [kcal, setKcal] = useState(String(c.target?.kcal ?? Math.round(start / 50) * 50));
  const [split, setSplit] = useState({
    carbs: c.target?.carbsPercent ?? preset.carbsPercent,
    protein: c.target?.proteinPercent ?? preset.proteinPercent,
    fat: c.target?.fatPercent ?? preset.fatPercent,
  });
  const [note, setNote] = useState(c.target?.note ?? "");
  const t = { kcal: Number(kcal), carbsPercent: split.carbs, proteinPercent: split.protein, fatPercent: split.fat };
  const err = targetError(t);

  return (
    <Card title={<span className="row"><Target size={18} /> Daily target</span>} action={c.target ? <span className="badge badge-ok">Set {shortDay(c.target.setAt)}</span> : <span className="badge">Not set</span>}>
      {suggestion && (
        <p className="small muted" style={{ marginTop: 0 }}>
          Mifflin-St Jeor × PAL {PAL[c.activity].value}: maintenance ≈ <strong>{fmt(suggestion)}</strong> kcal{c.conditions.includes("pregnant") ? " (incl. 2nd-trimester extra)" : ""}. <Link to="/workbench" className="link">Workbench</Link>
        </p>
      )}
      <div className="form-grid">
        <label className="field"><span>Energy (kcal/day)</span><input inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value.replace(/\D/g, ""))} /></label>
        <label className="field">
          <span>Macro preset</span>
          <select onChange={(e) => { const p = MACRO_PRESETS[e.target.value]; if (p) setSplit({ carbs: p.split.carbsPercent, protein: p.split.proteinPercent, fat: p.split.fatPercent }); }} defaultValue="">
            <option value="" disabled>Choose…</option>
            {Object.entries(MACRO_PRESETS).map(([id, p]) => <option key={id} value={id}>{p.label} ({p.split.carbsPercent}/{p.split.proteinPercent}/{p.split.fatPercent})</option>)}
          </select>
        </label>
      </div>
      <div className="form-grid three">
        {(["carbs", "protein", "fat"] as const).map((k) => (
          <label key={k} className="field">
            <span>{k === "carbs" ? "Carbs" : k === "protein" ? "Protein" : "Fat"} %</span>
            <input inputMode="numeric" value={split[k]} onChange={(e) => setSplit({ ...split, [k]: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
          </label>
        ))}
      </div>
      {!err && (
        <p className="small muted">
          ≈ {fmt((t.kcal * split.carbs) / 400)} g carbs · {fmt((t.kcal * split.protein) / 400)} g protein · {fmt((t.kcal * split.fat) / 900)} g fat a day
        </p>
      )}
      <label className="field"><span>Note to client (optional)</span><input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Carb-aware: keep swallow to one fist" /></label>
      {err && <p className="small error">{err}</p>}
      {save.note}
      <button className="btn btn-primary" disabled={!!err || save.busy} onClick={() => save.run(() => setTarget(c.enrolmentId, { ...t, note: note.trim() || undefined }), "Target saved. The client's dashboard now uses it.")}>
        Save target
      </button>
    </Card>
  );
}

function PlanCard({ c }: { c: ClientDetail }) {
  const { sendPlan } = useInterventions();
  const save = useAsync();
  const thisWeek = weekDates(todayIso())[0];
  const [weekStart, setWeekStart] = useState(shiftDate(thisWeek, 7));
  const [cuisines, setCuisines] = useState<Cuisine[]>(["Nigerian"]);
  const [avoid, setAvoid] = useState<Allergen[]>([]);
  const [items, setItems] = useState<PlannedItem[] | null>(null);
  const prefs = { ...DEFAULT_PLAN_PREFS, cuisines, avoid };
  const dates = weekDates(weekStart);

  const generate = () => {
    if (!c.target) return;
    setItems(personalWeekPlan(dates, c.target.kcal, prefs).items);
    save.setMsg(null);
  };
  const swap = (idx: number) =>
    setItems((list) => {
      if (!list) return list;
      const it = list[idx];
      const next = swapOptions(it.meal, it, prefs, 1)[0];
      return next ? list.map((x, i) => (i === idx ? { ...x, recipeId: next.recipe.id, portion: next.portion } : x)) : list;
    });

  return (
    <Card title={<span className="row"><CalendarRange size={18} /> Meal plan</span>} action={c.planWeekStart ? <span className="badge badge-ok">Sent for {shortDay(c.planWeekStart)}</span> : null}>
      {!c.target ? (
        <p className="small muted" style={{ marginTop: 0 }}>Set a daily target first; plans are sized to it.</p>
      ) : (
        <>
          <div className="row plan-builder-row">
            <select value={weekStart} onChange={(e) => { setWeekStart(e.target.value); setItems(null); }} aria-label="Week">
              <option value={thisWeek}>This week ({shortDay(thisWeek)})</option>
              <option value={shiftDate(thisWeek, 7)}>Next week ({shortDay(shiftDate(thisWeek, 7))})</option>
            </select>
            <button className="btn btn-ink btn-small" onClick={generate}>Generate from target</button>
          </div>
          <div className="chip-row">
            {CUISINES.filter((x) => RECIPE_CUISINES([x.id]).length).map((x) => {
              const on = cuisines.includes(x.id);
              return <button key={x.id} className={`chip chip-outline${on ? " on" : ""}`} aria-pressed={on} onClick={() => on ? cuisines.length > 1 && setCuisines(cuisines.filter((y) => y !== x.id)) : setCuisines([...cuisines, x.id])}>{x.label}</button>;
            })}
            {ALLERGENS.map((a) => {
              const on = avoid.includes(a.id);
              return <button key={a.id} className={`chip chip-outline${on ? " on" : ""}`} aria-pressed={on} onClick={() => setAvoid(on ? avoid.filter((y) => y !== a.id) : [...avoid, a.id])}>No {a.label.toLowerCase()}</button>;
            })}
          </div>
          {items && (
            <div className="plan-preview">
              {dates.map((d) => {
                const day = items.map((it, idx) => ({ it, idx })).filter((x) => x.it.date === d);
                const kcal = day.reduce((t, x) => t + (recipeById(x.it.recipeId)?.kcal ?? 0) * x.it.portion, 0);
                return (
                  <div key={d} className="plan-preview-day">
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <strong className="small">{shortDay(d)}</strong>
                      <span className="small muted">{fmt(kcal)} kcal</span>
                    </div>
                    {day.map(({ it, idx }) => {
                      const r = recipeById(it.recipeId)!;
                      return (
                        <div key={idx} className="plan-preview-item">
                          <span className="small muted">{it.meal === "Snacks" ? "Snack" : it.meal}</span>
                          <span className="small grow">{r.emoji} {r.name} <span className="muted">· {portionLabel(it.portion)}</span></span>
                          <button className="icon-btn sm ghost" onClick={() => swap(idx)} aria-label={`Swap ${r.name}`} title="Swap"><ArrowLeftRight size={14} /></button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
          {save.note}
          {items && (
            <button
              className="btn btn-primary"
              disabled={save.busy}
              onClick={() => save.run(() => sendPlan(c.enrolmentId, weekStart, items.map(({ date, meal, recipeId, portion }): PlanItem => ({ date, meal, recipeId, portion }))), `Plan sent to ${c.name.split(" ")[0]}'s meal plan.`)}
            >
              <Send size={16} /> Send plan to client
            </button>
          )}
        </>
      )}
    </Card>
  );
}

function AdjunctCard({ c }: { c: ClientDetail }) {
  const { addAdjunct, removeAdjunct } = useInterventions();
  const save = useAsync();
  const [form, setForm] = useState({ name: "", dose: "", timing: "", reason: "" });
  const active = c.status === "active";
  return (
    <Card title={<span className="row"><Pill size={18} /> Supplements & adjuncts</span>}>
      {c.adjuncts.length > 0 && (
        <ul className="adjunct-list">
          {c.adjuncts.map((a) => (
            <li key={a.id}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong className="small">{a.name}</strong>
                {active && <button className="icon-btn sm ghost" aria-label={`Remove ${a.name}`} onClick={() => save.run(() => removeAdjunct(c.enrolmentId, a.id))}><Trash2 size={14} /></button>}
              </div>
              <span className="small">{[a.dose, a.timing].filter(Boolean).join(" · ")}</span>
              {a.reason && <span className="small muted">{a.reason}</span>}
              <span className="small muted">Approved by {a.approvedBy}, {shortDay(a.approvedAt)}</span>
            </li>
          ))}
        </ul>
      )}
      {active ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save.run(() => addAdjunct(c.enrolmentId, form), "Added. Your client sees it with your approval.").then((ok) => ok && setForm({ name: "", dose: "", timing: "", reason: "" }));
          }}
        >
          <div className="form-grid">
            <label className="field"><span>Name</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Folic acid" /></label>
            <label className="field"><span>Dose</span><input value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} placeholder="e.g. 400 µg" /></label>
            <label className="field"><span>When</span><input value={form.timing} onChange={(e) => setForm({ ...form, timing: e.target.value })} placeholder="e.g. Morning, with food" /></label>
            <label className="field"><span>Why</span><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason, shown to client" /></label>
          </div>
          <p className="small muted" style={{ marginTop: 0 }}>Check for interactions with their medicines ({c.intake.medications || "none reported"}).</p>
          {save.note}
          <button className="btn btn-secondary btn-small" disabled={save.busy}>Approve & add</button>
        </form>
      ) : c.adjuncts.length === 0 ? (
        <p className="small muted">None.</p>
      ) : null}
    </Card>
  );
}

function CheckInCard({ c }: { c: ClientDetail }) {
  const { addCheckIn } = useInterventions();
  const save = useAsync();
  const [summary, setSummary] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [weight, setWeight] = useState("");
  return (
    <Card title={<span className="row"><CalendarCheck size={18} /> Weekly check-in</span>}>
      {c.status === "active" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const w = weight ? Number(weight) : undefined;
            void save.run(() => addCheckIn(c.enrolmentId, { summary, nextSteps, weightKg: w }), "Check-in shared with your client.").then((ok) => {
              if (ok) { setSummary(""); setNextSteps(""); setWeight(""); }
            });
          }}
        >
          <label className="field"><span>How did this week go?</span><textarea required value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={1500} placeholder="What went well, what to watch" /></label>
          <label className="field"><span>Next steps</span><textarea value={nextSteps} onChange={(e) => setNextSteps(e.target.value)} maxLength={1500} placeholder="1–3 clear actions for next week" /></label>
          <label className="field"><span>Weight at check-in (kg, optional)</span><input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, ""))} placeholder={c.latestWeightKg ? String(c.latestWeightKg) : ""} /></label>
          {save.note}
          <button className="btn btn-secondary btn-small" disabled={save.busy || !summary.trim()}>Share check-in</button>
        </form>
      )}
      {c.checkIns.length > 0 && (
        <ol className="checkin-list">
          {c.checkIns.map((ci) => (
            <li key={ci.id}>
              <span className="tag tag-outline">Week {ci.week}</span> <span className="small muted">{shortDay(ci.createdAt)}{ci.weightKg ? ` · ${ci.weightKg} kg` : ""}</span>
              <p className="small">{ci.summary}</p>
              {ci.nextSteps && <p className="small"><strong>Next:</strong> {ci.nextSteps}</p>}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

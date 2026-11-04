import { useQuery } from "convex/react";
import { Activity, BadgeCheck, Banknote, Bell, CalendarRange, CircleCheck, CircleX, Gauge, HeartPulse, MessageCircle, NotebookPen, ShieldAlert, UserPlus, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { PageHeader, SearchBox, SkeletonLines } from "../components/ui";
import { fmt } from "../state/derived";
import { Payouts, VerificationQueue } from "./AdminReview";
import { useDebounced } from "../lib/useDebounced";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "people", label: "People" },
  { id: "activity", label: "Activity" },
  { id: "verification", label: "Verification" },
  { id: "payouts", label: "Payouts" },
  { id: "log", label: "Audit log" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const naira = (n: number) => `₦${fmt(n)}`;
const shortDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
function ago(iso: string) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

/** Admin portal: everything happening in Kalorax, plus verification and payouts. Admins are listed in ADMIN_EMAILS. */
export function Admin() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "overview") as Tab;
  const overview = useQuery(api.admin.overview);
  const pending = overview?.queue.pendingVerifications ?? 0;

  return (
    <div className="page page-wide">
      <PageHeader title="Admin" subtitle={overview ? `Live · updated ${new Date(overview.generatedAt).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}` : "Loading…"} />
      <div className="seg admin-tabs" role="tablist" aria-label="Admin sections">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setParams(t.id === "overview" ? {} : { tab: t.id })}>
            {t.label}
            {t.id === "verification" && pending > 0 && <span className="nav-badge">{pending}</span>}
          </button>
        ))}
      </div>
      {tab === "overview" && (overview ? <Overview o={overview} onTab={(t) => setParams({ tab: t })} /> : <SkeletonLines />)}
      {tab === "people" && <People />}
      {tab === "activity" && <Feed />}
      {tab === "verification" && <VerificationQueue />}
      {tab === "payouts" && <Payouts />}
      {tab === "log" && <AuditLog />}
    </div>
  );
}

type OverviewData = NonNullable<ReturnType<typeof useQuery<typeof api.admin.overview>>>;

function Kpi({ icon, label, value, sub, onClick }: { icon: ReactNode; label: string; value: string; sub?: string; onClick?: () => void }) {
  const body = (
    <>
      <span className="kpi-icon" aria-hidden>{icon}</span>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      {sub && <span className="kpi-sub">{sub}</span>}
    </>
  );
  return onClick ? <button className="kpi card kpi-link" onClick={onClick}>{body}</button> : <div className="kpi card">{body}</div>;
}

function Overview({ o, onTab }: { o: OverviewData; onTab: (t: Tab) => void }) {
  const p = o.programmes;
  return (
    <>
      <div className="kpi-row">
        <Kpi icon={<Users size={18} />} label="Accounts" value={fmt(o.people.accounts)} sub={`${fmt(o.people.newThisWeek)} new this week`} onClick={() => onTab("people")} />
        <Kpi icon={<Activity size={18} />} label="Active today" value={fmt(o.active.today)} sub={`${fmt(o.active.week)} this week · ${fmt(o.active.month)} this month`} />
        <Kpi icon={<BadgeCheck size={18} />} label="Waiting for verification" value={fmt(o.queue.pendingVerifications)} sub="Students and dietitians" onClick={() => onTab("verification")} />
        <Kpi icon={<Banknote size={18} />} label="Programme revenue" value={naira(p.grossNaira)} sub={`${naira(p.feesNaira)} Kalorax fees`} onClick={() => onTab("payouts")} />
      </div>

      <div className="admin-charts">
        <DailyBars title="New accounts" unit="new accounts" data={o.trends.signups} />
        <DailyBars title="Active members" unit="active members" data={o.trends.activeMembers} note="Logged food, planned, exercised or messaged that day" />
      </div>

      <div className="admin-grid">
        <Panel icon={<Users size={17} />} title="People">
          <Stat label="Finished setting up" value={o.people.profiles} />
          <Stat label="Signed up, not finished" value={o.people.unfinished} warn={o.people.unfinished > 0} />
          <Stat label="Members" value={o.people.members} />
          <Stat label="Nutrition students" value={o.people.students} />
          <Stat label="Dietitians" value={o.people.dietitians} />
          <Stat label="Verified students & dietitians" value={o.people.verifiedPros} />
          <Stat label="Reported a health condition" value={o.people.withConditions} />
          <Stat label="On the waitlist" value={o.queue.waitlist} />
        </Panel>
        <Panel icon={<NotebookPen size={17} />} title="Use in the last 30 days">
          <Stat label="Foods logged" value={o.usage30.foodLogs} />
          <Stat label="Meals planned" value={o.usage30.plannedMeals} />
          <Stat label="Workouts logged" value={o.usage30.workouts} />
          <Stat label="Member messages" value={o.usage30.memberMessages} />
          <Stat label="Meal plans shared in chats" value={o.usage30.planShares} />
          <Stat label="Dietitian messages" value={o.usage30.dietitianMessages} />
        </Panel>
        <Panel icon={<HeartPulse size={17} />} title="Programmes & money">
          <Stat label="Active programmes" value={p.active} />
          <Stat label="Waiting for payment" value={p.pendingPayment} />
          <Stat label="Completed" value={p.completed} />
          <Stat label="Cancelled" value={p.cancelled} />
          <Stat label="Paid by members" text={naira(p.grossNaira)} />
          <Stat label="Kalorax fees" text={naira(p.feesNaira)} />
          <Stat label="Owed to dietitians" text={naira(p.owedToDietitiansNaira)} warn={p.owedToDietitiansNaira > 0} />
          {p.demo > 0 && <Stat label="Demo enrolments (not counted)" value={p.demo} warn />}
        </Panel>
        <Panel icon={<MessageCircle size={17} />} title="Messaging & reminders">
          <Stat label="Member chats" value={o.messaging.chats} />
          <Stat label="Blocked chats" value={o.messaging.blockedChats} warn={o.messaging.blockedChats > 0} />
          <Stat label="Devices with push reminders" value={o.reminders.pushDevices} />
          <Stat label="Confirmed WhatsApp numbers" value={o.reminders.whatsappConfirmed} />
          <Stat label="Reminders sent this week" value={o.reminders.sentThisWeek} />
        </Panel>
      </div>
      <SpeedPanel />
      <p className="sample-notice">
        Admins see counts and activity, not message text or anyone's food log. Days are in Nigeria time. Figures update live.
      </p>
    </>
  );
}

const METRIC_INFO: Record<string, { label: string; ms: boolean }> = {
  LCP: { label: "Page shows its main content (LCP)", ms: true },
  INP: { label: "Responds to a tap (INP)", ms: true },
  CLS: { label: "Layout jumps while loading (CLS)", ms: false },
  FCP: { label: "First thing on screen (FCP)", ms: true },
  TTFB: { label: "Server starts answering (TTFB)", ms: true },
};
const RATING_TEXT = { good: "Good", "needs-improvement": "Needs work", poor: "Slow" } as const;

/** How fast the app is for real visitors (75th percentile: 3 in 4 visits are at least this fast). */
function SpeedPanel() {
  const s = useQuery(api.vitals.summary);
  if (s === undefined) return null;
  const show = (ms: boolean, v: number | null) => (v === null ? "—" : ms ? (v >= 1000 ? `${fmt(v / 1000, 1)} s` : `${fmt(v)} ms`) : fmt(v, 2));
  return (
    <section className="card admin-panel">
      <h2 className="row"><Gauge size={17} /> Speed for real visitors <span className="muted small">last 7 days · {fmt(s.reports)} reports</span></h2>
      {s.reports === 0 ? (
        <p className="muted small">No reports yet. Visitors' browsers send them from the live site after each visit.</p>
      ) : (
        <>
          <dl>
            {s.metrics.filter((m) => m.count > 0).map((m) => (
              <div key={m.metric} className={`admin-stat${m.rating && m.rating !== "good" ? " warn" : ""}`}>
                <dt>{METRIC_INFO[m.metric].label}</dt>
                <dd>
                  {show(METRIC_INFO[m.metric].ms, m.p75)} <span className="muted small">{m.rating ? RATING_TEXT[m.rating] : ""}{m.p75Mobile !== null ? ` · phones ${show(METRIC_INFO[m.metric].ms, m.p75Mobile)}` : ""}</span>
                </dd>
              </div>
            ))}
          </dl>
          {s.slowestPages.length > 0 && (
            <p className="small muted">Slowest pages to load: {s.slowestPages.map((p) => `${p.path} (${show(true, p.p75)})`).join(", ")}</p>
          )}
          <p className="small muted">Each figure is what 3 in 4 visits beat. Google counts under 2.5 s to load, 200 ms to respond and 0.1 layout shift as good.</p>
        </>
      )}
    </section>
  );
}

function Panel({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="card admin-panel">
      <h2 className="row">{icon} {title}</h2>
      <dl>{children}</dl>
    </section>
  );
}

function Stat({ label, value, text, warn }: { label: string; value?: number; text?: string; warn?: boolean }) {
  return (
    <div className={`admin-stat${warn ? " warn" : ""}`}>
      <dt>{label}</dt>
      <dd>{text ?? fmt(value ?? 0)}</dd>
    </div>
  );
}

/** One series of daily counts as columns, with a hover readout and a table view. */
function DailyBars({ title, unit, data, note }: { title: string; unit: string; data: Array<{ date: string; count: number }>; note?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(1, ...data.map((d) => d.count));
  const top = max <= 4 ? max : Math.ceil(max / 5) * 5;
  const total = data.reduce((t, d) => t + d.count, 0);
  const W = 600, H = 170, padL = 28, padB = 22, padT = 8;
  const slot = (W - padL) / data.length;
  const bar = Math.min(14, slot - 2);
  const y = (n: number) => padT + (H - padT - padB) * (1 - n / top);
  const shown = hover ?? data.length - 1;
  return (
    <section className="card admin-chart">
      <div className="admin-chart-head">
        <div>
          <h2>{title}</h2>
          <span className="muted small">{note ?? "Last 30 days"} · {fmt(total)} in total</span>
        </div>
        <button className="link-btn small" onClick={() => setAsTable(!asTable)}>{asTable ? "Show chart" : "Show table"}</button>
      </div>
      {asTable ? (
        <div className="table-wrap admin-chart-table">
          <table className="table">
            <thead><tr><th>Day</th><th className="num">{unit}</th></tr></thead>
            <tbody>{[...data].reverse().map((d) => <tr key={d.date}><td>{shortDay(d.date)}</td><td className="num">{d.count}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <>
          <p className="admin-readout" aria-live="polite"><strong>{fmt(data[shown].count)}</strong> {unit} · {shortDay(data[shown].date)}{hover === null ? " (today)" : ""}</p>
          <svg viewBox={`0 0 ${W} ${H}`} className="admin-svg" role="img" aria-label={`${title}, last 30 days. ${fmt(total)} in total.`} onMouseLeave={() => setHover(null)}>
            {[0, top / 2, top].map((t) => (
              <g key={t}>
                <line x1={padL} x2={W} y1={y(t)} y2={y(t)} className="admin-grid-line" />
                <text x={padL - 6} y={y(t) + 4} className="admin-axis" textAnchor="end">{Number.isInteger(t) ? t : ""}</text>
              </g>
            ))}
            {data.map((d, i) => {
              const x = padL + i * slot + (slot - bar) / 2;
              const h = Math.max(0, y(0) - y(d.count));
              const r = Math.min(4, h);
              return (
                <g key={d.date} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${shortDay(d.date)}: ${d.count} ${unit}`}>
                  <rect x={padL + i * slot} y={padT} width={slot} height={H - padT - padB} fill="transparent" />
                  {h > 0 && (
                    <path
                      className={`admin-bar${hover === i ? " on" : ""}`}
                      d={`M${x},${y(0)} V${y(0) - h + r} Q${x},${y(0) - h} ${x + r},${y(0) - h} H${x + bar - r} Q${x + bar},${y(0) - h} ${x + bar},${y(0) - h + r} V${y(0)} Z`}
                    />
                  )}
                </g>
              );
            })}
            {[0, Math.floor(data.length / 2), data.length - 1].map((i) => (
              <text key={i} x={padL + i * slot + slot / 2} y={H - 6} className="admin-axis" textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}>{shortDay(data[i].date)}</text>
            ))}
          </svg>
        </>
      )}
    </section>
  );
}

function People() {
  const [search, setSearch] = useState("");
  const query = useDebounced(search.trim(), 300);
  const rows = useQuery(api.admin.people, { search: query || undefined });
  const role = (r: string | null) => (r === "consumer" ? "Member" : r === "student" ? "Student" : r === "dietitian" ? "Dietitian" : "—");
  return (
    <section>
      <div className="admin-toolbar">
        <SearchBox value={search} onChange={setSearch} placeholder="Search name, @username or email" />
        <span className="muted small">{rows ? `${rows.length} ${rows.length === 1 ? "person" : "people"}${rows.length === 200 ? " (first 200)" : ""}` : "Loading…"}</span>
      </div>
      <div className="card table-wrap">
        <table className="table data-table">
          <thead><tr><th>Person</th><th>Role</th><th>Joined</th><th>Last active</th><th>Notes</th></tr></thead>
          <tbody>
            {rows?.map((r) => (
              <tr key={r.id}>
                <td><strong>{r.name ?? <span className="muted">No profile yet</span>}</strong>{r.username && <span className="muted small"> @{r.username}</span>}<span className="muted small" style={{ display: "block" }}>{r.email ?? "no email"}</span></td>
                <td>
                  {role(r.role)}
                  {r.role && r.role !== "consumer" && <span className={`tag ${r.verification === "verified" ? "tag-breakfast" : "tag-outline"}`} style={{ marginLeft: "0.4rem" }}>{r.verification}</span>}
                </td>
                <td className="small">{ago(r.joinedAt)}</td>
                <td className="small">{r.lastActiveAt ? ago(r.lastActiveAt) : <span className="muted">Never</span>}</td>
                <td>
                  {r.hasCondition && <span className="tag tag-lunch">Health condition</span>}
                  {!r.role && <span className="tag tag-outline">Didn't finish sign-up</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows?.length === 0 && <p className="muted small center">No one matches.</p>}
      </div>
    </section>
  );
}

const FEED_ICON = {
  signup: <UserPlus size={16} />,
  profile: <Users size={16} />,
  verification: <ShieldAlert size={16} />,
  enrolment: <HeartPulse size={16} />,
  payment: <Banknote size={16} />,
  payout: <Banknote size={16} />,
  waitlist: <Bell size={16} />,
  chat: <MessageCircle size={16} />,
} as const;

function Feed() {
  const items = useQuery(api.admin.feed, { limit: 60 });
  if (items === undefined) return <SkeletonLines />;
  if (items.length === 0) return <div className="card empty-state"><CalendarRange size={28} aria-hidden /><h2>Nothing yet</h2><p className="muted">Sign-ups, enrolments, payments and verifications will appear here as they happen.</p></div>;
  return (
    <section className="card">
      <ul className="admin-feed">
        {items.map((it, i) => (
          <li key={i}>
            <span className={`admin-feed-icon kind-${it.kind}`} aria-hidden>{FEED_ICON[it.kind]}</span>
            <span className="grow">{it.text}</span>
            <time className="muted small" dateTime={it.at} title={new Date(it.at).toLocaleString("en-NG")}>{ago(it.at)}</time>
          </li>
        ))}
      </ul>
    </section>
  );
}

const LOG_LABEL = {
  verification_approved: { text: "Approved", icon: <CircleCheck size={16} /> },
  verification_rejected: { text: "Rejected", icon: <CircleX size={16} /> },
  payout_recorded: { text: "Payout", icon: <Banknote size={16} /> },
} as const;

/** Every admin action, newest first. Entries can't be edited or deleted from the app. */
function AuditLog() {
  const rows = useQuery(api.admin.log);
  if (rows === undefined) return <SkeletonLines />;
  return (
    <section>
      <p className="small muted">Every approval, rejection and payout, with the admin who did it. Entries can't be changed or removed from the app.</p>
      {rows.length === 0 ? (
        <div className="card empty-state"><h2>No admin actions yet</h2><p className="muted">They'll be listed here as admins approve, reject and pay out.</p></div>
      ) : (
        <div className="card table-wrap">
          <table className="table data-table">
            <thead><tr><th>When</th><th>Action</th><th>Details</th><th>By</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="small" title={new Date(r.at).toLocaleString("en-NG")}>{new Date(r.at).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</td>
                  <td><span className={`admin-log-action log-${r.action}`}>{LOG_LABEL[r.action].icon} {LOG_LABEL[r.action].text}</span></td>
                  <td className="small">{r.detail}</td>
                  <td className="small muted">{r.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

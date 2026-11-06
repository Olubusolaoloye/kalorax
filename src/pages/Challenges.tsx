// Weekly challenges, streaks and badges, plus leaderboards with friends and teams (companies, gyms, clubs).
// Your own card is worked out on the device; leaderboards come from the server with the same scoring.
import { useMutation, useQuery } from "convex/react";
import { Building2, Copy, Dumbbell, LogOut, RefreshCw, Trophy, UserMinus, Users } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Bar, Card, PageHeader, SkeletonLines } from "../components/ui";
import { bestStreak, currentStreak, earnedBadges, nextBadge, scoreWeek, STREAK_BADGES } from "../lib/challenges";
import { errorText } from "../lib/errors";
import { dailyWaterTargetMl } from "../lib/nutrition/water";
import { todayIso, useStore, weekDates } from "../state/store";

type TeamKind = "company" | "gym" | "club";

/** Boards are rebuilt on the server at most every 3 minutes: ask when the page opens, then every 3 minutes while it's open. */
function useRefresh(refresh: () => Promise<unknown>, deps: unknown[]) {
  useEffect(() => {
    const run = () => void refresh().catch(() => {});
    run();
    const t = setInterval(run, 3 * 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
const KIND: Record<TeamKind, { label: string; icon: typeof Building2 }> = {
  company: { label: "Company", icon: Building2 },
  gym: { label: "Gym", icon: Dumbbell },
  club: { label: "Club or group", icon: Users },
};

export function Challenges() {
  const { diary, water, exercises, weights, latestWeightKg, mode } = useStore();
  const today = todayIso();
  const dates = weekDates(today);
  const score = useMemo(() => scoreWeek({
    dates, today,
    diary,
    water: Object.entries(water).map(([date, ml]) => ({ date, ml })),
    waterTargetMl: latestWeightKg ? dailyWaterTargetMl(latestWeightKg) : 0,
    exercises,
    weights,
  }), [diary, water, exercises, weights, latestWeightKg, today]);
  const logged = diary.map((e) => e.date);
  const streak = currentStreak(logged, today);
  const best = Math.max(bestStreak(logged), streak);
  const next = nextBadge(best);
  const earned = new Set(earnedBadges(best).map((b) => b.days));
  const daysLeft = 7 - dates.indexOf(today) - 1;

  return (
    <div className="page">
      <PageHeader title="Challenges" subtitle="Small habits, every week. New challenges every Monday." />

      <section className="card challenge-hero">
        <div className="streak">
          <span className="streak-flame" aria-hidden>🔥</span>
          <div>
            <strong>{streak} day{streak === 1 ? "" : "s"}</strong>
            <span className="muted small">in a row with a meal logged · best {best}</span>
          </div>
        </div>
        <div className="week-points">
          <strong>{score.points}</strong>
          <span className="muted small">points this week</span>
        </div>
      </section>

      <Card title="This week" action={<span className="muted small">{daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : "Last day"}</span>}>
        <ul className="challenge-list">
          {score.challenges.map((c) => (
            <li key={c.id} className={c.done ? "done" : ""}>
              <span className="challenge-emoji" aria-hidden>{c.emoji}</span>
              <div className="grow">
                <Bar value={c.progress} max={c.goal} label={c.title} />
                <span className="small muted">{c.done ? `Done · +${c.points} points` : `${c.progress} of ${c.goal} ${c.unit} · ${c.points} points`}</span>
              </div>
            </li>
          ))}
        </ul>
        <p className="small muted" style={{ marginBottom: 0 }}>Plus 10 points for every day you log a meal. Challenges reward habits, never eating less.</p>
      </Card>

      <Card title="Streak badges">
        <ul className="badge-row">
          {STREAK_BADGES.map((b) => (
            <li key={b.days} className={earned.has(b.days) ? "on" : ""} title={earned.has(b.days) ? `Earned: ${b.name}` : `${b.days} days in a row`}>
              <span aria-hidden>{b.emoji}</span>
              <small>{b.name}</small>
            </li>
          ))}
        </ul>
        <p className="small muted" style={{ marginBottom: 0 }}>{next ? `Log a meal ${next.days - streak} more day${next.days - streak === 1 ? "" : "s"} in a row for "${next.name}".` : "You've earned every badge. Legend."}</p>
      </Card>

      {mode === "cloud" ? (
        <>
          <FriendsBoard weekStart={dates[0]} today={today} />
          <Teams weekStart={dates[0]} today={today} />
        </>
      ) : (
        <Card title="Leaderboards and teams">
          <p className="small" style={{ margin: 0 }}>Compete with friends, or with your company or gym, once you have a Kalorax account.</p>
        </Card>
      )}
    </div>
  );
}

type Row = { me: boolean; name: string; username: string | null; points: number; daysLogged: number; activeMinutes: number };

function Ranking({ rows, extra }: { rows: Row[]; extra?: (r: Row, i: number) => React.ReactNode }) {
  return (
    <ol className="rank-list">
      {rows.map((r, i) => (
        <li key={`${r.username ?? r.name}-${i}`} className={r.me ? "me" : ""}>
          <span className={`rank rank-${i + 1}`}>{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>
          <div className="grow">
            <strong>{r.me ? "You" : r.name}</strong>
            <span className="muted small">{r.daysLogged}/7 days logged · {r.activeMinutes} active min</span>
          </div>
          <strong className="rank-points">{r.points}</strong>
          {extra?.(r, i)}
        </li>
      ))}
    </ol>
  );
}

/** Friends = people you chat with. Both of you have to join before you see each other. */
export function FriendsBoard({ weekStart, today }: { weekStart: string; today: string }) {
  const board = useQuery(api.challenges.friends, { weekStart, today });
  const setLeaderboard = useMutation(api.challenges.setLeaderboard);
  const refresh = useMutation(api.challenges.refreshFriends);
  const joined = board?.joined;
  useRefresh(() => (joined ? refresh({ weekStart, today }) : Promise.resolve()), [joined, weekStart, today]);
  if (board === undefined) return <Card title="Friends"><SkeletonLines rows={3} /></Card>;
  if (board === null) return null;
  return (
    <Card title={<span className="row"><Trophy size={17} /> Friends this week</span>}>
      {!board.joined ? (
        <>
          <p className="small" style={{ marginTop: 0 }}>See how you and the people you chat with are doing this week. Friends see only your points, days logged and active minutes, never your food or weight.</p>
          <button className="btn btn-primary" onClick={() => void setLeaderboard({ on: true })}>Join the leaderboard</button>
        </>
      ) : (
        <>
          <Ranking rows={board.rows} />
          {board.rows.length < 2 && (
            <p className="small muted">
              {board.friendsCount === 0 ? <>No friends yet. Start a chat in <Link to="/messages" className="link">Messages</Link> and ask them to join.</> : "None of your friends have joined yet. Ask them to open Challenges and tap Join."}
            </p>
          )}
          <button className="btn btn-ghost btn-small" onClick={() => void setLeaderboard({ on: false })}>Leave the leaderboard</button>
        </>
      )}
    </Card>
  );
}

export function Teams({ weekStart, today }: { weekStart: string; today: string }) {
  const [params, setParams] = useSearchParams();
  const teams = useQuery(api.teams.mine);
  const create = useMutation(api.teams.create);
  const join = useMutation(api.teams.join);
  const [open, setOpen] = useState<Id<"teams"> | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<TeamKind>("company");
  const [code, setCode] = useState(params.get("join") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (e: FormEvent, fn: () => Promise<Id<"teams">>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setOpen(await fn());
      setName("");
      setCode("");
      if (params.has("join")) setParams({}, { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const selected = open ?? teams?.[0]?.id ?? null;
  return (
    <section className="teams">
      <div className="section-title"><h2>Teams</h2></div>
      <p className="small muted">Weekly challenges with your company, gym or club. Everyone sees the team's points and active minutes, never anyone's food or weight.</p>
      {teams === undefined ? <SkeletonLines rows={2} /> : (
        <>
          {teams.length > 0 && (
            <div className="chip-group chip-scroll" role="group" aria-label="Your teams">
              {teams.map((t) => {
                const Icon = KIND[t.kind].icon;
                return <button key={t.id} className={`chip${selected === t.id ? " on" : ""}`} onClick={() => setOpen(t.id)}><Icon size={14} aria-hidden /> {t.name} · {t.members}</button>;
              })}
            </div>
          )}
          {selected && <TeamBoard key={selected} teamId={selected} weekStart={weekStart} today={today} onLeft={() => setOpen(null)} />}
          <div className="team-forms">
            <form className="card team-form" onSubmit={(e) => void run(e, () => join({ code }))}>
              <h3>Join a team</h3>
              <label className="field"><span>Team code</span><input id="team-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="8 letters and numbers" autoCapitalize="none" maxLength={20} /></label>
              <button className="btn btn-primary" disabled={busy || code.trim().length < 8}>Join</button>
            </form>
            <form className="card team-form" onSubmit={(e) => void run(e, () => create({ name, kind }))}>
              <h3>Start a team</h3>
              <label className="field"><span>Name</span><input id="team-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Lagos office" maxLength={60} /></label>
              <label className="field"><span>Type</span>
                <select id="team-kind" value={kind} onChange={(e) => setKind(e.target.value as TeamKind)}>
                  {(Object.keys(KIND) as TeamKind[]).map((k) => <option key={k} value={k}>{KIND[k].label}</option>)}
                </select>
              </label>
              <button className="btn btn-secondary" disabled={busy || name.trim().length < 2}>Create team</button>
            </form>
          </div>
          {error && <p className="small error" role="alert">{error}</p>}
        </>
      )}
    </section>
  );
}

function TeamBoard({ teamId, weekStart, today, onLeft }: { teamId: Id<"teams">; weekStart: string; today: string; onLeft: () => void }) {
  const board = useQuery(api.teams.board, { teamId, weekStart, today });
  const refresh = useMutation(api.teams.refreshBoard);
  useRefresh(() => refresh({ teamId, weekStart, today }), [teamId, weekStart, today, board?.rows.length === 0]);
  const leave = useMutation(api.teams.leave);
  const removeMember = useMutation(api.teams.removeMember);
  const newCode = useMutation(api.teams.newTeamCode);
  const [copied, setCopied] = useState(false);
  if (board === undefined) return <Card><SkeletonLines rows={4} /></Card>;
  if (board === null) return null;
  const link = board.code ? `${window.location.origin}/challenges?join=${board.code}` : null;
  const copy = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* visible to copy by hand */ }
  };
  return (
    <Card title={board.name} action={<span className="badge">{KIND[board.kind].label}</span>} className="team-board">
      <Bar value={board.activeMinutes} max={board.activeGoal} label="Team goal: 150 active minutes each, together" hint={`${board.activeMinutes.toLocaleString()} / ${board.activeGoal.toLocaleString()} min`} />
      <dl className="team-stats">
        <div><dt>Team points</dt><dd>{board.totalPoints.toLocaleString()}</dd></div>
        <div><dt>Average</dt><dd>{board.averagePoints}</dd></div>
        <div><dt>Members</dt><dd>{board.rows.length}</dd></div>
      </dl>
      <Ranking
        rows={board.rows}
        extra={(r, i) => board.owner && !r.me ? (
          <button className="icon-btn sm ghost" aria-label={`Remove ${r.name}`} onClick={() => { if (confirm(`Remove ${r.name} from ${board.name}?`)) void removeMember({ teamId, userId: board.rows[i].userId }); }}><UserMinus size={15} /></button>
        ) : null}
      />
      {link && (
        <div className="team-invite">
          <span className="small muted">Invite people with this link or the code <strong className="mono">{board.code}</strong></span>
          <div className="row">
            <button className="btn btn-secondary btn-small" onClick={() => void copy()}><Copy size={15} /> {copied ? "Copied" : "Copy invite link"}</button>
            <a className="btn btn-ghost btn-small" href={`https://wa.me/?text=${encodeURIComponent(`Join our team "${board.name}" on Kalorax for weekly health challenges: ${link}`)}`} target="_blank" rel="noreferrer">Share on WhatsApp</a>
            <button className="btn btn-ghost btn-small" onClick={() => { if (confirm("Make a new code? The old link and code stop working.")) void newCode({ teamId }); }}><RefreshCw size={15} /> New code</button>
          </div>
        </div>
      )}
      <button className="btn btn-ghost btn-small" onClick={() => { if (confirm(`Leave ${board.name}?`)) void leave({ teamId }).then(onLeft); }}><LogOut size={15} /> Leave team</button>
    </Card>
  );
}

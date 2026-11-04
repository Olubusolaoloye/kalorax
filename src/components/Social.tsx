// Member-to-member pieces that need an account (Convex): send a plan to a friend, unread badge (friends and programme chats).
// The plan card works in both modes.
import { useMutation, useQuery } from "convex/react";
import { AtSign, CalendarPlus, Check, Copy, Pencil, Send, ShoppingBasket } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { recipeById } from "../data/recipes";
import { errorText } from "../lib/errors";
import { useDebounced } from "../lib/useDebounced";
import { byCategory, CATEGORY_EMOJI, groceryTotal, naira, qtyLabel, type SharedGrocery } from "../lib/grocery";
import { applySharedPlan, mealName, planKcalPerDay, SHARE_MEALS, WEEKDAYS, type SharedPlan } from "../lib/share";
import { fmt } from "../state/derived";
import { shiftDate, todayIso, useStore, weekDates } from "../state/store";
import { Avatar } from "./Layout";
import { Card } from "./ui";

/** Find a member by @username as you type; pick one (or press Enter on an exact username). */
export function PeoplePicker({ label, onPick, busy, error, autoFocus }: { label: string; onPick: (username: string) => void; busy: boolean; error: string | null; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const clean = q.trim().replace(/^@+/, "").toLowerCase();
  const search = useDebounced(clean, 250);
  const results = useQuery(api.social.findPeople, search.length >= 2 ? { q: search } : "skip");
  return (
    <div className="people-picker">
      <form onSubmit={(e) => { e.preventDefault(); if (clean) onPick(clean); }}>
        <label className="field">
          <span>{label}</span>
          <div className="input-icon">
            <AtSign size={17} aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value.replace(/^@+/, ""))} placeholder="username" autoComplete="off" autoCapitalize="none" spellCheck={false} autoFocus={autoFocus} aria-describedby="picker-hint" />
          </div>
        </label>
      </form>
      {clean.length >= 2 && results && (
        results.length ? (
          <ul className="people-results">
            {results.map((p) => (
              <li key={p.username}>
                <button className="people-result" disabled={busy} onClick={() => onPick(p.username)}>
                  <Avatar name={p.name} />
                  <span className="grow">
                    <strong>{p.name}</strong>
                    <span className="muted small">@{p.username}{p.role === "dietitian" ? " · Dietitian" : p.role === "student" ? " · Nutrition student" : ""}{p.verified ? " ✓" : ""}</span>
                  </span>
                  <Send size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">No one has a username starting with @{clean}.</p>
        )
      )}
      {clean.length < 2 && <p id="picker-hint" className="small muted">Type at least 2 letters of their username.</p>}
      {error && <p className="small error" role="alert">{error}</p>}
    </div>
  );
}

/** What can be sent to a friend from a share sheet. */
export type FriendPayload = { plan: SharedPlan } | { grocery: SharedGrocery; checked: string[] };

/** Starts (or reopens) a chat by @username, sends the plan or grocery list, then opens the chat. */
export function CloudSendToFriend({ payload }: { payload: FriendPayload }) {
  const start = useMutation(api.social.start);
  const send = useMutation(api.social.send);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="share-friend">
      <PeoplePicker
        label="Send to a Nutrintel friend"
        busy={busy}
        error={error}
        onPick={async (username) => {
          setBusy(true);
          setError(null);
          try {
            const id = await start({ username });
            await send({ conversationId: id, text: "", ...payload });
            navigate(`/messages?c=${id}`);
          } catch (err) {
            setError(errorText(err));
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

/** Gives members who joined before usernames existed their @username, once. */
export function CloudEnsureUsername() {
  const { profile } = useStore();
  const ensure = useMutation(api.profile.ensureUsername);
  const asked = useRef(false);
  useEffect(() => {
    if (profile && !profile.username && !asked.current) {
      asked.current = true;
      void ensure({}).catch(() => { asked.current = false; });
    }
  }, [profile, ensure]);
  return null;
}

/** Your @username on the Me page: copy it, or change it (with a live availability check). */
export function UsernameCard() {
  const { profile } = useStore();
  const save = useMutation(api.profile.setUsername);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const clean = draft.trim().replace(/^@+/, "").toLowerCase();
  const changed = editing && clean !== (profile?.username ?? "");
  // Checked once typing pauses; until then it reads "Checking…".
  const settled = useDebounced(clean, 300);
  const problem = useQuery(api.profile.usernameAvailable, changed && clean && settled === clean ? { username: clean } : "skip");
  if (!profile) return null;
  const mine = profile.username;
  return (
    <Card title="Your username">
      {!editing ? (
        <>
          <p className="username-big">{mine ? `@${mine}` : "Making your username…"}</p>
          <p className="small muted">Friends find you by your username to chat and share meal plans. Your email stays private.</p>
          <div className="row">
            <button className="btn btn-secondary btn-small" disabled={!mine} onClick={async () => { try { await navigator.clipboard.writeText(`@${mine}`); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ } }}>
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy"}
            </button>
            <button className="btn btn-ghost btn-small" disabled={!mine} onClick={() => { setDraft(mine ?? ""); setEditing(true); setError(null); }}><Pencil size={15} /> Change</button>
          </div>
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await save({ username: clean });
              setEditing(false);
            } catch (err) {
              setError(errorText(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field">
            <span>New username</span>
            <div className="input-icon">
              <AtSign size={17} aria-hidden />
              <input value={draft} onChange={(e) => setDraft(e.target.value.replace(/^@+/, ""))} maxLength={20} autoComplete="off" autoCapitalize="none" spellCheck={false} autoFocus />
            </div>
          </label>
          <p className={`small ${changed && problem ? "error" : "muted"}`} role="status">
            {!changed ? "3–20 characters: letters, numbers, _ and ." : problem === undefined ? "Checking…" : problem ?? `@${clean} is available.`}
          </p>
          {error && <p className="small error" role="alert">{error}</p>}
          <div className="row">
            <button className="btn btn-primary btn-small" disabled={busy || !changed || problem !== null}>Save</button>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      )}
    </Card>
  );
}

export function CloudUnreadBadge() {
  const inbox = useQuery(api.social.inbox);
  const programmes = useQuery(api.interventions.programmeChats);
  const n = [...(inbox ?? []), ...(programmes ?? [])].reduce((t, c) => t + c.unread, 0);
  return n ? <span className="nav-badge" aria-label={`${n} unread`}>{n > 99 ? "99+" : n}</span> : null;
}

/** A shared week in a chat: what's in it, and a button to copy it into this week or next. */
export function PlanCard({ plan, fromMe }: { plan: SharedPlan; fromMe: boolean }) {
  const { plan: mine, replacePlan } = useStore();
  const [added, setAdded] = useState<string | null>(null);
  const days = [...new Set(plan.items.map((it) => it.day))].sort((a, b) => a - b);
  const kcal = planKcalPerDay(plan);

  const addTo = (offsetWeeks: number) => {
    const week = weekDates(shiftDate(todayIso(), 7 * offsetWeeks));
    const items = applySharedPlan(plan, week);
    const replaced = items.filter((it) => mine[it.date]?.[it.meal]).length;
    if (replaced && !confirm(`This replaces ${replaced} ${replaced === 1 ? "meal" : "meals"} you already planned that week. Continue?`)) return;
    replacePlan(items);
    setAdded(offsetWeeks === 0 ? "this week" : "next week");
  };

  return (
    <div className="plan-card">
      <div className="plan-card-head">
        <strong>📅 {plan.title}</strong>
        <span className="muted small">{plan.items.length} meals{kcal ? ` · ~${fmt(kcal)} kcal a day` : ""}</span>
      </div>
      <ul>
        {days.map((day) => (
          <li key={day}>
            <span className="plan-card-day">{WEEKDAYS[day].slice(0, 3)}</span>
            <span className="plan-card-meals">
              {SHARE_MEALS.map((m) => {
                const it = plan.items.find((x) => x.day === day && x.meal === m);
                const r = it && recipeById(it.recipeId);
                return r ? <span key={m} title={mealName(m)}>{r.emoji} {r.name}</span> : null;
              })}
            </span>
          </li>
        ))}
      </ul>
      {!fromMe && (added ? (
        <p className="small ok"><Check size={14} aria-hidden /> Added to your plan for {added}.</p>
      ) : (
        <div className="row">
          <button className="btn btn-primary btn-small" onClick={() => addTo(0)}><CalendarPlus size={15} /> Use this week</button>
          <button className="btn btn-secondary btn-small" onClick={() => addTo(1)}>Use next week</button>
        </div>
      ))}
    </div>
  );
}

/**
 * A grocery list in a chat: a checklist both people can tick (e.g. one plans, the other shops).
 * Ticks save straight away and show for both.
 */
export function GroceryCard({ messageId, grocery, checked, disabled }: { messageId: string; grocery: SharedGrocery; checked: string[]; disabled?: boolean }) {
  const tick = useMutation(api.social.tickGroceryItem);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const done = new Set(checked);
  const isDone = (key: string) => pending[key] ?? done.has(key);
  const count = grocery.items.filter((i) => isDone(i.key)).length;
  const toggle = async (key: string) => {
    const next = !isDone(key);
    setPending((p) => ({ ...p, [key]: next }));
    setError(null);
    try {
      await tick({ messageId: messageId as Id<"directMessages">, key, done: next });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending((p) => {
        const { [key]: _, ...rest } = p;
        return rest;
      });
    }
  };
  return (
    <div className="plan-card grocery-card">
      <div className="plan-card-head">
        <strong><ShoppingBasket size={15} aria-hidden /> {grocery.title}</strong>
        <span className="muted small">
          {count} of {grocery.items.length} bought · about {naira(groceryTotal(grocery))}{grocery.people > 1 ? ` · for ${grocery.people}` : ""}
        </span>
        <span className="grocery-progress" aria-hidden><span style={{ width: `${(count / grocery.items.length) * 100}%` }} /></span>
      </div>
      {byCategory(grocery).map(({ category, items }) => (
        <div key={category} className="grocery-group">
          <span className="grocery-group-title">{CATEGORY_EMOJI[category]} {category}</span>
          <ul>
            {items.map((i) => (
              <li key={i.key}>
                <label className={isDone(i.key) ? "is-done" : ""}>
                  <input type="checkbox" checked={isDone(i.key)} disabled={disabled} onChange={() => void toggle(i.key)} />
                  <span className="grow">{i.name}</span>
                  <span className="muted">{qtyLabel(i.qty, i.unit)}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {error && <p className="small error" role="alert">{error}</p>}
    </div>
  );
}

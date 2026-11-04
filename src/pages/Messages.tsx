import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Ban, CalendarRange, Flag, HeartPulse, MessageCirclePlus, Pin, Share2, ShieldCheck, ShoppingBasket, Stethoscope, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { MessageBox } from "../components/MessageBox";
import { CloudNotifyNudge } from "../components/ReminderChannels";
import { GroceryCard, PeoplePicker, PlanCard } from "../components/Social";
import { Avatar } from "../components/Layout";
import { PageHeader, SearchBox, Sheet, SkeletonLines } from "../components/ui";
import { errorText } from "../lib/errors";
import { grocerySnapshot, weekGroceryLines, type SharedGrocery } from "../lib/grocery";
import { planSnapshot, type SharedPlan } from "../lib/share";
import { shiftDate, todayIso, useStore, weekDates } from "../state/store";

export function Messages() {
  const { mode } = useStore();
  return mode === "cloud" ? <CloudMessages /> : <LocalMessages />;
}

const when = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-CA") === todayIso()
    ? d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
};

/** The first pinned chat until you join a programme: a way in to working with a dietitian. */
function ProgrammesPromo() {
  return (
    <Link to="/programmes" className="thread pinned-thread">
      <span className="avatar" aria-hidden>🩺</span>
      <span className="grow thread-body">
        <strong>Check out our programmes</strong>
        <span className="thread-preview">Work 1-to-1 with a verified dietitian. Your chat with them opens here.</span>
      </span>
      <Pin size={15} className="pin-icon" aria-label="Pinned" />
    </Link>
  );
}

/** Without accounts there's no one to message, but sharing still works. */
function LocalMessages() {
  return (
    <div className="page">
      <PageHeader title="Messages" subtitle="Chat with friends and share your journey" />
      <ul className="pinned-list card">
        <li><ProgrammesPromo /></li>
      </ul>
      <div className="card empty-state">
        <div className="empty-art" aria-hidden>💬</div>
        <h2>Messaging needs a Kalorax account</h2>
        <p className="muted">This version saves everything on your device. You can still share your meal plan and progress on WhatsApp and Instagram.</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link to="/plan?share=1" className="btn btn-primary"><CalendarRange size={18} /> Share my meal plan</Link>
          <Link to="/progress?share=1" className="btn btn-secondary"><TrendingUp size={18} /> Share my journey</Link>
        </div>
      </div>
    </div>
  );
}

function CloudMessages() {
  const [params, setParams] = useSearchParams();
  const inbox = useQuery(api.social.inbox);
  const programmes = useQuery(api.interventions.programmeChats);
  const { profile } = useStore();
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const activeId = params.get("c");
  const programmeId = params.get("p");
  const open = (id: string | null) => setParams(id ? { c: id } : {}, { replace: !id });
  const openProgramme = (id: string) => setParams({ p: id });
  const q = query.trim().toLowerCase();
  const list = (inbox ?? []).filter((c) => !q || c.name.toLowerCase().includes(q) || (c.username ?? "").includes(q.replace(/^@/, "")));
  const active = inbox?.find((c) => c.id === activeId) ?? null;
  // On phones an open chat fills the screen, without the tab bar (see .chat-open in styles.css).
  const chatOpen = !!(activeId || programmeId);
  useEffect(() => {
    if (!chatOpen) return;
    document.body.classList.add("chat-open");
    return () => document.body.classList.remove("chat-open");
  }, [chatOpen]);

  return (
    <div className="page page-wide">
      <PageHeader title="Messages" subtitle="Chat with friends and share your meal plan">
        <button className="btn btn-primary" onClick={() => setComposing(true)}><MessageCirclePlus size={18} /> New message</button>
      </PageHeader>
      <CloudNotifyNudge />
      <div className={`chat-layout${chatOpen ? " has-active" : ""}`}>
        <section className="card chat-list">
          <SearchBox value={query} onChange={setQuery} placeholder="Search chats by name or @username" />
          {!q && (
            <ul className="pinned-list" aria-label="Pinned">
              {programmes?.map((c) => (
                <li key={c.id}>
                  <button className={`thread pinned-thread${c.id === programmeId ? " on" : ""}`} onClick={() => openProgramme(c.id)}>
                    <Avatar name={c.name} />
                    <span className="grow thread-body">
                      <span className="row" style={{ justifyContent: "space-between" }}>
                        <strong>{c.name}</strong>
                        <span className="muted small">{when(c.lastAt)}</span>
                      </span>
                      <span className="pinned-label"><Stethoscope size={12} aria-hidden /> {c.role === "member" ? "Your dietitian" : "Client"} · {c.programme}</span>
                      <span className="thread-preview">
                        {c.endedByThem && !c.endedByMe ? "🏁 Asked to end the programme — tap to confirm" : c.lastText ? `${c.lastFromMe ? "You: " : ""}${c.lastText}` : "Say hello 👋"}
                      </span>
                    </span>
                    {c.unread > 0 ? <span className="unread" aria-label={`${c.unread} unread`}>{c.unread}</span> : <Pin size={15} className="pin-icon" aria-label="Pinned" />}
                  </button>
                </li>
              ))}
              {programmes?.length === 0 && profile?.role !== "dietitian" && <li><ProgrammesPromo /></li>}
            </ul>
          )}
          {inbox === undefined ? (
            <SkeletonLines rows={4} />
          ) : list.length === 0 ? (
            <p className="muted small chat-empty">{q ? "No chats match." : "No messages yet. Find a friend by their @username, or send them your meal plan."}</p>
          ) : (
            <ul>
              {list.map((c) => (
                <li key={c.id}>
                  <button className={`thread${c.id === activeId ? " on" : ""}`} onClick={() => open(c.id)}>
                    <Avatar name={c.name} />
                    <span className="grow thread-body">
                      <span className="row" style={{ justifyContent: "space-between" }}>
                        <strong>{c.name}{c.username && <span className="muted handle"> @{c.username}</span>}</strong>
                        <span className="muted small">{when(c.lastAt)}</span>
                      </span>
                      <span className="thread-preview">{c.blocked ? "Blocked" : c.lastText ? `${c.lastFromMe ? "You: " : ""}${c.lastText}` : "Say hello 👋"}</span>
                    </span>
                    {c.unread > 0 && <span className="unread" aria-label={`${c.unread} unread`}>{c.unread}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="small muted chat-note"><HeartPulse size={14} aria-hidden />Programme chats stay pinned at the top until you and your dietitian both end the programme.</p>
        </section>

        {programmeId ? (
          <ProgrammeThreadView key={programmeId} id={programmeId} onBack={() => open(null)} />
        ) : active ? (
          <ThreadView key={active.id} id={active.id} onBack={() => open(null)} />
        ) : (
          <section className="card chat-thread chat-placeholder">
            {activeId && inbox ? <p className="muted">This chat isn't available.</p> : (
              <>
                <div className="empty-art" aria-hidden>💬</div>
                <p className="muted">Pick a chat, or start a new one to share your meal plan with a friend.</p>
              </>
            )}
          </section>
        )}

        <aside className="card chat-profile">
          <span className="avatar lg" aria-hidden>💚</span>
          <strong>Share your journey</strong>
          <p className="small muted">Send a week of your meal plan and your friend can add it to their own plan in one tap.</p>
          <Link to="/progress?share=1" className="btn btn-secondary btn-small"><Share2 size={15} /> Share my progress</Link>
          <p className="small chat-note"><ShieldCheck size={15} aria-hidden />Only the people in a chat can read it. Block anyone who bothers you.</p>
        </aside>
      </div>
      {composing && <NewChat onClose={() => setComposing(false)} onOpen={(id) => { setComposing(false); open(id); }} />}
    </div>
  );
}

function NewChat({ onClose, onOpen }: { onClose: () => void; onOpen: (id: string) => void }) {
  const { profile } = useStore();
  const start = useMutation(api.social.start);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet title="New message" onClose={onClose}>
      <PeoplePicker
        label="Find a friend by username"
        autoFocus
        busy={busy}
        error={error}
        onPick={async (username) => {
          setBusy(true);
          setError(null);
          try {
            onOpen(await start({ username }));
          } catch (err) {
            setError(errorText(err));
            setBusy(false);
          }
        }}
      />
      {profile?.username && (
        <p className="small muted center">Your username is <strong>@{profile.username}</strong>. Share it so friends can find you.</p>
      )}
    </Sheet>
  );
}

function ThreadView({ id, onBack }: { id: string; onBack: () => void }) {
  const conversationId = id as Id<"conversations">;
  const t = useQuery(api.social.thread, { conversationId });
  // The message shows straight away; the server's copy replaces it a moment later.
  const send = useMutation(api.social.send).withOptimisticUpdate((store, { conversationId, text, plan, grocery, checked }) => {
    const current = store.getQuery(api.social.thread, { conversationId });
    if (!current) return;
    const pending = { id: `temp_${crypto.randomUUID()}` as Id<"directMessages">, fromMe: true, text: text.trim(), plan: plan ?? null, grocery: grocery ?? null, checked: checked ?? [], sentAt: new Date().toISOString() };
    store.setQuery(api.social.thread, { conversationId }, { ...current, messages: [...current.messages, pending] });
  });
  const markRead = useMutation(api.social.markRead);
  const setBlocked = useMutation(api.social.setBlocked);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<"plan" | "grocery" | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const count = t?.messages.length ?? 0;

  const markReadRef = useRef(markRead);
  markReadRef.current = markRead;
  // Mark read when the chat opens and whenever a message arrives.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
    if (count) void markReadRef.current({ conversationId }).catch(() => {});
  }, [count, conversationId]);

  const deliver = async (body: { text: string; plan?: SharedPlan; grocery?: SharedGrocery; checked?: string[] }) => {
    setBusy(true);
    setError(null);
    try {
      await send({ conversationId, ...body });
      return true;
    } catch (err) {
      setError(errorText(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    const sent = text;
    setText("");
    // Put the text back if it couldn't be sent, so nothing is lost.
    if (!(await deliver({ text: sent }))) setText((now) => now || sent);
  };

  return (
    <section className="card chat-thread">
      <header className="chat-head">
        <button className="icon-btn sm ghost chat-back" onClick={onBack} aria-label="Back to chats"><ArrowLeft size={16} /></button>
        <Avatar name={t?.name ?? "?"} />
        <div className="grow">
          <strong>{t?.name ?? "…"}</strong>
          <span className="muted small" style={{ display: "block" }}>{t?.username ? `@${t.username}` : "Kalorax member"}</span>
        </div>
        {t && (!t.blocked || t.blockedByMe) && (
          <button
            className="btn btn-ghost btn-small"
            onClick={() => {
              if (t.blockedByMe || confirm(`Block ${t.name}? Neither of you will be able to send messages in this chat.`)) {
                void setBlocked({ conversationId, blocked: !t.blockedByMe });
              }
            }}
          >
            <Ban size={15} /> {t.blockedByMe ? "Unblock" : "Block"}
          </button>
        )}
      </header>
      <div className="chat-body" aria-live="polite">
        {t === undefined && <SkeletonLines rows={4} />}
        {t?.messages.length === 0 && <p className="muted small center">No messages yet. Say hello, or send your meal plan.</p>}
        {t?.messages.map((m) => (
          <div key={m.id} className={`bubble ${m.fromMe ? "me" : "them"}${m.plan || m.grocery ? " has-plan" : ""}`}>
            {m.plan && <PlanCard plan={m.plan} fromMe={m.fromMe} />}
            {m.grocery && <GroceryCard messageId={m.id} grocery={m.grocery as SharedGrocery} checked={m.checked} disabled={t.blocked || m.id.startsWith("temp_")} />}
            {m.text && <p>{m.text}</p>}
            <span>{m.fromMe ? "You" : t.name} · {when(m.sentAt)}</span>
          </div>
        ))}
        <div ref={end} />
      </div>
      {t?.blocked ? (
        <p className="small muted chat-blocked">{t.blockedByMe ? "You blocked this chat. Unblock to send messages." : "You can't send messages in this chat."}</p>
      ) : (
        <MessageBox
          value={text}
          onChange={setText}
          onSend={submit}
          busy={busy}
          before={
            <>
              <button type="button" className="icon-btn sm ghost" onClick={() => setPicking("plan")} aria-label="Send my meal plan" title="Send my meal plan"><CalendarRange size={17} /></button>
              <button type="button" className="icon-btn sm ghost" onClick={() => setPicking("grocery")} aria-label="Send my grocery list" title="Send my grocery list"><ShoppingBasket size={17} /></button>
            </>
          }
        />
      )}
      {error && <p className="small error chat-error" role="alert">{error}</p>}
      {picking && <PickWeek what={picking} onClose={() => setPicking(null)} onSend={async (body) => { if (await deliver({ text: "", ...body })) setPicking(null); }} />}
    </section>
  );
}

/** "Dr Funke Adeyemi" → "Dr Funke", "Adaeze Okafor" → "Adaeze". */
const shortName = (name: string) => name.match(/^((?:dr|prof|mr|mrs|ms)\.?\s+)?\S+/i)?.[0] ?? name;

/** A member ↔ dietitian programme chat. Either side can end the programme; it ends once both have confirmed. */
function ProgrammeThreadView({ id, onBack }: { id: string; onBack: () => void }) {
  const t = useQuery(api.interventions.programmeThread, { enrolmentId: id });
  const send = useMutation(api.interventions.sendMessage);
  const markRead = useMutation(api.interventions.markRead);
  const endProgramme = useMutation(api.interventions.endProgramme);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const count = t?.messages.length ?? 0;
  const enrolmentId = id as Id<"enrolments">;

  const markReadRef = useRef(markRead);
  markReadRef.current = markRead;
  const live = t?.status === "active";
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
    if (count && live) void markReadRef.current({ enrolmentId }).catch(() => {});
  }, [count, enrolmentId, live]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (err) {
      setError(errorText(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (t === null) {
    return (
      <section className="card chat-thread chat-placeholder">
        <button className="icon-btn sm ghost chat-back" onClick={onBack} aria-label="Back to chats"><ArrowLeft size={16} /></button>
        <p className="muted">This chat isn't available.</p>
      </section>
    );
  }
  const first = t ? shortName(t.name) : "";
  const setEnded = (ended: boolean) => {
    if (ended && !t!.endedByThem && !confirm(`End this programme? It ends once ${first} confirms too.`)) return;
    void run(() => endProgramme({ enrolmentId, ended }));
  };

  return (
    <section className="card chat-thread">
      <header className="chat-head">
        <button className="icon-btn sm ghost chat-back" onClick={onBack} aria-label="Back to chats"><ArrowLeft size={16} /></button>
        <Avatar name={t?.name ?? "?"} />
        <div className="grow">
          <strong>{t?.name ?? "…"}</strong>
          <span className="muted small" style={{ display: "block" }}>{t ? `${t.role === "member" ? "Your dietitian" : "Client"} · ${t.programme}` : ""}</span>
        </div>
        {t && (
          <Link to={t.role === "member" ? `/my-programmes/${id}` : `/clients/${id}`} className="btn btn-ghost btn-small">
            <Stethoscope size={15} /> <span className="hide-xs">Programme</span>
          </Link>
        )}
      </header>
      {t && live && (t.endedByThem || t.endedByMe) && (
        <div className="chat-banner" role="status">
          {t.endedByThem && !t.endedByMe ? (
            <>
              <span className="grow">🏁 {first} marked the programme as finished.</span>
              <button className="btn btn-primary btn-small" disabled={busy} onClick={() => setEnded(true)}>Confirm end</button>
              <button className="btn btn-ghost btn-small" disabled={busy} onClick={() => setEnded(false)}>Keep going</button>
            </>
          ) : (
            <>
              <span className="grow">Waiting for {first} to confirm the programme has ended.</span>
              <button className="btn btn-ghost btn-small" disabled={busy} onClick={() => setEnded(false)}>Undo</button>
            </>
          )}
        </div>
      )}
      <div className="chat-body" aria-live="polite">
        {t === undefined && <SkeletonLines rows={4} />}
        {t?.messages.length === 0 && (
          <p className="muted small center">{t.role === "member" ? `Say hello to ${first} — tell them about your goals and anything you'd like help with.` : `Say hello to ${first} and let them know what happens next.`}</p>
        )}
        {t?.messages.map((m) => (
          <div key={m.id} className={`bubble ${m.fromMe ? "me" : "them"}`}>
            <p>{m.text}</p>
            <span>{m.fromMe ? "You" : m.senderName} · {when(m.sentAt)}</span>
          </div>
        ))}
        <div ref={end} />
      </div>
      {t && !live ? (
        <p className="small muted chat-blocked">{t.status === "completed" ? "This programme has ended. The chat stays here for your records." : "Messages open once the programme is paid for."}</p>
      ) : (
        <MessageBox
          value={text}
          onChange={setText}
          onSend={async () => { if (await run(() => send({ enrolmentId, text }))) setText(""); }}
          busy={busy}
          placeholder={first ? `Message ${first}…` : undefined}
          before={
            t && !t.endedByMe && !t.endedByThem ? (
              <button type="button" className="icon-btn sm ghost" onClick={() => setEnded(true)} aria-label="End programme" title="End programme"><Flag size={17} /></button>
            ) : undefined
          }
        />
      )}
      {error && <p className="small error chat-error" role="alert">{error}</p>}
    </section>
  );
}

/** Choose which week of your plan, or of your grocery list, to send. */
function PickWeek({ what, onClose, onSend }: { what: "plan" | "grocery"; onClose: () => void; onSend: (body: { plan: SharedPlan } | { grocery: SharedGrocery; checked: string[] }) => void }) {
  const { plan, planPortions, grocery } = useStore();
  const weeks = [0, 1].map((offset) => {
    const dates = weekDates(shiftDate(todayIso(), 7 * offset));
    if (what === "plan") {
      const shared = planSnapshot(plan, planPortions, dates);
      return { offset, title: shared.title, count: shared.items.length, label: "planned meals", body: { plan: shared } };
    }
    const lines = weekGroceryLines(plan, planPortions, grocery, dates);
    const shared = grocerySnapshot(lines, grocery.people, dates[0]);
    const checked = lines.filter((l) => grocery.purchased[l.key]).map((l) => l.key);
    return { offset, title: shared.title, count: shared.items.length, label: "items to buy", body: { grocery: shared, checked } };
  });
  return (
    <Sheet title={what === "plan" ? "Send my meal plan" : "Send my grocery list"} onClose={onClose}>
      <ul className="food-rows">
        {weeks.map((w) => (
          <li key={w.offset}>
            <button className="food-row" disabled={!w.count} onClick={() => onSend(w.body)}>
              <span className="thumb sm" aria-hidden><span className="thumb-emoji">{what === "plan" ? "📅" : "🧺"}</span></span>
              <div className="food-row-body">
                <strong>{w.offset === 0 ? "This week" : "Next week"} · {w.title}</strong>
                <span className="muted small">{w.count ? `${w.count} ${w.label}` : "Nothing planned yet"}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
      <p className="small muted">
        {what === "plan" ? "Plan a week on the " : "Your grocery list comes from your "}<Link to="/plan">Meal plan</Link>{what === "plan" ? " page first if both are empty." : ". Plan some meals first if both are empty."}
      </p>
    </Sheet>
  );
}

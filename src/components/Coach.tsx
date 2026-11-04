// Kalorax Coach chat (cloud mode): an AI companion that reads the member's logs, answers questions and
// offers one-tap actions (add to diary / add to plan). Replies stream in from convex/coachAgent.ts.
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, CalendarPlus, Check, NotebookPen, RotateCcw, ShieldCheck, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { errorText } from "../lib/errors";
import { LogoMark } from "./Logo";
import { MessageBox } from "./MessageBox";

const STARTERS = [
  "What should I eat for dinner tonight?",
  "I had eba and egusi soup for lunch",
  "Plan a cheap, high-protein breakfast for tomorrow",
  "How did I do this week?",
];

const dayLabel = (date: string) => {
  const today = new Date().toLocaleDateString("en-CA");
  if (date === today) return "today";
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
};

/** Pinned entry at the top of the chat list. */
export function CoachThreadButton({ active, onOpen }: { active: boolean; onOpen: () => void }) {
  return (
    <button className={`thread pinned-thread${active ? " on" : ""}`} onClick={onOpen}>
      <span className="avatar coach-avatar" aria-hidden><LogoMark size={22} /></span>
      <span className="grow thread-body">
        <strong>Kalorax Coach</strong>
        <span className="pinned-label"><Sparkles size={12} aria-hidden /> AI companion</span>
        <span className="thread-preview">Ask what to eat, log a meal by chat, or plan your week.</span>
      </span>
    </button>
  );
}

export function CoachThread({ onBack }: { onBack: () => void }) {
  const data = useQuery(api.coach.thread);
  const consent = useMutation(api.coach.consent);
  const send = useMutation(api.coach.send);
  const apply = useMutation(api.coach.applyAction);
  const dismiss = useMutation(api.coach.dismissAction);
  const clear = useMutation(api.coach.clear);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const last = data?.messages.at(-1);
  const streaming = last?.role === "assistant" && last.status === "streaming";

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [data?.messages.length, last?.text]);

  const ask = async (message: string) => {
    setError(null);
    setSending(true);
    setText("");
    try {
      await send({ text: message });
    } catch (err) {
      setError(errorText(err));
      setText((now) => now || message);
    } finally {
      setSending(false);
    }
  };

  const header = (
    <header className="chat-head">
      <button className="icon-btn sm ghost chat-back" onClick={onBack} aria-label="Back to chats"><ArrowLeft size={16} /></button>
      <span className="avatar coach-avatar" aria-hidden><LogoMark size={22} /></span>
      <div className="grow">
        <strong>Kalorax Coach</strong>
        <span className="muted small" style={{ display: "block" }}>AI companion · can make mistakes</span>
      </div>
      {!!data?.messages.length && (
        <button className="btn btn-ghost btn-small" disabled={streaming} onClick={() => { if (confirm("Clear this chat? Your diary and plan stay as they are.")) void clear(); }}>
          <RotateCcw size={15} /> Clear
        </button>
      )}
    </header>
  );

  if (data === undefined) return <section className="card chat-thread">{header}<div className="chat-body"><p className="muted small center">Loading…</p></div></section>;
  if (data === null) return <section className="card chat-thread">{header}<div className="chat-body"><p className="muted small center">The coach isn't available for this account.</p></div></section>;

  if (!data.enabled) {
    return (
      <section className="card chat-thread">
        {header}
        <div className="chat-body coach-intro">
          <div className="empty-art" aria-hidden>🤖</div>
          <p className="muted">The Kalorax Coach is coming soon. It will answer questions about your meals, log food for you in one tap and help plan your week.</p>
        </div>
      </section>
    );
  }

  if (!data.consented) {
    return (
      <section className="card chat-thread">
        {header}
        <div className="chat-body coach-intro">
          <span className="avatar lg coach-avatar" aria-hidden><LogoMark size={40} /></span>
          <h2>Meet your Kalorax Coach</h2>
          <p>Ask what to eat, tell it what you had and add it to your diary in one tap, plan meals within your budget, or check how your week went.</p>
          <ul className="coach-points small">
            <li><ShieldCheck size={15} aria-hidden /> To answer, the coach reads your profile, target, food diary, water, weight and meal plan. These are sent to our AI provider (Anthropic) to write each reply, and aren't used to train AI models.</li>
            <li><Check size={15} aria-hidden /> It never changes your diary or plan by itself: you tap to add what it suggests.</li>
            <li><Sparkles size={15} aria-hidden /> It's an AI and can make mistakes. It isn't medical advice: for health conditions, work with a verified dietitian under Programmes.</li>
            {data.limit !== null && <li><NotebookPen size={15} aria-hidden /> Up to {data.limit} messages a day.</li>}
          </ul>
          <button className="btn btn-primary" onClick={() => void consent()}>Agree and start</button>
        </div>
      </section>
    );
  }

  const outOfMessages = data.remaining === 0;
  return (
    <section className="card chat-thread">
      {header}
      <div className="chat-body" aria-live="polite">
        {data.messages.length === 0 && (
          <div className="coach-intro">
            <p className="muted small">Hi! Ask me anything about your food and fitness, or try:</p>
            <div className="coach-starters">
              {STARTERS.map((s) => (
                <button key={s} className="chip" disabled={sending || outOfMessages} onClick={() => void ask(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {data.messages.map((m) => (
          <div key={m.id} className={`bubble ${m.role === "user" ? "me" : "them coach-bubble"}${m.status === "error" ? " is-error" : ""}`}>
            {m.role === "assistant" && m.status === "streaming" && !m.text ? (
              <p className="coach-typing" aria-label="The coach is typing"><i /><i /><i /></p>
            ) : (
              <p>{m.text}{m.status === "streaming" && <span className="coach-caret" aria-hidden />}</p>
            )}
            {m.actions.map((a) => (
              <div key={a.id} className={`coach-action is-${a.state}`}>
                <span className="grow">
                  <strong>{a.label}</strong>
                  <small>{a.kcal} kcal · {a.meal} {dayLabel(a.date)}</small>
                </span>
                {a.state === "pending" ? (
                  <>
                    <button className="btn btn-primary btn-small" onClick={() => void apply({ messageId: m.id as Id<"coachMessages">, actionId: a.id }).catch((err) => setError(errorText(err)))}>
                      {a.kind === "log_food" ? <><NotebookPen size={14} /> Add to diary</> : <><CalendarPlus size={14} /> Add to plan</>}
                    </button>
                    <button className="icon-btn sm ghost" aria-label="No thanks" onClick={() => void dismiss({ messageId: m.id as Id<"coachMessages">, actionId: a.id })}><X size={15} /></button>
                  </>
                ) : (
                  <small className="muted">{a.state === "done" ? <><Check size={13} aria-hidden /> {a.kind === "log_food" ? "Added to diary" : "Added to plan"}</> : "Skipped"}</small>
                )}
              </div>
            ))}
          </div>
        ))}
        <div ref={end} />
      </div>
      {outOfMessages ? (
        <p className="small muted chat-blocked">You've used today's {data.limit} coach messages. They reset at midnight.</p>
      ) : (
        <MessageBox value={text} onChange={setText} onSend={() => void ask(text)} busy={sending || streaming} placeholder="Ask your coach…" />
      )}
      {data.remaining !== null && !outOfMessages && <p className="small muted coach-remaining">{data.remaining} of {data.limit} messages left today</p>}
      {error && <p className="small error chat-error" role="alert">{error}</p>}
    </section>
  );
}

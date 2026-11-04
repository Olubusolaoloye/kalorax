import { NotebookPen, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { FEELINGS, NOTE_TAGS, noteKey, useStore, type DiaryNote, type NoteSlot } from "../state/store";

const MAX_TEXT = 500;

/** "How did you feel?" note for a meal, or the whole day when slot is "Day". */
export function NoteCard({ date, slot, notes }: { date: string; slot: NoteSlot; notes: Record<string, DiaryNote> }) {
  const { setNote } = useStore();
  const note = notes[noteKey(date, slot)];
  const [editing, setEditing] = useState(false);
  const [feeling, setFeeling] = useState<number | undefined>(note?.feeling);
  const [tags, setTags] = useState<string[]>(note?.tags ?? []);
  const [text, setText] = useState(note?.text ?? "");

  const isDay = slot === "Day";
  const prompt = isDay ? "How was your day of eating?" : `How did you feel after ${slot.toLowerCase()}?`;

  const startEdit = () => {
    setFeeling(note?.feeling);
    setTags(note?.tags ?? []);
    setText(note?.text ?? "");
    setEditing(true);
  };
  const save = () => {
    const empty = feeling === undefined && tags.length === 0 && !text.trim();
    setNote(date, slot, empty ? null : { feeling, tags, text: text.trim() });
    setEditing(false);
  };

  if (!editing && !note) {
    return (
      <button className={`note-add${isDay ? " note-add-day" : ""}`} onClick={startEdit}>
        <NotebookPen size={16} aria-hidden /> {isDay ? "Write a day reflection" : "Add a note on how you felt"}
      </button>
    );
  }

  if (!editing && note) {
    const f = FEELINGS.find((x) => x.value === note.feeling);
    return (
      <div className="note">
        <div className="note-head">
          <span className="note-feeling" aria-label={f ? `Feeling: ${f.label}` : undefined}>{f?.emoji ?? "📝"}</span>
          <div className="grow">
            <strong>{f ? f.label : isDay ? "Day reflection" : "Note"}</strong>
            <span className="muted small"> · {new Date(note.updatedAt).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}</span>
          </div>
          <button className="icon-btn sm ghost" onClick={startEdit} aria-label="Edit note"><Pencil size={15} /></button>
          <button className="icon-btn sm ghost" onClick={() => setNote(date, slot, null)} aria-label="Delete note"><Trash2 size={15} /></button>
        </div>
        {note.tags.length > 0 && (
          <div className="nchips">{note.tags.map((t) => <span key={t} className="nchip">{t}</span>)}</div>
        )}
        {note.text && <p className="note-text">{note.text}</p>}
      </div>
    );
  }

  return (
    <div className="note note-editing">
      <strong className="small">{prompt}</strong>
      <div className="feelings" role="radiogroup" aria-label="Feeling">
        {FEELINGS.map((f) => (
          <button
            key={f.value}
            role="radio"
            aria-checked={feeling === f.value}
            className={`feeling${feeling === f.value ? " on" : ""}`}
            onClick={() => setFeeling(feeling === f.value ? undefined : f.value)}
          >
            <span aria-hidden>{f.emoji}</span>
            <small>{f.label}</small>
          </button>
        ))}
      </div>
      <div className="chip-row" role="group" aria-label="Tags">
        {NOTE_TAGS.map((t) => (
          <button
            key={t}
            className={`chip chip-outline${tags.includes(t) ? " on" : ""}`}
            aria-pressed={tags.includes(t)}
            onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}
          >
            {t}
          </button>
        ))}
      </div>
      <label className="field" style={{ margin: 0 }}>
        <span className="sr-only">Notes</span>
        <textarea
          value={text}
          maxLength={MAX_TEXT}
          rows={3}
          onChange={(e) => setText(e.target.value)}
          placeholder={isDay ? "Wins, struggles, what you'd change tomorrow…" : "e.g. The egusi was heavy, felt sleepy after. Next time a smaller wrap."}
        />
      </label>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="muted small">{text.length}/{MAX_TEXT}</span>
        <div className="row">
          <button className="btn btn-ghost btn-small" onClick={() => setEditing(false)}>Cancel</button>
          <button className="btn btn-primary btn-small" onClick={save}>Save note</button>
        </div>
      </div>
    </div>
  );
}

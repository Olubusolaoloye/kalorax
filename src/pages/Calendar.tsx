import { CalendarCheck, ChevronLeft, ChevronRight, Clock, Dumbbell, MapPin, Plus, Stethoscope, Trash2, Utensils } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Sheet, StatCard } from "../components/ui";
import { recipeById } from "../data/recipes";
import { activityById } from "../lib/nutrition";
import { EVENT_TYPE_LABEL, MEALS, todayIso, useStore, type EventType } from "../state/store";

const TYPES: EventType[] = ["meal", "activity", "appointment"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface DayItem {
  key: string;
  type: EventType;
  time?: string;
  title: string;
  location?: string;
  note?: string;
  eventId?: string;
}

function monthGrid(year: number, month: number): Array<string | null> {
  const first = new Date(year, month, 1, 12);
  const offset = (first.getDay() + 6) % 7; // Monday-first
  const days = new Date(year, month + 1, 0).getDate();
  const cells: Array<string | null> = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d, 12).toLocaleDateString("en-CA"));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function Calendar() {
  const { useRange, addEvent, removeEvent } = useStore();
  const today = todayIso();
  const [cursor, setCursor] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const cells = monthGrid(cursor.y, cursor.m);
  const monthDates = cells.filter((c): c is string => !!c);
  // This month's plan, events and activities, fetched from the server if it's older than the recent months the app keeps.
  const { plan, events, exercises } = useRange(monthDates[0], monthDates[monthDates.length - 1]);
  const [selected, setSelected] = useState(today);
  const [show, setShow] = useState<Record<EventType, boolean>>({ meal: true, activity: true, appointment: true });
  const [adding, setAdding] = useState(false);

  const itemsFor = (date: string): DayItem[] => {
    const items: DayItem[] = [];
    const day = plan[date] ?? {};
    for (const meal of MEALS) {
      const r = recipeById(day[meal] ?? "");
      if (r) items.push({ key: `plan-${meal}`, type: "meal", title: `${meal}: ${r.name}` });
    }
    for (const x of exercises.filter((e) => e.date === date)) {
      const a = activityById(x.activityId);
      items.push({ key: `ex-${x.id}`, type: "activity", title: `${a?.name ?? "Activity"} · ${x.minutes} min`, note: x.status === "completed" ? "Completed" : x.status === "skipped" ? "Skipped" : "Planned" });
    }
    for (const e of events.filter((ev) => ev.date === date)) {
      items.push({ key: e.id, type: e.type, time: e.time, title: e.title, location: e.location, note: e.note, eventId: e.id });
    }
    return items.filter((i) => show[i.type]).sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
  };

  const count = (type: EventType) =>
    monthDates.reduce((t, d) => {
      if (type === "meal") return t + Object.keys(plan[d] ?? {}).length;
      if (type === "activity") return t + exercises.filter((e) => e.date === d).length + events.filter((e) => e.date === d && e.type === "activity").length;
      return t + events.filter((e) => e.date === d && e.type === type).length;
    }, 0);
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-NG", { month: "long", year: "numeric" });
  const move = (delta: number) => setCursor(({ y, m }) => ({ y: m + delta < 0 ? y - 1 : m + delta > 11 ? y + 1 : y, m: (m + delta + 12) % 12 }));
  const selectedItems = itemsFor(selected);

  return (
    <div className="page page-aside">
      <PageHeader title="Calendar" subtitle="Meals, activities and appointments in one place">
        <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={18} /> New schedule</button>
      </PageHeader>

      <div className="stat-row three">
        <StatCard icon={<Utensils size={20} />} tone="kcal" label="Meals planned" value={String(count("meal"))} unit="this month" />
        <StatCard icon={<Dumbbell size={20} />} tone="carbs" label="Physical activities" value={String(count("activity"))} unit="this month" />
        <StatCard icon={<Stethoscope size={20} />} tone="protein" label="Appointments" value={String(count("appointment"))} unit="this month" />
      </div>

      <div className="with-aside">
        <section className="card calendar-card">
          <div className="calendar-toolbar">
            <div className="row">
              <button className="icon-btn sm" onClick={() => move(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button>
              <button className="icon-btn sm" onClick={() => move(1)} aria-label="Next month"><ChevronRight size={16} /></button>
              <h2>{monthLabel}</h2>
            </div>
            <div className="row">
              {TYPES.map((t) => (
                <label key={t} className={`legend-check type-${t}`}>
                  <input type="checkbox" checked={show[t]} onChange={(e) => setShow({ ...show, [t]: e.target.checked })} />
                  {EVENT_TYPE_LABEL[t]}
                </label>
              ))}
            </div>
          </div>
          <div className="month" role="grid" aria-label={monthLabel}>
            {WEEKDAYS.map((w) => <div key={w} className="month-head" role="columnheader">{w}</div>)}
            {cells.map((date, i) => {
              if (!date) return <div key={`x${i}`} className="month-cell is-blank" aria-hidden />;
              const items = itemsFor(date);
              return (
                <button
                  key={date}
                  role="gridcell"
                  aria-selected={date === selected}
                  className={`month-cell${date === today ? " is-today" : ""}${date === selected ? " is-selected" : ""}`}
                  onClick={() => setSelected(date)}
                >
                  <span className="month-num">{Number(date.slice(8))}</span>
                  <span className="month-events">
                    {items.slice(0, 3).map((it) => (
                      <span key={it.key} className={`month-event type-${it.type}`}>{it.time ? `${it.time} ` : ""}{it.title}</span>
                    ))}
                    {items.length > 3 && <span className="muted small">+{items.length - 3} more</span>}
                  </span>
                  {items.length > 0 && <span className="month-dots" aria-hidden>{items.slice(0, 4).map((it) => <i key={it.key} className={`type-${it.type}`} />)}</span>}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="aside">
          <div className="section-title">
            <h2>Schedule details</h2>
            <span className="muted small">{new Date(`${selected}T12:00:00`).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })}</span>
          </div>
          {selectedItems.length === 0 ? (
            <div className="card empty-state compact">
              <CalendarCheck size={28} aria-hidden />
              <p className="muted small">Nothing scheduled.</p>
              <button className="btn btn-secondary btn-small" onClick={() => setAdding(true)}><Plus size={15} /> Add to this day</button>
            </div>
          ) : (
            selectedItems.map((it) => (
              <div key={it.key} className="card schedule-item">
                <span className={`tag type-tag-${it.type}`}>{EVENT_TYPE_LABEL[it.type]}</span>
                <h3>{it.title}</h3>
                {it.time && <p className="muted small row"><Clock size={14} aria-hidden /> {it.time}</p>}
                {it.location && <p className="muted small row"><MapPin size={14} aria-hidden /> {it.location}</p>}
                {it.note && <div className="schedule-note"><span className="muted small">Note</span><p className="small">{it.note}</p></div>}
                <div className="row" style={{ justifyContent: "flex-end" }}>
                  {it.type === "meal" && <Link to="/plan" className="btn btn-ghost btn-small">Edit in plan</Link>}
                  {it.key.startsWith("ex-") && <Link to="/exercises" className="btn btn-ghost btn-small">Open exercises</Link>}
                  {it.eventId && (
                    <button className="btn btn-ghost btn-small" onClick={() => removeEvent(it.eventId!)}><Trash2 size={14} /> Remove</button>
                  )}
                </div>
              </div>
            ))
          )}
        </aside>
      </div>

      {adding && <NewEventSheet date={selected} onClose={() => setAdding(false)} onSave={(e) => { addEvent(e); setSelected(e.date); setAdding(false); }} />}
    </div>
  );
}

function NewEventSheet({ date, onClose, onSave }: { date: string; onClose: () => void; onSave: (e: { date: string; time: string; type: EventType; title: string; location?: string; note?: string }) => void }) {
  const [d, setD] = useState(date);
  const [time, setTime] = useState("09:00");
  const [type, setType] = useState<EventType>("appointment");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  return (
    <Sheet title="New schedule" onClose={onClose}>
      <div className="seg">
        {TYPES.map((t) => <button key={t} className={t === type ? "on" : ""} onClick={() => setType(t)}>{EVENT_TYPE_LABEL[t]}</button>)}
      </div>
      <label className="field"><span>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === "appointment" ? "e.g. Antenatal visit, dietitian check-in" : type === "activity" ? "e.g. Evening walk" : "e.g. Prep moi moi for the week"} /></label>
      <div className="two-col">
        <label className="field"><span>Date</span><input type="date" value={d} onChange={(e) => setD(e.target.value)} /></label>
        <label className="field"><span>Time</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
      </div>
      <label className="field"><span>Location (optional)</span><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. General Hospital, Ikeja" /></label>
      <label className="field"><span>Note (optional)</span><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Bring my food diary" /></label>
      <button className="btn btn-primary btn-block" disabled={!title.trim() || !d} onClick={() => onSave({ date: d, time, type, title: title.trim(), location: location.trim() || undefined, note: note.trim() || undefined })}>
        Save schedule
      </button>
    </Sheet>
  );
}

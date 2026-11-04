import { AlarmClock, CalendarClock, Droplets, MessageCircle, Scale, UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import { CloudPushCard, CloudTestButton, CloudWhatsAppCard, LocalAlarmTestButton, LocalPushCard, LocalWhatsAppCard } from "../components/ReminderChannels";
import { Card, PageHeader, Switch } from "../components/ui";
import { dishLabel } from "../lib/planner";
import { REMINDER_MEALS, SNOOZE_MINUTES, WEEKDAYS, validateReminders, waterTimes, type AlarmKind, type ReminderSettings, type WeeklyReminder } from "../lib/reminders";
import { isIos } from "../lib/push";
import { portionOf, todayIso, useStore } from "../state/store";

const BEFORE_OPTIONS = [
  { value: 15, label: "15 minutes before" },
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 120, label: "2 hours before" },
  { value: 1440, label: "1 day before" },
];

function WeeklyRow({ title, hint, value, onChange }: { title: string; hint: string; value: WeeklyReminder; onChange: (v: WeeklyReminder) => void }) {
  return (
    <div className={`rem-row${value.on ? "" : " is-off"}`}>
      <div className="grow">
        <strong className="small">{title}</strong>
        <div className="small muted">{hint}</div>
        <div className="row rem-when">
          <select value={value.day} onChange={(e) => onChange({ ...value, day: Number(e.target.value) })} aria-label={`${title} day`} disabled={!value.on}>
            {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}s</option>)}
          </select>
          <input type="time" value={value.time} onChange={(e) => e.target.value && onChange({ ...value, time: e.target.value })} aria-label={`${title} time`} disabled={!value.on} />
        </div>
      </div>
      <Switch label={title} checked={value.on} onChange={(on) => onChange({ ...value, on })} />
    </div>
  );
}

const ALARM_ROWS: Array<{ kind: AlarmKind; label: string; hint: string }> = [
  { kind: "meals", label: "Meals", hint: "Breakfast, lunch, snack and dinner" },
  { kind: "appointments", label: "Calendar", hint: "Appointments and activities" },
  { kind: "weighIn", label: "Weigh-in", hint: "Your weekly weigh-in" },
  { kind: "planning", label: "Plan next week", hint: "Meal plan and groceries" },
  { kind: "water", label: "Water", hint: "Every glass (can be a lot of alarms)" },
];

/** Which reminder types arrive as alarms. */
function AlarmsCard({ reminders, save, cloud }: { reminders: ReminderSettings; save: (patch: Partial<ReminderSettings>) => void; cloud: boolean }) {
  const alarms = reminders.alarms ?? {};
  return (
    <Card title={<span className="row"><AlarmClock size={18} /> Alarms</span>} className="card-accent">
      <p className="small" style={{ marginTop: 0 }}>
        Alarm reminders arrive straight away, stay on your screen until you tap <strong>Done</strong> or <strong>Snooze {SNOOZE_MINUTES} min</strong>,
        and vibrate hard. Turn your phone's sound on to hear them.
      </p>
      {ALARM_ROWS.map((r) => (
        <div key={r.kind} className={`rem-row${alarms[r.kind] ? "" : " is-off"}`}>
          <div className="grow">
            <strong className="small">{r.label}</strong>
            <div className="small muted">{r.hint}</div>
          </div>
          <Switch label={`${r.label} as alarm`} checked={!!alarms[r.kind]} onChange={(on) => save({ alarms: { ...alarms, [r.kind]: on } })} />
        </div>
      ))}
      {(reminders.push && (cloud ? <CloudTestButton alarm /> : <LocalAlarmTestButton />)) || (
        <p className="small muted">Turn on notifications for this device (left) to get alarms.</p>
      )}
      {isIos() && <p className="small muted">On iPhone, alarms show as normal notifications: iOS doesn't let web apps vibrate or keep them on screen.</p>}
      {!cloud && <p className="small muted">In this version, reminders and snoozes only work while Kalorax is open.</p>}
    </Card>
  );
}

export function Reminders() {
  const { mode, reminders, updateReminders, profile, plan, planPortions } = useStore();
  const cloud = mode === "cloud";
  const [error, setError] = useState<string | null>(null);

  const save = (patch: Partial<ReminderSettings>) => {
    const next = { ...reminders, ...patch, utcOffsetMinutes: -new Date().getTimezoneOffset() };
    const errors = validateReminders(next);
    setError(errors[0] ?? null);
    if (errors.length === 0) updateReminders(next);
  };

  const channelOn = reminders.push || reminders.whatsapp;
  const times = waterTimes(reminders.water);
  const today = todayIso();
  const lunchId = plan[today]?.Lunch;
  const lunch = lunchId ? dishLabel(lunchId, portionOf(planPortions, today, "Lunch")) : null;
  const first = profile?.name.split(" ")[0] ?? "there";
  const previewBody = lunch ? `On your plan: ${lunch}. Log it in your diary when you eat.` : "Remember to log your lunch in your food diary.";

  return (
    <div className="page page-wide">
      <PageHeader title="Reminders" subtitle="Gentle nudges for meals, water and weigh-ins, on WhatsApp or as notifications" />

      {!channelOn && <div className="banner banner-info">Choose how you'd like to be reminded below, then pick what to be reminded about.</div>}
      {error && <div className="banner banner-warn" role="alert">{error}</div>}

      <div className="reminders-layout">
        <div className="stack">
          <h2 className="section-title">How to reach you</h2>
          {cloud ? <CloudPushCard save={save} /> : <LocalPushCard save={save} />}
          {cloud ? <CloudWhatsAppCard save={save} /> : <LocalWhatsAppCard />}
          {cloud && channelOn && <CloudTestButton />}

          <div className="rem-preview" aria-label="Preview">
            <span className="muted small">Preview</span>
            <div className="push-preview">
              <img src="/icon-192.png" alt="" width={28} height={28} />
              <div>
                <strong className="small">Lunch time 🍽️</strong>
                <p className="small">{previewBody}</p>
              </div>
              <span className="muted small">now</span>
            </div>
            <div className="wa-preview">
              <p className="small">Hi {first}, a reminder from Kalorax: Lunch time 🍽️ {previewBody}</p>
              <span className="wa-time">13:00 ✓✓</span>
            </div>
          </div>
        </div>

        <div className="stack">
          <h2 className="section-title">What to remind me about</h2>
          <AlarmsCard reminders={reminders} save={save} cloud={cloud} />
          {cloud && (
            <Card
              title={<span className="row"><MessageCircle size={18} /> New messages</span>}
              action={<Switch label="New message notifications" checked={reminders.messages !== false} onChange={(messages) => save({ messages })} />}
            >
              <p className="small muted" style={{ marginTop: 0 }}>
                When a friend or your dietitian writes and you haven't seen it in the app. Messages about your programme only say who wrote, not what they said.
                {reminders.whatsapp && " On WhatsApp, at most one alert an hour per chat."}
              </p>
            </Card>
          )}
          <Card title={<span className="row"><UtensilsCrossed size={18} /> Meals</span>}>
            <p className="small muted" style={{ marginTop: 0 }}>If a dish is on your meal plan, the reminder tells you what it is.</p>
            {REMINDER_MEALS.map((m) => {
              const r = reminders.meals[m];
              const label = m === "Snacks" ? "Snack" : m;
              return (
                <div key={m} className={`rem-row${r.on ? "" : " is-off"}`}>
                  <strong className="small grow">{label}</strong>
                  <input
                    type="time"
                    value={r.time}
                    disabled={!r.on}
                    aria-label={`${label} time`}
                    onChange={(e) => e.target.value && save({ meals: { ...reminders.meals, [m]: { ...r, time: e.target.value } } })}
                  />
                  <Switch label={`${label} reminder`} checked={r.on} onChange={(on) => save({ meals: { ...reminders.meals, [m]: { ...r, on } } })} />
                </div>
              );
            })}
          </Card>

          <Card title={<span className="row"><Droplets size={18} /> Water</span>} action={<Switch label="Water reminders" checked={reminders.water.on} onChange={(on) => save({ water: { ...reminders.water, on } })} />}>
            <div className={`row rem-when${reminders.water.on ? "" : " is-off"}`}>
              <span className="small">Every</span>
              <select value={reminders.water.everyHours} disabled={!reminders.water.on} aria-label="How often" onChange={(e) => save({ water: { ...reminders.water, everyHours: Number(e.target.value) } })}>
                {[1, 1.5, 2, 3, 4].map((h) => <option key={h} value={h}>{h === 1 ? "hour" : `${h} hours`}</option>)}
              </select>
              <span className="small">from</span>
              <input type="time" value={reminders.water.from} disabled={!reminders.water.on} aria-label="From" onChange={(e) => e.target.value && save({ water: { ...reminders.water, from: e.target.value } })} />
              <span className="small">to</span>
              <input type="time" value={reminders.water.to} disabled={!reminders.water.on} aria-label="To" onChange={(e) => e.target.value && save({ water: { ...reminders.water, to: e.target.value } })} />
            </div>
            {reminders.water.on && (
              <p className="small muted">
                {times.length} a day ({times.join(", ")}). They stop once you reach your water goal for the day.
              </p>
            )}
          </Card>

          <Card title={<span className="row"><Scale size={18} /> Weekly</span>}>
            <WeeklyRow title="Weigh-in" hint="Weigh yourself at the same time each week." value={reminders.weighIn} onChange={(weighIn) => save({ weighIn })} />
            <WeeklyRow title="Plan next week" hint="Fill your meal plan and grocery list." value={reminders.planning} onChange={(planning) => save({ planning })} />
          </Card>

          <Card
            title={<span className="row"><CalendarClock size={18} /> Calendar</span>}
            action={<Switch label="Calendar reminders" checked={reminders.appointments.on} onChange={(on) => save({ appointments: { ...reminders.appointments, on } })} />}
          >
            <p className="small muted" style={{ marginTop: 0 }}>Appointments, activities and meals you add to your calendar.</p>
            <select
              value={reminders.appointments.minutesBefore}
              disabled={!reminders.appointments.on}
              aria-label="When"
              onChange={(e) => save({ appointments: { ...reminders.appointments, minutesBefore: Number(e.target.value) } })}
            >
              {BEFORE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Card>
        </div>
      </div>
    </div>
  );
}

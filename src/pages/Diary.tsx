import { Beef, ChevronLeft, ChevronRight, Droplet, FileUp, Flame, LayoutList, Plus, Table2, Trash2, Wheat } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { CsvImportSheet, inBatches } from "../components/CsvImport";
import { NoteCard } from "../components/NoteCard";
import { MacroTiles, MealTag, NutrientChips, PageHeader, SkeletonLines, StatCard, Thumb } from "../components/ui";
import { foodById, nutrientsFor } from "../data/foods";
import { diaryTemplate, parseDiaryCsv } from "../lib/csvImport";
import { dailyTotals, fmt } from "../state/derived";
import { FEELINGS, MEALS, noteKey, shiftDate, todayIso, useStore, weekDates, type DiaryEntry } from "../state/store";

/** Change vs last week, only when last week has enough logs for the comparison to mean something. */
const pct = (now: number, before: number, beforeCount: number) =>
  beforeCount >= 5 && before > 0 ? ((now - before) / before) * 100 : null;

export function Diary() {
  const { useRange, removeDiaryEntry, addDiaryEntries } = useStore();
  const [date, setDate] = useState(todayIso());
  const [view, setView] = useState<"day" | "week">("day");
  const [importing, setImporting] = useState(false);
  const today = todayIso();
  const isToday = date === today;

  const week = weekDates(date);
  const prevWeekDates = weekDates(shiftDate(date, -7));
  const prevWeek = new Set(prevWeekDates);
  // This week and last (for the comparison), fetched from the server if they're older than the recent months the app keeps.
  const { diary, notes, loading } = useRange(prevWeekDates[0], week[6]);
  const weekSet = new Set(week);
  const weekTotals = dailyTotals(diary.filter((e) => weekSet.has(e.date)));
  const prevEntries = diary.filter((e) => prevWeek.has(e.date));
  const prevTotals = dailyTotals(prevEntries);
  const n = prevEntries.length;

  const entries = diary.filter((e) => e.date === date);
  const total = dailyTotals(entries);
  const label = isToday
    ? "Today"
    : new Date(`${date}T12:00:00`).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "short" });
  const weekLabel = `${new Date(`${week[0]}T12:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short" })} – ${new Date(`${week[6]}T12:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}`;

  const thoughts = (e: DiaryEntry) => {
    const n = notes[noteKey(e.date, e.meal)];
    if (!n) return null;
    const f = FEELINGS.find((x) => x.value === n.feeling);
    return { emoji: f?.emoji ?? "📝", text: n.tags[0] ?? f?.label ?? (n.text ? "Note" : "") };
  };

  return (
    <div className="page page-wide">
      <PageHeader title="Food diary" subtitle={view === "day" ? label : `Week of ${weekLabel}`}>
        <div className="seg" role="group" aria-label="View">
          <button className={view === "day" ? "on" : ""} onClick={() => setView("day")}><LayoutList size={15} /> Day</button>
          <button className={view === "week" ? "on" : ""} onClick={() => setView("week")}><Table2 size={15} /> Week table</button>
        </div>
        <button className="icon-btn" onClick={() => setDate(shiftDate(date, view === "day" ? -1 : -7))} aria-label="Previous"><ChevronLeft size={18} /></button>
        <button className="icon-btn" onClick={() => setDate(shiftDate(date, view === "day" ? 1 : 7) > today ? today : shiftDate(date, view === "day" ? 1 : 7))} disabled={view === "day" ? isToday : weekSet.has(today)} aria-label="Next"><ChevronRight size={18} /></button>
        <button className="btn btn-secondary" onClick={() => setImporting(true)}><FileUp size={18} /> Import CSV</button>
        <Link to="/add" className="btn btn-primary"><Plus size={18} /> Log food</Link>
      </PageHeader>

      {importing && (
        <CsvImportSheet
          title="Import food log"
          intro="Bring in meals you've tracked in a spreadsheet or another app. Save it as CSV with these columns in the first row:"
          columns={[
            { name: "date", hint: "YYYY-MM-DD or DD/MM/YYYY, today or earlier" },
            { name: "meal", hint: "Breakfast, Lunch, Dinner or Snack" },
            { name: "food", hint: "a food or recipe name from Nutrintel, e.g. Jollof rice" },
            { name: "portion or grams", hint: "optional, e.g. \"1 plate\" or 250; otherwise the usual portion" },
            { name: "time", hint: "optional, e.g. 08:30" },
          ]}
          templateName="nutrintel-food-log.csv"
          template={() => diaryTemplate(today)}
          parse={(text) => parseDiaryCsv(text, today)}
          headings={["Date", "Meal", "Food", "Amount", "Calories"]}
          renderRow={(e) => {
            const food = foodById(e.foodId)!;
            return [e.date, e.meal, food.name, e.portionLabel, `${fmt(nutrientsFor(food, e.grams).kcal)} kcal`];
          }}
          onImport={(items) => {
            inBatches(items.map(({ date, meal, foodId, grams, portionLabel, loggedAt }) => ({ date, meal, foodId, grams, portionLabel, loggedAt })), 20, addDiaryEntries);
            const latest = items.reduce((d, e) => (e.date > d ? e.date : d), items[0].date);
            setDate(latest);
          }}
          onClose={() => setImporting(false)}
        />
      )}

      <div className="stat-row">
        <StatCard icon={<Flame size={20} />} tone="kcal" label="Calories this week" value={fmt(weekTotals.kcal)} unit="kcal" delta={pct(weekTotals.kcal, prevTotals.kcal, n)} />
        <StatCard icon={<Wheat size={20} />} tone="carbs" label="Carbs this week" value={fmt(weekTotals.carbs)} unit="g" delta={pct(weekTotals.carbs, prevTotals.carbs, n)} />
        <StatCard icon={<Beef size={20} />} tone="protein" label="Protein this week" value={fmt(weekTotals.protein)} unit="g" delta={pct(weekTotals.protein, prevTotals.protein, n)} />
        <StatCard icon={<Droplet size={20} />} tone="fat" label="Fat this week" value={fmt(weekTotals.fat)} unit="g" delta={pct(weekTotals.fat, prevTotals.fat, n)} />
      </div>

      {loading ? (
        <div className="card"><SkeletonLines rows={4} /></div>
      ) : view === "week" ? (
        <WeekTable
          rows={diary.filter((e) => weekSet.has(e.date)).sort((a, b) => (a.date + (a.loggedAt ?? "")).localeCompare(b.date + (b.loggedAt ?? "")))}
          thoughts={thoughts}
          onRemove={removeDiaryEntry}
          onOpenDay={(d) => { setDate(d); setView("day"); }}
        />
      ) : (
        <div className="diary-day">
          <div className="card card-warm"><MacroTiles m={total} /></div>
          {MEALS.map((meal) => {
            const items = entries.filter((e) => e.meal === meal);
            const kcal = dailyTotals(items).kcal;
            return (
              <section key={meal} className="diary-meal">
                <div className="section-title">
                  <div className="row"><MealTag meal={meal} /><span className="muted small">{kcal > 0 ? `${fmt(kcal)} kcal` : ""}</span></div>
                  {isToday && <Link className="btn btn-secondary btn-small" to={`/add?meal=${meal}`}><Plus size={15} /> Add</Link>}
                </div>
                {items.length === 0 ? (
                  <div className="empty-meal muted small">Nothing logged yet.</div>
                ) : (
                  <ul className="food-rows">
                    {items.map((e) => {
                      const food = foodById(e.foodId);
                      if (!food) return null;
                      return (
                        <li key={e.id} className="food-row">
                          <Thumb emoji={food.emoji} photo={food.id} />
                          <div className="food-row-body">
                            <strong>{food.name}</strong>
                            <span className="muted small">{e.portionLabel} · {e.grams} g{e.loggedAt ? ` · ${new Date(e.loggedAt).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}` : ""}</span>
                            <NutrientChips m={nutrientsFor(food, e.grams)} />
                          </div>
                          <button className="icon-btn sm" onClick={() => removeDiaryEntry(e.id)} aria-label={`Remove ${food.name}`}><Trash2 size={16} /></button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <NoteCard key={`${date}-${meal}`} date={date} slot={meal} notes={notes} />
              </section>
            );
          })}
          <section>
            <div className="section-title"><h2>Day reflection</h2></div>
            <NoteCard key={`${date}-day`} date={date} slot="Day" notes={notes} />
          </section>
        </div>
      )}
    </div>
  );
}

function WeekTable({ rows, thoughts, onRemove, onOpenDay }: {
  rows: DiaryEntry[];
  thoughts: (e: DiaryEntry) => { emoji: string; text: string } | null;
  onRemove: (id: string) => void;
  onOpenDay: (date: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="card empty-state">
        <div className="empty-art" aria-hidden>📒</div>
        <h2>No meals logged this week</h2>
        <p className="muted">Log what you eat and it shows up here with your notes.</p>
        <Link to="/add" className="btn btn-primary">Log food</Link>
      </div>
    );
  }
  return (
    <section className="card">
      <div className="table-wrap">
        <table className="table data-table">
          <thead>
            <tr>
              <th>Date &amp; time</th><th>Category</th><th>Menu</th><th>Amount</th>
              <th className="num">Calories</th><th className="num">Carbs</th><th className="num">Protein</th><th className="num">Fat</th>
              <th>Thoughts</th><th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const food = foodById(e.foodId);
              if (!food) return null;
              const n = nutrientsFor(food, e.grams);
              const t = thoughts(e);
              return (
                <tr key={e.id}>
                  <td>
                    <button className="link-btn" onClick={() => onOpenDay(e.date)}>
                      {new Date(`${e.date}T12:00:00`).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })}
                    </button>
                    {e.loggedAt && <span className="muted small" style={{ display: "block" }}>{new Date(e.loggedAt).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}</span>}
                  </td>
                  <td><MealTag meal={e.meal} /></td>
                  <td><span className="cell-item"><span className="cell-emoji" aria-hidden>{food.emoji}</span>{food.name}</span></td>
                  <td className="muted">{e.portionLabel}</td>
                  <td className="num">{fmt(n.kcal)} kcal</td>
                  <td className="num">{fmt(n.carbs)} g</td>
                  <td className="num">{fmt(n.protein)} g</td>
                  <td className="num">{fmt(n.fat)} g</td>
                  <td>{t ? <span className="thought">{t.emoji} {t.text}</span> : <span className="muted small">—</span>}</td>
                  <td><button className="icon-btn sm ghost" onClick={() => onRemove(e.id)} aria-label={`Remove ${food.name}`}><Trash2 size={15} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

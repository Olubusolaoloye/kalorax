import { ArrowLeftRight, ChevronLeft, ChevronRight, FileUp, Minus, Share2, Plus, ShoppingBasket, SlidersHorizontal, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CsvImportSheet, inBatches } from "../components/CsvImport";
import { ShareSheet } from "../components/ShareSheet";
import { CloudSendToFriend } from "../components/Social";
import { PageHeader, SampleNotice, Sheet, Thumb } from "../components/ui";
import { CUISINES, type Cuisine } from "../data/foods";
import { ALLERGENS, DIETS, RECIPES, costPerServing, fitsDiet, recipeAllergens, recipeById, type Recipe } from "../data/recipes";
import { parsePlanCsv, planTemplate } from "../lib/csvImport";
import { planSnapshot } from "../lib/share";
import { fitPortion, mealTargets, personalWeekPlan, portionLabel, swapOptions, type PlanPrefs } from "../lib/planner";
import { bodySummary, fmt } from "../state/derived";
import { portionOf, shiftDate, todayIso, useStore, weekDates, type Meal } from "../state/store";

/** Column order matches the reference: breakfast, lunch, snack, dinner. */
const PLAN_MEALS: Meal[] = ["Breakfast", "Lunch", "Snacks", "Dinner"];
const naira = (n: number) => `₦${fmt(Math.round(n / 10) * 10)}`;
const signed = (n: number) => (Math.round(n) > 0 ? `+${fmt(n)}` : Math.round(n) < 0 ? `−${fmt(-n)}` : "±0");
/** General plans (no personal target) are sized for a typical adult day, then shown at 1 serving. */
const GENERAL_KCAL = 2000;

function prefsSummary(p: PlanPrefs): string[] {
  const out = p.cuisines.map((c) => CUISINES.find((x) => x.id === c)?.label ?? c);
  if (p.diet !== "any") out.push(DIETS.find((d) => d.id === p.diet)!.label);
  for (const a of p.avoid) out.push(`No ${ALLERGENS.find((x) => x.id === a)!.label.toLowerCase()}`);
  if (p.budgetPerDay) out.push(`${naira(p.budgetPerDay)}/day`);
  return out;
}

/** Why a recipe doesn't fit the member's preferences, if it doesn't. */
function conflict(r: Recipe, p: PlanPrefs): string | null {
  if (!fitsDiet(r, p.diet)) return "Has meat or fish";
  const a = recipeAllergens(r).find((x) => p.avoid.includes(x));
  return a ? `Contains ${ALLERGENS.find((x) => x.id === a)!.label.toLowerCase()}` : null;
}

function PrefsSheet({ prefs, onSave, onClose }: { prefs: PlanPrefs; onSave: (p: PlanPrefs) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(prefs);
  const [budget, setBudget] = useState(prefs.budgetPerDay ? String(prefs.budgetPerDay) : "");
  const budgetNum = budget.trim() ? Number(budget.replace(/[^\d]/g, "")) : null;
  const budgetOk = budgetNum === null || (budgetNum >= 500 && budgetNum <= 200000);
  const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
  return (
    <Sheet title="Plan preferences" onClose={onClose}>
      <h3>Cuisines</h3>
      <div className="chip-row">
        {CUISINES.map((c) => (
          <button key={c.id} className={`chip chip-outline${draft.cuisines.includes(c.id) ? " on" : ""}`} aria-pressed={draft.cuisines.includes(c.id)} onClick={() => setDraft({ ...draft, cuisines: toggle<Cuisine>(draft.cuisines, c.id) })}>
            {c.emoji} {c.label}
          </button>
        ))}
      </div>
      <h3>I eat</h3>
      <div className="seg">
        {DIETS.map((d) => (
          <button key={d.id} className={draft.diet === d.id ? "on" : ""} onClick={() => setDraft({ ...draft, diet: d.id })}>{d.label}</button>
        ))}
      </div>
      <h3>Leave out (allergies or dislikes)</h3>
      <div className="chip-row">
        {ALLERGENS.map((a) => (
          <button key={a.id} className={`chip chip-outline${draft.avoid.includes(a.id) ? " on" : ""}`} aria-pressed={draft.avoid.includes(a.id)} onClick={() => setDraft({ ...draft, avoid: toggle(draft.avoid, a.id) })}>
            {a.label}
          </button>
        ))}
      </div>
      <label className="field">
        <span>Food budget per person per day (optional)</span>
        <div className="input-icon">
          <span aria-hidden className="muted">₦</span>
          <input inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 3000" />
        </div>
      </label>
      {!budgetOk && <p className="small error">Enter an amount between ₦500 and ₦200,000, or leave it empty.</p>}
      <button
        className="btn btn-primary btn-block"
        disabled={draft.cuisines.length === 0 || !budgetOk}
        onClick={() => {
          onSave({ ...draft, budgetPerDay: budgetNum });
          onClose();
        }}
      >
        Save preferences
      </button>
      {draft.cuisines.length === 0 && <p className="small muted center">Pick at least one cuisine.</p>}
    </Sheet>
  );
}

export function MealPlan() {
  const { mode, profile, latestWeightKg, dietitianTarget, plan, planPortions, planPrefs, setPlanSlot, replacePlan, updatePlanPrefs } = useStore();
  const [params, setParams] = useSearchParams();
  const sharing = params.get("share") === "1";
  const setSharing = (on: boolean) => setParams(on ? { share: "1" } : {}, { replace: true });
  const [anchor, setAnchor] = useState(todayIso());
  const [editing, setEditing] = useState<{ date: string; meal: Meal } | null>(null);
  const [showPrefs, setShowPrefs] = useState(false);
  const [importing, setImporting] = useState(false);
  const dates = weekDates(anchor);
  const today = todayIso();
  const summary = profile && latestWeightKg !== null ? bodySummary(profile, latestWeightKg, dietitianTarget) : null;
  const target = summary?.target.kind === "target" ? summary.target.kcal : null;
  const targets = target ? mealTargets(target) : null;

  const slot = (date: string, meal: Meal) => {
    const r = recipeById(plan[date]?.[meal] ?? "");
    return r ? { r, portion: portionOf(planPortions, date, meal) } : null;
  };
  const dayKcal = (date: string) => PLAN_MEALS.reduce((t, m) => {
    const s = slot(date, m);
    return t + (s ? s.r.kcal * s.portion : 0);
  }, 0);
  const planned = dates.flatMap((d) => PLAN_MEALS.map((m) => slot(d, m))).filter((x) => x !== null);
  const plannedDays = dates.filter((d) => PLAN_MEALS.some((m) => slot(d, m))).length;
  const weekHasItems = planned.length > 0;
  const avgKcal = plannedDays ? dates.reduce((t, d) => t + dayKcal(d), 0) / plannedDays : 0;
  const avgCost = plannedDays ? planned.reduce((t, s) => t + costPerServing(s.r) * s.portion, 0) / plannedDays : 0;
  const monthLabel = new Date(`${dates[0]}T12:00:00`).toLocaleDateString("en-NG", { month: "long", year: "numeric" });

  const fillWeek = () => {
    if (weekHasItems && !confirm("Replace this week's plan with a new one?")) return;
    const { items } = personalWeekPlan(dates, target ?? GENERAL_KCAL, planPrefs);
    replacePlan(target ? items : items.map((it) => ({ ...it, portion: 1 })));
  };

  return (
    <div className="page page-wide">
      <PageHeader title="Meal plan" subtitle={target ? `Sized to ${dietitianTarget ? "the target your dietitian set" : "your daily target"} of about ${fmt(target)} kcal` : "Plan your week, then shop for it in one tap"}>
        <Link to={`/grocery?week=${dates[0]}`} className="btn btn-secondary"><ShoppingBasket size={18} /> Grocery list</Link>
        <button className="btn btn-secondary" onClick={() => setSharing(true)}><Share2 size={18} /> Share</button>
        <button className="btn btn-secondary" onClick={() => setImporting(true)}><FileUp size={18} /> Import CSV</button>
        <Link to="/recipes" className="btn btn-primary"><Plus size={18} /> Browse recipes</Link>
      </PageHeader>

      {sharing && (() => {
        const shared = planSnapshot(plan, planPortions, dates);
        return (
          <ShareSheet
            title="Share this week's plan"
            what={{ kind: "plan", plan: shared }}
            friend={mode === "cloud" && shared.items.length > 0 ? <CloudSendToFriend payload={{ plan: shared }} /> : undefined}
            onClose={() => setSharing(false)}
          />
        );
      })()}

      {importing && (
        <CsvImportSheet
          title="Import meal plan"
          intro="Plan any number of days from a spreadsheet. Save it as CSV with these columns in the first row:"
          columns={[
            { name: "date", hint: "YYYY-MM-DD or DD/MM/YYYY" },
            { name: "meal", hint: "Breakfast, Lunch, Dinner or Snack" },
            { name: "recipe", hint: "a dish from the Healthy menu, e.g. Moi moi with egg" },
            { name: "servings", hint: "optional, ¼ to 4 (default 1)" },
          ]}
          templateName="kalorax-meal-plan.csv"
          template={() => planTemplate(dates)}
          parse={parsePlanCsv}
          headings={["Date", "Meal", "Dish", "Servings", "Calories"]}
          renderRow={(it) => {
            const r = recipeById(it.recipeId)!;
            return [it.date, it.meal === "Snacks" ? "Snack" : it.meal, r.name, portionLabel(it.portion), `${fmt(r.kcal * it.portion)} kcal`];
          }}
          note={(items) => {
            const replaced = items.filter((it) => plan[it.date]?.[it.meal]).length;
            return replaced > 0 ? <p className="small muted">{replaced} {replaced === 1 ? "meal already planned is" : "meals already planned are"} replaced; other planned meals stay.</p> : null;
          }}
          onImport={(items) => {
            inBatches(items.map(({ date, meal, recipeId, portion }) => ({ date, meal, recipeId, portion })), 60, replacePlan);
            setAnchor(items.reduce((d, it) => (it.date < d ? it.date : d), items[0].date));
          }}
          onClose={() => setImporting(false)}
        />
      )}

      {summary && summary.target.kind !== "target" && (
        <div className="banner banner-warn">
          Because of your health details, a dietitian should set your plan. We'll fill a general week with standard portions as a guide for now.
        </div>
      )}

      <div className="card plan-toolbar">
        <div className="row">
          <button className="icon-btn sm" onClick={() => setAnchor(shiftDate(anchor, -7))} aria-label="Previous week"><ChevronLeft size={16} /></button>
          <button className="icon-btn sm" onClick={() => setAnchor(shiftDate(anchor, 7))} aria-label="Next week"><ChevronRight size={16} /></button>
          <strong>{monthLabel}</strong>
          <span className="muted small">
            {new Date(`${dates[0]}T12:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short" })} –{" "}
            {new Date(`${dates[6]}T12:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
          </span>
        </div>
        <div className="row plan-actions">
          <button className="prefs-summary" onClick={() => setShowPrefs(true)} aria-label="Edit plan preferences">
            <SlidersHorizontal size={15} />
            {prefsSummary(planPrefs).map((t) => <span key={t} className="tag tag-outline">{t}</span>)}
          </button>
          <button className="btn btn-ink btn-small" onClick={fillWeek}>
            <Sparkles size={15} /> {target ? "Personalise my week" : "Fill a general week"}
          </button>
          {weekHasItems && (
            <button className="btn btn-ghost btn-small" onClick={() => dates.forEach((d) => PLAN_MEALS.forEach((m) => slot(d, m) && setPlanSlot(d, m, null)))}>
              <Trash2 size={15} /> Clear week
            </button>
          )}
        </div>
      </div>

      {weekHasItems && (
        <div className="plan-summary" role="status">
          <span><strong>{fmt(avgKcal)}</strong> kcal a day{target ? <span className="muted"> · target {fmt(target)}</span> : null}</span>
          <span><strong>{naira(avgCost)}</strong> <span className="muted">a day per person (estimate)</span></span>
          <span className="muted small"><ArrowLeftRight size={13} /> Tap any dish to swap it</span>
        </div>
      )}

      <div className="plan-grid" role="table" aria-label="Weekly meal plan">
        <div className="plan-row plan-head" role="row">
          <div role="columnheader" className="plan-day-head">Day</div>
          {PLAN_MEALS.map((m) => (
            <div key={m} role="columnheader" className={`plan-col-head col-${m.toLowerCase()}`}>{m === "Snacks" ? "Snack" : m}</div>
          ))}
        </div>
        {dates.map((date) => {
          const d = new Date(`${date}T12:00:00`);
          const kcal = dayKcal(date);
          return (
            <div key={date} className={`plan-row${date === today ? " is-today" : ""}`} role="row">
              <div className="plan-day" role="rowheader">
                <strong>{d.toLocaleDateString("en-NG", { weekday: "long" })}</strong>
                <span className="muted small">{d.toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</span>
                {kcal > 0 && (
                  <span className={`plan-kcal${target && kcal > target * 1.1 ? " over" : ""}`}>
                    {fmt(kcal)}{target ? ` / ${fmt(target)}` : ""} kcal
                  </span>
                )}
              </div>
              {PLAN_MEALS.map((meal) => {
                const s = slot(date, meal);
                return (
                  <div key={meal} role="cell" className={`plan-cell cell-${meal.toLowerCase()}`}>
                    <span className="plan-cell-label">{meal === "Snacks" ? "Snack" : meal}</span>
                    {s ? (
                      <button className="plan-item" onClick={() => setEditing({ date, meal })}>
                        <Thumb emoji={s.r.emoji} size="sm" photo={`recipe:${s.r.id}`} />
                        <span>
                          <strong>{s.r.name}</strong>
                          <small>{s.portion !== 1 ? `${portionLabel(s.portion)} · ` : ""}{fmt(s.r.kcal * s.portion)} kcal</small>
                        </span>
                      </button>
                    ) : (
                      <button className="plan-empty" onClick={() => setEditing({ date, meal })} aria-label={`Add ${meal} on ${d.toLocaleDateString("en-NG", { weekday: "long" })}`}>
                        <Plus size={16} /> Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <SampleNotice>
        Plans use Kalorax's sample recipes and estimated ₦ prices. A plan from your dietitian always comes first.
      </SampleNotice>

      {showPrefs && <PrefsSheet prefs={planPrefs} onSave={updatePlanPrefs} onClose={() => setShowPrefs(false)} />}

      {editing && (
        <SlotSheet
          date={editing.date}
          meal={editing.meal}
          current={slot(editing.date, editing.meal)}
          mealKcal={targets ? targets[editing.meal] : null}
          prefs={planPrefs}
          onPick={(recipeId, portion) => setPlanSlot(editing.date, editing.meal, recipeId, portion)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function SlotSheet({
  date,
  meal,
  current,
  mealKcal,
  prefs,
  onPick,
  onClose,
}: {
  date: string;
  meal: Meal;
  current: { r: Recipe; portion: number } | null;
  mealKcal: number | null;
  prefs: PlanPrefs;
  onPick: (recipeId: string | null, portion?: number) => void;
  onClose: () => void;
}) {
  const title = `${meal === "Snacks" ? "Snack" : meal} · ${new Date(`${date}T12:00:00`).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "short" })}`;
  const swaps = current ? swapOptions(meal, { recipeId: current.r.id, portion: current.portion }, prefs, 4) : [];
  const pick = (id: string | null, portion?: number) => {
    onPick(id, portion);
    onClose();
  };
  const sameSlotFirst = [...RECIPES].sort((a, b) => Number(b.meal === meal) - Number(a.meal === meal));

  return (
    <Sheet title={title} onClose={onClose}>
      {current && (
        <div className="slot-current">
          <Thumb emoji={current.r.emoji} size="sm" photo={`recipe:${current.r.id}`} />
          <div className="grow">
            <Link to={`/recipes/${current.r.id}`} className="row-title small">{current.r.name}</Link>
            <span className="muted small">
              {fmt(current.r.kcal * current.portion)} kcal · {naira(costPerServing(current.r) * current.portion)}
              {mealKcal ? ` · aim ≈ ${fmt(mealKcal)} kcal` : ""}
            </span>
          </div>
          <div className="stepper compact" aria-label="Portion">
            <button className="icon-btn sm ghost" disabled={current.portion <= 0.5} onClick={() => onPick(current.r.id, current.portion - 0.25)} aria-label="Smaller portion"><Minus size={14} /></button>
            <span className="small"><strong>{portionLabel(current.portion).replace(/ servings?$/, "")}</strong> <span className="muted">serv.</span></span>
            <button className="icon-btn sm ghost" disabled={current.portion >= 2} onClick={() => onPick(current.r.id, current.portion + 0.25)} aria-label="Bigger portion"><Plus size={14} /></button>
          </div>
        </div>
      )}

      {current && (
        <>
          <h3 className="row"><ArrowLeftRight size={16} /> Swap for something similar</h3>
          {swaps.length === 0 ? (
            <p className="small muted">No close matches with your preferences. Pick any dish below.</p>
          ) : (
            <ul className="swap-list">
              {swaps.map((o) => (
                <li key={o.recipe.id}>
                  <button className="swap-option" onClick={() => pick(o.recipe.id, o.portion)}>
                    <Thumb emoji={o.recipe.emoji} size="sm" photo={`recipe:${o.recipe.id}`} />
                    <span className="grow">
                      <strong className="small">{o.recipe.name}</strong>
                      <span className="muted small">
                        {portionLabel(o.portion)} · {fmt(o.kcal)} kcal ({signed(o.deltaKcal)}) · {naira(o.cost)}
                      </span>
                      <span className="swap-reasons">
                        {o.reasons.map((r) => <span key={r} className={`tag${r === "Cheaper" || r === "More protein" ? " tag-breakfast" : " tag-outline"}`}>{r}</span>)}
                      </span>
                    </span>
                    <span className="swap-cta">Swap</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <h3>{current ? "Or choose any dish" : "Choose a dish"}</h3>
      <ul className="food-rows">
        {sameSlotFirst.map((r) => {
          const selected = current?.r.id === r.id;
          const why = conflict(r, prefs);
          const portion = mealKcal ? fitPortion(r, mealKcal) : 1;
          return (
            <li key={r.id}>
              <button className={`food-row${selected ? " is-selected" : ""}`} onClick={() => pick(r.id, portion)}>
                <Thumb emoji={r.emoji} size="sm" photo={`recipe:${r.id}`} />
                <div className="food-row-body">
                  <strong className="small">{r.name}</strong>
                  <span className="muted small">
                    {r.cuisine} · {r.meal} · {portion !== 1 ? `${portionLabel(portion)}, ` : ""}{fmt(r.kcal * portion)} kcal
                  </span>
                </div>
                {selected ? <span className="badge badge-ok">Planned</span> : why ? <span className="badge">{why}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {current && (
        <button className="btn btn-danger btn-block" onClick={() => pick(null)}>
          <Trash2 size={16} /> Remove from plan
        </button>
      )}
    </Sheet>
  );
}

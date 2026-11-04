// What people share: a week of their meal plan, and a summary of their health journey.
// Plans travel as recipe ids by weekday, so a friend can drop them into any week of their own.
import { recipeById } from "../data/recipes";
import { dailyTotals, fmt } from "../state/derived";
import { noteKey, shiftDate, type DiaryEntry, type Meal, type MealPlan, type PlanPortions, type WeightEntry } from "../state/store";
import { portionLabel } from "./planner";

export interface SharedPlanItem {
  /** 0 = Monday … 6 = Sunday. */
  day: number;
  meal: Meal;
  recipeId: string;
  portion?: number;
}

export interface SharedPlan {
  title: string;
  items: SharedPlanItem[];
}

export const SHARE_MEALS: Meal[] = ["Breakfast", "Lunch", "Snacks", "Dinner"];
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEAL_EMOJI: Record<Meal, string> = { Breakfast: "🍳", Lunch: "🍛", Snacks: "🍌", Dinner: "🍲" };
export const mealName = (m: Meal) => (m === "Snacks" ? "Snack" : m);

const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short" });

/** The planned meals of one week (Mon–Sun dates), ready to send. */
export function planSnapshot(plan: MealPlan, portions: PlanPortions, week: string[]): SharedPlan {
  const items: SharedPlanItem[] = [];
  week.forEach((date, day) => {
    for (const meal of SHARE_MEALS) {
      const recipeId = plan[date]?.[meal];
      if (!recipeId || !recipeById(recipeId)) continue;
      const portion = portions[noteKey(date, meal)];
      items.push(portion && portion !== 1 ? { day, meal, recipeId, portion } : { day, meal, recipeId });
    }
  });
  return { title: `Week of ${shortDate(week[0])}`, items };
}

/** A received plan placed on the given week (Mon–Sun dates). Dishes this app doesn't know are left out. */
export function applySharedPlan(shared: SharedPlan, week: string[]) {
  return shared.items
    .filter((it) => it.day >= 0 && it.day <= 6 && recipeById(it.recipeId))
    .map((it) => ({ date: week[it.day], meal: it.meal, recipeId: it.recipeId, portion: it.portion ?? 1 }));
}

export const planKcalPerDay = (shared: SharedPlan) => {
  const days = new Set(shared.items.map((it) => it.day)).size;
  const total = shared.items.reduce((t, it) => t + (recipeById(it.recipeId)?.kcal ?? 0) * (it.portion ?? 1), 0);
  return days ? total / days : 0;
};

/** Plain text for WhatsApp and other chat apps. */
export function planText(shared: SharedPlan, link: string): string {
  const lines = [`🥗 My Kalorax meal plan · ${shared.title}`, ""];
  for (let day = 0; day < 7; day++) {
    const items = shared.items.filter((it) => it.day === day);
    if (!items.length) continue;
    lines.push(`*${WEEKDAYS[day]}*`);
    for (const meal of SHARE_MEALS) {
      const it = items.find((x) => x.meal === meal);
      const r = it && recipeById(it.recipeId);
      if (!it || !r) continue;
      lines.push(`${MEAL_EMOJI[meal]} ${mealName(meal)}: ${r.name}${it.portion && it.portion !== 1 ? ` (${portionLabel(it.portion)})` : ""}`);
    }
    lines.push("");
  }
  lines.push(`Plan your week on Kalorax: ${link}`);
  return lines.join("\n");
}

export interface JourneyStats {
  /** Days in a row, up to today (or yesterday), with at least one meal logged. */
  streak: number;
  daysLogged30: number;
  mealsLogged30: number;
  avgKcal: number | null;
  targetKcal: number | null;
  /** Change since the first weigh-in; null with fewer than two. */
  weightChangeKg: number | null;
  weighIns: number;
  /** Date of the first weigh-in. */
  since: string | null;
}

export function journeyStats(diary: DiaryEntry[], weights: WeightEntry[], today: string, targetKcal: number | null): JourneyStats {
  const days = new Set(diary.map((e) => e.date));
  let streak = 0;
  // Today may not be logged yet, so a streak can end yesterday.
  for (let d = days.has(today) ? today : shiftDate(today, -1); days.has(d); d = shiftDate(d, -1)) streak++;
  const from = shiftDate(today, -29);
  const recent = diary.filter((e) => e.date >= from && e.date <= today);
  const recentDays = new Set(recent.map((e) => e.date));
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  return {
    streak,
    daysLogged30: recentDays.size,
    mealsLogged30: recent.length,
    avgKcal: recentDays.size ? dailyTotals(recent).kcal / recentDays.size : null,
    targetKcal,
    weightChangeKg: sorted.length >= 2 ? sorted.at(-1)!.weightKg - sorted[0].weightKg : null,
    weighIns: sorted.length,
    since: sorted[0]?.date ?? null,
  };
}

const signedKg = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toLocaleString("en-NG", { maximumFractionDigits: 1 })} kg`;

/** The lines shown on the journey card and in its text. Weight is only included when the person chooses. */
export function journeyLines(s: JourneyStats, showWeight: boolean): Array<{ value: string; label: string }> {
  const out = [
    { value: `${s.streak} ${s.streak === 1 ? "day" : "days"}`, label: "logging streak" },
    { value: `${s.daysLogged30} of 30`, label: "days logged this month" },
  ];
  if (s.avgKcal !== null) out.push({ value: `${fmt(s.avgKcal)} kcal`, label: s.targetKcal ? `a day on average · target ${fmt(s.targetKcal)}` : "a day on average" });
  if (showWeight && s.weightChangeKg !== null && s.since) out.push({ value: signedKg(s.weightChangeKg), label: `weight since ${shortDate(s.since)}` });
  return out;
}

export function journeyText(s: JourneyStats, showWeight: boolean, link: string): string {
  const lines = journeyLines(s, showWeight).map((l) => `• ${l.value} ${l.label}`);
  return ["💚 My health journey on Kalorax", "", ...lines, "", `Eat well. Move more. Feel good. ${link}`].join("\n");
}

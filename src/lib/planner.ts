// Personal meal plans and swaps, built from the member's daily target and food preferences.
// SAMPLE logic on sample recipes — a dietitian-set plan always takes priority.
import type { Cuisine } from "../data/foods";
import { RECIPES, costPerServing, fitsDiet, recipeAllergens, recipeById, type Allergen, type Diet, type Recipe } from "../data/recipes";
import { DEFAULT_MEAL_SHARES } from "./nutrition";
import type { Meal } from "../state/store";

export interface PlanPrefs {
  cuisines: Cuisine[];
  diet: Diet;
  avoid: Allergen[];
  /** Most you want to spend on food per person per day, in Naira. Null: no limit. */
  budgetPerDay: number | null;
}

export const DEFAULT_PLAN_PREFS: PlanPrefs = { cuisines: ["Nigerian"], diet: "any", avoid: [], budgetPerDay: null };

/** Cuisines that have recipes, in the order given. */
export const RECIPE_CUISINES = (order: Cuisine[]) => order.filter((c) => RECIPES.some((r) => r.cuisine === c));

/** Meal-plan cuisines for a region: its own cuisines that have recipes, or Western and world dishes. */
export function planCuisinesFor(regionCuisines: Cuisine[]): Cuisine[] {
  const own = RECIPE_CUISINES(regionCuisines);
  return own.length ? own.slice(0, 2) : ["Continental", "International"];
}

export interface PlannedItem {
  date: string;
  meal: Meal;
  recipeId: string;
  /** Servings of the recipe, e.g. 1.5. */
  portion: number;
}

const MIN_PORTION = 0.5;
const MAX_PORTION = 2;

/** Servings that bring a recipe closest to `kcal`, in quarter steps between ½ and 2. */
export function fitPortion(r: Recipe, kcal: number): number {
  const raw = Math.round((kcal / r.kcal) * 4) / 4;
  return Math.min(MAX_PORTION, Math.max(MIN_PORTION, raw));
}

export function portionLabel(portion: number): string {
  const whole = Math.floor(portion);
  const frac = { 0: "", 0.25: "¼", 0.5: "½", 0.75: "¾" }[Math.round((portion - whole) * 4) / 4] ?? "";
  const text = `${whole > 0 ? whole : ""}${frac}` || "0";
  return `${text} ${portion === 1 ? "serving" : "servings"}`;
}

/** Calories for each meal from the daily target (25 / 35 / 30 / 10 split). */
export function mealTargets(dailyKcal: number): Record<Meal, number> {
  const s = DEFAULT_MEAL_SHARES;
  return {
    Breakfast: (dailyKcal * s.Breakfast) / 100,
    Lunch: (dailyKcal * s.Lunch) / 100,
    Dinner: (dailyKcal * s.Dinner) / 100,
    Snacks: (dailyKcal * s.Snacks) / 100,
  };
}

/** Recipes that respect the diet and allergies. Cuisine is a preference, applied separately. */
export function allowedRecipes(prefs: Pick<PlanPrefs, "diet" | "avoid">): Recipe[] {
  return RECIPES.filter((r) => fitsDiet(r, prefs.diet) && !recipeAllergens(r).some((a) => prefs.avoid.includes(a)));
}

/** Lunch and dinner dishes are interchangeable mains; breakfast and snacks stay in their own slot. */
const slotGroup = (meal: Meal): Meal[] => (meal === "Lunch" || meal === "Dinner" ? ["Lunch", "Dinner"] : [meal]);

/** Candidates for a slot: preferred cuisines first; all cuisines if that leaves fewer than `min`. */
function candidates(meal: Meal, prefs: PlanPrefs, min = 2): Recipe[] {
  const pool = allowedRecipes(prefs).filter((r) => slotGroup(meal).includes(r.meal));
  const preferred = pool.filter((r) => prefs.cuisines.includes(r.cuisine));
  return preferred.length >= min ? preferred : pool;
}

export interface PersonalPlan {
  items: PlannedItem[];
  /** Slots we couldn't fill (e.g. allergies rule out every snack). */
  unfilled: Array<{ date: string; meal: Meal }>;
  /** Average planned kcal per day. */
  avgKcal: number;
  /** Average estimated ₦ per person per day. */
  avgCost: number;
}

const MEALS: Meal[] = ["Breakfast", "Lunch", "Dinner", "Snacks"];

/**
 * A week of meals sized to the daily target. For each slot it picks the dish whose portion gets closest
 * to that meal's share of the target, avoiding repeats on nearby days and staying within the budget.
 */
export function personalWeekPlan(dates: string[], dailyKcal: number, prefs: PlanPrefs): PersonalPlan {
  const targets = mealTargets(dailyKcal);
  const items: PlannedItem[] = [];
  const unfilled: PersonalPlan["unfilled"] = [];
  const lastUsed = new Map<string, number>(); // recipe → day index
  const timesUsed = new Map<string, number>();

  dates.forEach((date, day) => {
    for (const meal of MEALS) {
      const pool = candidates(meal, prefs);
      if (pool.length === 0) {
        unfilled.push({ date, meal });
        continue;
      }
      const target = targets[meal];
      const mealBudget = prefs.budgetPerDay ? (prefs.budgetPerDay * DEFAULT_MEAL_SHARES[meal]) / 100 : null;
      const scored = pool.map((r, i) => {
        const portion = fitPortion(r, target);
        const kcalGap = Math.abs(portion * r.kcal - target) / target;
        const since = lastUsed.has(r.id) ? day - lastUsed.get(r.id)! : Infinity;
        const repeat = since < 1 ? 2 : since < 3 ? 0.6 : 0.15 * (timesUsed.get(r.id) ?? 0);
        const cost = costPerServing(r) * portion;
        const overBudget = mealBudget ? Math.max(0, cost - mealBudget) / mealBudget : 0;
        const ownSlot = r.meal === meal ? 0 : 0.1;
        // Tiny rotating tie-break so equal scores don't always pick the same dish.
        const tie = (((i + day) % pool.length) / pool.length) * 0.01;
        return { r, portion, score: kcalGap + repeat + overBudget + ownSlot + tie };
      });
      scored.sort((a, b) => a.score - b.score);
      const best = scored[0];
      items.push({ date, meal, recipeId: best.r.id, portion: best.portion });
      lastUsed.set(best.r.id, day);
      timesUsed.set(best.r.id, (timesUsed.get(best.r.id) ?? 0) + 1);
    }
  });

  const days = Math.max(1, dates.length);
  const totals = items.reduce(
    (t, it) => {
      const r = recipeById(it.recipeId)!;
      return { kcal: t.kcal + r.kcal * it.portion, cost: t.cost + costPerServing(r) * it.portion };
    },
    { kcal: 0, cost: 0 },
  );
  return { items, unfilled, avgKcal: totals.kcal / days, avgCost: totals.cost / days };
}

export interface SwapOption {
  recipe: Recipe;
  portion: number;
  kcal: number;
  deltaKcal: number;
  cost: number;
  deltaCost: number;
  protein: number;
  reasons: string[];
}

/**
 * Alternatives for a planned dish with about the same calories (portion adjusted), same kind of meal,
 * respecting diet, allergies and preferred cuisines. Best matches first.
 */
export function swapOptions(meal: Meal, current: { recipeId: string; portion: number }, prefs: PlanPrefs, limit = 5): SwapOption[] {
  const now = recipeById(current.recipeId);
  if (!now) return [];
  const targetKcal = now.kcal * current.portion;
  const nowCost = costPerServing(now) * current.portion;
  const nowProtein = now.protein * current.portion;
  return candidates(meal, prefs, 3)
    .filter((r) => r.id !== now.id)
    .map((r): SwapOption => {
      const portion = fitPortion(r, targetKcal);
      const kcal = r.kcal * portion;
      const cost = costPerServing(r) * portion;
      const protein = r.protein * portion;
      const reasons: string[] = [];
      if (Math.abs(kcal - targetKcal) <= targetKcal * 0.1) reasons.push("Similar calories");
      if (cost < nowCost * 0.9) reasons.push("Cheaper");
      if (protein >= nowProtein + 5) reasons.push("More protein");
      if (r.cuisine !== now.cuisine) reasons.push(r.cuisine === "Nigerian" ? "Naija" : r.cuisine);
      return { recipe: r, portion, kcal, deltaKcal: kcal - targetKcal, cost, deltaCost: cost - nowCost, protein, reasons };
    })
    .filter((o) => Math.abs(o.deltaKcal) <= targetKcal * 0.25)
    .sort((a, b) => Math.abs(a.deltaKcal) - Math.abs(b.deltaKcal) + (a.recipe.meal === meal ? 0 : 20) - (b.recipe.meal === meal ? 0 : 20))
    .slice(0, limit);
}

/** "Jollof rice with grilled chicken (1½ servings)", used in reminders. */
export function dishLabel(recipeId: string, portion = 1): string | null {
  const r = recipeById(recipeId);
  return r ? `${r.name} (${portionLabel(portion)})` : null;
}

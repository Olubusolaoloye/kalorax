// A week's grocery list from the meal plan, and the shareable copy of it that goes into chats and WhatsApp.
import { GROCERY_CATEGORIES, INGREDIENTS, buildGroceryList, type GroceryCategory, type GroceryLine } from "../data/recipes";
import { fmt } from "../state/derived";
import { MEALS, portionOf, type GroceryState, type MealPlan, type PlanPortions } from "../state/store";

export const CATEGORY_EMOJI: Record<GroceryCategory, string> = {
  Grains: "🌾", Protein: "🍗", Veggies: "🥬", Fruits: "🍌", Dairy: "🥛", "Oils & spices": "🫙", Others: "🧂",
};

export const naira = (n: number) => `₦${fmt(Math.round(n / 10) * 10)}`;

/** The dishes planned on these dates, with their servings. */
export function plannedDishes(plan: MealPlan, portions: PlanPortions, dates: string[]) {
  return dates.flatMap((d) => MEALS.flatMap((m) => (plan[d]?.[m] ? [{ recipeId: plan[d][m]!, portion: portionOf(portions, d, m) }] : [])));
}

/** What to buy for these dates, with the member's own quantity changes and costs. */
export function weekGroceryLines(plan: MealPlan, portions: PlanPortions, grocery: GroceryState, dates: string[]): GroceryLine[] {
  return buildGroceryList(plannedDishes(plan, portions, dates), grocery.people).map((l) => {
    const qty = grocery.qtyOverride[l.key] ?? l.qty;
    return { ...l, qty, costNaira: qty * INGREDIENTS[l.key].priceNaira };
  });
}

export interface SharedGroceryItem {
  key: string;
  name: string;
  category: GroceryCategory;
  qty: number;
  unit: string;
  costNaira: number;
}

export interface SharedGrocery {
  title: string;
  people: number;
  items: SharedGroceryItem[];
}

export const MAX_SHARED_GROCERY_ITEMS = 80;

export function grocerySnapshot(lines: GroceryLine[], people: number, weekStart: string): SharedGrocery {
  const label = new Date(`${weekStart}T12:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
  return {
    title: `Groceries · week of ${label}`,
    people,
    items: lines.slice(0, MAX_SHARED_GROCERY_ITEMS).map(({ key, name, category, qty, unit, costNaira }) => ({
      key, name, category, qty: Math.round(qty * 100) / 100, unit, costNaira: Math.round(costNaira),
    })),
  };
}

export const groceryTotal = (g: SharedGrocery) => g.items.reduce((t, i) => t + i.costNaira, 0);

export const qtyLabel = (qty: number, unit: string) => `${qty.toLocaleString("en-NG", { maximumFractionDigits: 2 })} ${unit}`;

/** Items in the app's category order, grouped. */
export function byCategory(g: SharedGrocery) {
  return GROCERY_CATEGORIES.map((c) => ({ category: c, items: g.items.filter((i) => i.category === c) })).filter((x) => x.items.length);
}

/** Plain text for WhatsApp: a checklist by category; ticked items show ✅. */
export function groceryText(g: SharedGrocery, checked: string[], link: string): string {
  const done = new Set(checked);
  const lines = [`🧺 ${g.title}${g.people > 1 ? ` (for ${g.people})` : ""}`, ""];
  for (const { category, items } of byCategory(g)) {
    lines.push(`*${CATEGORY_EMOJI[category]} ${category}*`);
    for (const i of items) lines.push(`${done.has(i.key) ? "✅" : "▫️"} ${i.name} – ${qtyLabel(i.qty, i.unit)}`);
    lines.push("");
  }
  lines.push(`About ${naira(groceryTotal(g))} in total (estimate)`);
  lines.push(`Plan your meals and shopping on Kalorax: ${link}`);
  return lines.join("\n");
}

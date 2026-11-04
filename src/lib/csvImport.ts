// Turns CSV files into food diary entries and meal plan slots, matching names to Kalorax's foods and recipes.
// Every row either becomes an item or a problem with its line number, so people can fix the file and try again.
import { FOODS, RECIPE_PREFIX, foodById, type Food } from "../data/foods";
import { RECIPES, type Recipe } from "../data/recipes";
import { MEALS, type DiaryEntry, type Meal } from "../state/store";
import { parseCsv, toCsv } from "./csv";

export const MAX_IMPORT_ROWS = 500;
const MIN_SERVINGS = 0.25;
const MAX_SERVINGS = 4;

export interface ImportProblem {
  line: number;
  message: string;
}

export interface ImportResult<T> {
  items: Array<T & { line: number }>;
  problems: ImportProblem[];
}

export type PlanImportItem = { date: string; meal: Meal; recipeId: string; portion: number };

type Column = "date" | "time" | "meal" | "item" | "grams" | "portion" | "servings";

/** Header names people are likely to use, normalised (lowercase letters and digits only). */
const HEADERS: Record<Column, string[]> = {
  date: ["date", "day", "dateandtime", "datetime"],
  time: ["time", "loggedat"],
  meal: ["meal", "category", "mealtype", "slot"],
  item: ["food", "recipe", "dish", "menu", "item", "name", "foodname", "recipename", "id", "foodid", "recipeid"],
  grams: ["grams", "g", "gram", "weight", "weightg", "amountg"],
  portion: ["portion", "amount", "serving", "servingsize", "size"],
  servings: ["servings", "qty", "quantity", "portions"],
};

const norm = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
const headerKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function columns(header: string[]): Partial<Record<Column, number>> {
  const out: Partial<Record<Column, number>> = {};
  header.forEach((h, i) => {
    const k = headerKey(h);
    const col = (Object.keys(HEADERS) as Column[]).find((c) => HEADERS[c].includes(k));
    if (col && out[col] === undefined) out[col] = i;
  });
  return out;
}

/** Reads a date as YYYY-MM-DD. Slashed dates are day first (19/10/2026), as written in Nigeria. */
export function parseDate(raw: string): string | null {
  const s = raw.trim().split(/[ T]/)[0];
  let y: number, m: number, d: number;
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(s))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 100) y += 2000;
  } else {
    const t = Date.parse(raw);
    if (!/[a-z]/i.test(raw) || Number.isNaN(t)) return null;
    const dt = new Date(t);
    [y, m, d] = [dt.getFullYear(), dt.getMonth() + 1, dt.getDate()];
  }
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Reads "08:30", "8.30", "8:30 pm" or "20:30" as HH:MM. */
export function parseTime(raw: string): string | null {
  const match = /^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/i.exec(raw.trim());
  if (!match) return null;
  let h = Number(match[1]);
  const min = Number(match[2] ?? 0);
  const ampm = match[3]?.toLowerCase();
  if (ampm) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (ampm === "pm" ? 12 : 0);
  }
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function parseMeal(raw: string): Meal | null {
  const s = norm(raw);
  if (s.startsWith("break")) return "Breakfast";
  if (s.startsWith("lunch")) return "Lunch";
  if (s.startsWith("dinner") || s.startsWith("supper")) return "Dinner";
  if (s.startsWith("snack")) return "Snacks";
  return MEALS.find((m) => m.toLowerCase() === s) ?? null;
}

/** "1", "1.5", "½", "1 1/2", "3/4" → number. */
export function parseAmount(raw: string): number | null {
  const s = raw.trim().replace("¼", " 1/4").replace("½", " 1/2").replace("¾", " 3/4").trim();
  const match = /^(\d+(?:\.\d+)?)?\s*(?:(\d+)\/(\d+))?$/.exec(s);
  if (!match || (!match[1] && !match[2])) return null;
  const n = Number(match[1] ?? 0) + (match[2] ? Number(match[2]) / Number(match[3]) : 0);
  return Number.isFinite(n) ? n : null;
}

type Match<T> = { found: T } | { error: string };

/** Finds the entry whose id, name or alias matches; failing that, the one entry whose name contains what was typed. */
function finder<T>(entries: Array<{ value: T; keys: string[]; name: string }>, what: string) {
  const exact = new Map<string, T>();
  for (const e of entries) for (const k of e.keys) if (k && !exact.has(norm(k))) exact.set(norm(k), e.value);
  return (raw: string): Match<T> => {
    const q = norm(raw);
    if (!q) return { error: `No ${what} given.` };
    const hit = exact.get(q);
    if (hit) return { found: hit };
    const partial = q.length < 3 ? [] : entries.filter((e) => e.keys.some((k) => norm(k).includes(q)));
    if (partial.length === 1) return { found: partial[0].value };
    if (partial.length > 1) {
      const names = partial.slice(0, 3).map((e) => `"${e.name}"`).join(", ");
      return { error: `"${raw}" matches more than one ${what} (${names}${partial.length > 3 ? ", …" : ""}). Use the full name.` };
    }
    return { error: `Couldn't find the ${what} "${raw}". Check the spelling, or use a name from Kalorax.` };
  };
}

const findFood = finder<Food>(
  [
    ...FOODS.map((f) => ({ value: f, keys: [f.id, f.name, ...f.aliases], name: f.name })),
    ...RECIPES.map((r) => ({ value: foodById(RECIPE_PREFIX + r.id)!, keys: [RECIPE_PREFIX + r.id, r.name], name: r.name })),
  ],
  "food",
);
const findRecipe = finder<Recipe>(RECIPES.map((r) => ({ value: r, keys: [r.id, r.name], name: r.name })), "recipe");

/** A food's usual portion: the one labelled "1 …", else the middle one. */
function defaultPortion(food: Food) {
  return food.portions.find((p) => /^1 /.test(p.label)) ?? food.portions[Math.floor((food.portions.length - 1) / 2)];
}

function readRows(text: string, required: Column[], labels: Record<string, string>) {
  const rows = parseCsv(text);
  if (rows.length === 0) return { error: "The file is empty." } as const;
  const cols = columns(rows[0]);
  const missing = required.filter((c) => cols[c] === undefined);
  if (missing.length) {
    return { error: `The first row must name the columns. Missing: ${missing.map((c) => labels[c] ?? c).join(", ")}.` } as const;
  }
  const body = rows.slice(1);
  if (body.length === 0) return { error: "The file has column names but no rows." } as const;
  const cell = (row: string[], c: Column) => (cols[c] === undefined ? "" : (row[cols[c]!] ?? "").trim());
  return { body: body.slice(0, MAX_IMPORT_ROWS), extra: Math.max(0, body.length - MAX_IMPORT_ROWS), cell };
}

const tooMany = (extra: number): ImportProblem[] =>
  extra ? [{ line: MAX_IMPORT_ROWS + 2, message: `Only the first ${MAX_IMPORT_ROWS} rows are read; ${extra} more were left out. Split the file to import the rest.` }] : [];

/**
 * Food diary CSV. Columns: date, meal, food, and optionally grams, portion (e.g. "1 plate"), servings and time.
 * Without an amount, the food's usual portion is used.
 */
export function parseDiaryCsv(text: string, today: string): ImportResult<Omit<DiaryEntry, "id">> | { error: string } {
  const read = readRows(text, ["date", "meal", "item"], { item: "food" });
  if ("error" in read) return { error: read.error! };
  const { body, extra, cell } = read;
  const items: ImportResult<Omit<DiaryEntry, "id">>["items"] = [];
  const problems: ImportProblem[] = [];

  body.forEach((row, i) => {
    const line = i + 2;
    const fail = (message: string) => problems.push({ line, message });
    const date = parseDate(cell(row, "date"));
    if (!date) return fail(`"${cell(row, "date")}" isn't a date. Use YYYY-MM-DD or DD/MM/YYYY.`);
    if (date > today) return fail(`${date} is in the future. The food diary is for meals you've eaten.`);
    const meal = parseMeal(cell(row, "meal"));
    if (!meal) return fail(`"${cell(row, "meal")}" isn't a meal. Use Breakfast, Lunch, Dinner or Snack.`);
    const match = findFood(cell(row, "item"));
    if ("error" in match) return fail(match.error);
    const food = match.found;

    let grams: number;
    let portionLabel: string;
    const gramsRaw = cell(row, "grams").replace(/\s*g$/i, "");
    const portionRaw = cell(row, "portion");
    const servingsRaw = cell(row, "servings") || (parseAmount(portionRaw) !== null ? portionRaw : "");
    if (gramsRaw) {
      const g = Number(gramsRaw);
      if (!Number.isFinite(g) || g < 1 || g > 5000) return fail(`"${cell(row, "grams")}" isn't a weight between 1 and 5000 g.`);
      grams = Math.round(g);
      portionLabel = portionRaw && parseAmount(portionRaw) === null ? portionRaw : `${grams} g`;
    } else if (servingsRaw) {
      const n = parseAmount(servingsRaw);
      if (n === null || n <= 0 || n > 10) return fail(`"${servingsRaw}" isn't a number of servings between ¼ and 10.`);
      const base = defaultPortion(food);
      grams = Math.round(base.grams * n);
      portionLabel = n === 1 ? base.label : `${n} × ${base.label}`;
    } else if (portionRaw) {
      const p = food.portions.find((x) => norm(x.label) === norm(portionRaw)) ?? food.portions.find((x) => norm(x.label).includes(norm(portionRaw)));
      if (!p) return fail(`"${portionRaw}" isn't a portion for ${food.name}. Use one of: ${food.portions.map((x) => x.label).join(", ")}; or give grams.`);
      grams = p.grams;
      portionLabel = p.label;
    } else {
      const p = defaultPortion(food);
      grams = p.grams;
      portionLabel = p.label;
    }

    const timeRaw = cell(row, "time") || cell(row, "date").split(/[ T]/).slice(1).join(" ");
    let loggedAt: string | undefined;
    if (timeRaw) {
      const t = parseTime(timeRaw);
      if (!t) return fail(`"${timeRaw}" isn't a time. Use HH:MM, e.g. 08:30 or 19:45.`);
      loggedAt = new Date(`${date}T${t}:00`).toISOString();
    }
    items.push({ line, date, meal, foodId: food.id, grams, portionLabel: portionLabel.slice(0, 60), ...(loggedAt ? { loggedAt } : {}) });
  });

  return { items, problems: [...problems, ...tooMany(extra)] };
}

/** Meal plan CSV. Columns: date, meal, recipe, and optionally servings (¼ to 4, default 1). Later rows win for the same day and meal. */
export function parsePlanCsv(text: string): ImportResult<PlanImportItem> | { error: string } {
  const read = readRows(text, ["date", "meal", "item"], { item: "recipe" });
  if ("error" in read) return { error: read.error! };
  const { body, extra, cell } = read;
  const bySlot = new Map<string, PlanImportItem & { line: number }>();
  const problems: ImportProblem[] = [];

  body.forEach((row, i) => {
    const line = i + 2;
    const fail = (message: string) => problems.push({ line, message });
    const date = parseDate(cell(row, "date"));
    if (!date) return fail(`"${cell(row, "date")}" isn't a date. Use YYYY-MM-DD or DD/MM/YYYY.`);
    const meal = parseMeal(cell(row, "meal"));
    if (!meal) return fail(`"${cell(row, "meal")}" isn't a meal. Use Breakfast, Lunch, Dinner or Snack.`);
    const match = findRecipe(cell(row, "item"));
    if ("error" in match) return fail(match.error.replace("use a name from Kalorax", "use a dish from the Healthy menu"));
    const servingsRaw = cell(row, "servings") || cell(row, "portion");
    let portion = 1;
    if (servingsRaw) {
      const n = parseAmount(servingsRaw.replace(/\s*servings?$/i, ""));
      if (n === null || n < MIN_SERVINGS || n > MAX_SERVINGS) return fail(`"${servingsRaw}" isn't a number of servings between ¼ and 4.`);
      portion = Math.round(n * 4) / 4;
    }
    const key = `${date}|${meal}`;
    const earlier = bySlot.get(key);
    if (earlier) problems.push({ line: earlier.line, message: `Replaced by line ${line}, which plans the same meal on the same day.` });
    bySlot.set(key, { line, date, meal, recipeId: match.found.id, portion });
  });

  const items = [...bySlot.values()].sort((a, b) => a.line - b.line);
  return { items, problems: [...problems.sort((a, b) => a.line - b.line), ...tooMany(extra)] };
}

export function diaryTemplate(today: string): string {
  return toCsv([
    ["date", "time", "meal", "food", "portion", "grams"],
    [today, "08:00", "Breakfast", "Akara", "", "120"],
    [today, "13:30", "Lunch", "Jollof rice", "1 plate", ""],
    [today, "19:00", "Dinner", "Egusi soup", "1 serving", ""],
    [today, "", "Snack", "Fried plantain (dodo)", "", ""],
  ]);
}

export function planTemplate(dates: string[]): string {
  const pick = (meal: Meal) => RECIPES.filter((r) => r.meal === meal);
  const rows: Array<Array<string | number>> = [["date", "meal", "recipe", "servings"]];
  dates.slice(0, 2).forEach((date, i) => {
    for (const meal of ["Breakfast", "Lunch", "Snacks", "Dinner"] as Meal[]) {
      const options = pick(meal);
      if (options.length) rows.push([date, meal === "Snacks" ? "Snack" : meal, options[i % options.length].name, 1]);
    }
  });
  return toCsv(rows);
}

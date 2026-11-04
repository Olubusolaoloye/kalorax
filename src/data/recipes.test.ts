import { describe, expect, it } from "vitest";
import { activityKcal } from "../lib/nutrition";
import { shiftDate, weekDates } from "../state/store";
import { INGREDIENTS, RECIPES, buildGroceryList, sampleWeekPlan } from "./recipes";

describe("recipes", () => {
  it("have unique ids and known ingredients", () => {
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
    for (const r of RECIPES) for (const i of r.ingredients) expect(INGREDIENTS[i.id], `${r.id}/${i.id}`).toBeDefined();
  });

  it("have energy roughly matching macros", () => {
    for (const r of RECIPES) {
      const fromMacros = r.carbs * 4 + r.protein * 4 + r.fat * 9;
      expect(Math.abs(fromMacros - r.kcal), r.id).toBeLessThanOrEqual(r.kcal * 0.1);
    }
  });

  it("cover every meal slot", () => {
    for (const meal of ["Breakfast", "Lunch", "Dinner", "Snacks"]) expect(RECIPES.some((r) => r.meal === meal)).toBe(true);
  });
});

describe("grocery list", () => {
  it("scales by people and recipe servings, rounding up to buyable amounts", () => {
    // Jollof makes 4 servings with 0.5 kg rice and 2 onions.
    const one = buildGroceryList(["jollof-chicken"], 1);
    expect(one.find((l) => l.key === "rice")?.qty).toBe(0.15); // 0.125 kg → 0.15
    expect(one.find((l) => l.key === "onions")?.qty).toBe(1); // 0.5 → 1 piece
    const four = buildGroceryList(["jollof-chicken"], 4);
    expect(four.find((l) => l.key === "rice")?.qty).toBe(0.5);
    expect(four.find((l) => l.key === "onions")?.qty).toBe(2);
  });

  it("merges ingredients across recipes and prices them", () => {
    const list = buildGroceryList(["jollof-chicken", "curry-rice"], 4);
    const rice = list.find((l) => l.key === "rice")!;
    expect(rice.qty).toBe(0.9);
    expect(rice.costNaira).toBeCloseTo(0.9 * INGREDIENTS.rice.priceNaira, 5);
  });

  it("ignores unknown recipes", () => {
    expect(buildGroceryList(["nope"])).toEqual([]);
  });
});

describe("sample week plan", () => {
  it("fills every meal for every day using the chosen cuisines", () => {
    const dates = weekDates("2026-10-16");
    const plan = sampleWeekPlan(dates, ["Nigerian"]);
    expect(plan).toHaveLength(28);
    const byId = new Map(RECIPES.map((r) => [r.id, r]));
    expect(plan.every((p) => byId.get(p.recipeId)?.cuisine === "Nigerian")).toBe(true);
    expect(plan.every((p) => byId.get(p.recipeId)?.meal === p.meal)).toBe(true);
  });
});

describe("dates", () => {
  it("weekDates runs Monday to Sunday", () => {
    expect(weekDates("2026-10-16")).toEqual([
      "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18",
    ]);
    expect(weekDates("2026-10-18")[0]).toBe("2026-10-12"); // Sunday belongs to the same week
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("activity energy", () => {
  it("kcal = MET × kg × hours", () => {
    expect(activityKcal(3.5, 70, 30)).toBeCloseTo(122.5, 5);
    expect(activityKcal(9.8, 80, 60)).toBeCloseTo(784, 5);
    expect(() => activityKcal(3.5, 0, 30)).toThrow(RangeError);
  });
});

describe("storage migration after the renames", () => {
  const fakeStorage = (data: Map<string, string>) =>
    ({
      get length() { return data.size; },
      key: (i: number) => [...data.keys()][i] ?? null,
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      clear: () => data.clear(),
    }) as Storage;

  it("moves nutrintel: and nutrifi: keys to kalorax:, the newer name winning, never overwriting kalorax: data", async () => {
    const { migrateOldStorageKeys } = await import("../state/store");
    const data = new Map<string, string>([
      ["nutrifi:v1", "oldest-logs"], ["nutrintel:v1", "newer-logs"],
      ["nutrifi:reminders-sent", "a"],
      ["nutrintel:programmes-preview", "p"], ["kalorax:programmes-preview", "current"],
      ["other", "x"],
    ]);
    migrateOldStorageKeys(fakeStorage(data));
    expect(Object.fromEntries(data)).toEqual({ "kalorax:v1": "newer-logs", "kalorax:reminders-sent": "a", "kalorax:programmes-preview": "current", other: "x" });
  });
});

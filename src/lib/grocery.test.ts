import { describe, expect, it } from "vitest";
import { buildGroceryList } from "../data/recipes";
import { groceryText, grocerySnapshot, plannedDishes, weekGroceryLines } from "./grocery";

const WEEK = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"];
const plan = { "2026-10-19": { Lunch: "jollof-chicken" }, "2026-10-21": { Dinner: "egusi-eba" }, "2026-10-27": { Lunch: "moimoi" } };

describe("grocery list", () => {
  it("takes the week's dishes with portions and applies the member's own quantities", () => {
    expect(plannedDishes(plan, { "2026-10-21|Dinner": 1.5 }, WEEK)).toEqual([
      { recipeId: "jollof-chicken", portion: 1 },
      { recipeId: "egusi-eba", portion: 1.5 },
    ]);
    const lines = weekGroceryLines(plan, {}, { people: 2, purchased: {}, qtyOverride: { rice: 3 } }, WEEK);
    const plain = buildGroceryList([{ recipeId: "jollof-chicken" }, { recipeId: "egusi-eba" }], 2);
    expect(lines.map((l) => l.key)).toEqual(plain.map((l) => l.key));
    const rice = lines.find((l) => l.key === "rice")!;
    expect(rice.qty).toBe(3);
    expect(rice.costNaira).toBe(3 * 1800);
  });

  it("makes a shareable copy and WhatsApp checklist", () => {
    const lines = weekGroceryLines(plan, {}, { people: 2, purchased: {}, qtyOverride: {} }, WEEK);
    const g = grocerySnapshot(lines, 2, WEEK[0]);
    expect(g.title).toBe("Groceries · week of 19 Oct");
    expect(g.items.length).toBe(lines.length);
    const text = groceryText(g, ["rice"], "https://kalorax.app");
    expect(text.split("\n")[0]).toBe("🧺 Groceries · week of 19 Oct (for 2)");
    expect(text).toContain("*🌾 Grains*");
    expect(text).toMatch(/✅ Rice – [\d.]+ kg/);
    expect(text).toMatch(/▫️ Tomatoes – [\d.]+ kg/);
    expect(text.trim().endsWith("https://kalorax.app")).toBe(true);
  });
});

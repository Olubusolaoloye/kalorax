import { describe, expect, it } from "vitest";
import { runTool, type Ctx } from "../../convex/coachTools";
import { foodById } from "../data/foods";

const ctx = (prefs: Partial<NonNullable<Ctx["prefs"]>> | null = null) =>
  ({ today: "2026-11-04", prefs: prefs as Ctx["prefs"] }) as unknown as Ctx;

describe("coach tools", () => {
  it("search foods with portions and calories from the food list", () => {
    const r = JSON.parse(runTool("search_foods", { query: "eba" }, ctx()).result);
    expect(r[0]).toMatchObject({ food_id: "eba", kcal_per_100g: 160 });
    expect(r[0].portions[1]).toEqual({ label: "Medium wrap", grams: 250, kcal: 400 });
  });

  it("find recipes that respect the member's diet", () => {
    const veg = JSON.parse(runTool("find_recipes", {}, ctx({ diet: "vegetarian", avoid: [] })).result);
    const all = JSON.parse(runTool("find_recipes", {}, ctx()).result);
    expect(veg.length).toBeGreaterThan(0);
    expect(veg.some((r: { recipe_id: string }) => r.recipe_id === "jollof-chicken")).toBe(false);
    expect(all.length).toBeGreaterThan(0);
  });

  it("only make one-tap actions from valid input (the model's output isn't trusted)", () => {
    const ok = runTool("suggest_log_food", { food_id: "eba", grams: 250, meal: "Lunch" }, ctx());
    expect(ok.action).toMatchObject({ kind: "log_food", foodId: "eba", grams: 250, kcal: 400, date: "2026-11-04", state: "pending" });
    expect(runTool("suggest_log_food", { food_id: "made-up", grams: 250, meal: "Lunch" }, ctx())).toMatchObject({ error: true });
    expect(runTool("suggest_log_food", { food_id: "eba", grams: 99999, meal: "Lunch" }, ctx())).toMatchObject({ error: true });
    expect(runTool("suggest_log_food", { food_id: "eba", grams: 250, meal: "Brunch" }, ctx())).toMatchObject({ error: true });
    expect(runTool("suggest_log_food", { food_id: "eba", grams: 250, meal: "Lunch", date: "2026-10-01" }, ctx())).toMatchObject({ error: true });
    expect(runTool("suggest_plan_meal", { recipe_id: "jollof-chicken", meal: "Dinner", date: "2026-11-05", servings: 1.5 }, ctx()).action)
      .toMatchObject({ kind: "plan_meal", recipeId: "jollof-chicken", portion: 1.5 });
    expect(runTool("suggest_plan_meal", { recipe_id: "jollof-chicken", meal: "Dinner", date: "2026-12-30" }, ctx())).toMatchObject({ error: true });
    expect(runTool("delete_everything", {}, ctx())).toMatchObject({ error: true });
  });

  it("turn a photo estimate into a breakdown and a one-tap log of the whole meal", () => {
    const input = {
      dish: "Egusi soup with pounded yam", confidence: "high", meal: "Dinner", kcal: 760, carbs_g: 80, protein_g: 30, fat_g: 34,
      items: [{ name: "Pounded yam", amount: "Medium wrap", kcal: 375 }, { name: "Egusi soup", amount: "1 serving", kcal: 385 }],
    };
    const r = runTool("report_photo_meal", input, ctx());
    expect(r.error).toBeUndefined();
    expect(r.analysis).toMatchObject({ dish: "Egusi soup with pounded yam", kcal: 760, items: [{ name: "Pounded yam" }, { name: "Egusi soup" }] });
    expect(r.action).toMatchObject({ kind: "log_food", meal: "Dinner", kcal: 760, grams: 100 });
    const food = foodById(r.action!.foodId!)!;
    expect(food).toMatchObject({ name: "Egusi soup with pounded yam", kcal: 760, protein: 30, emoji: "📷" });
  });

  it("reject photo estimates that don't add up", () => {
    const ok = { dish: "Rice", confidence: "low", meal: "Lunch", kcal: 300, carbs_g: 60, protein_g: 5, fat_g: 2, items: [{ name: "Rice", amount: "1 cup", kcal: 300 }] };
    expect(runTool("report_photo_meal", { ...ok, kcal: 99999 }, ctx()).error).toBe(true);
    expect(runTool("report_photo_meal", { ...ok, items: [] }, ctx()).error).toBe(true);
    expect(runTool("report_photo_meal", { ...ok, confidence: "certain" }, ctx()).error).toBe(true);
    expect(runTool("report_photo_meal", { ...ok, meal: "Brunch" }, ctx()).error).toBe(true);
  });

  it("only read well-formed photo meal ids", () => {
    expect(foodById("custom:300:60:5:2:Rice%20bowl")?.name).toBe("Rice bowl");
    expect(foodById("custom:abc:60:5:2:Rice")).toBeUndefined();
    expect(foodById("custom:99999:60:5:2:Rice")).toBeUndefined();
    expect(foodById("custom:300:60:5:2:%E0%A4%A")).toBeUndefined();
  });
});

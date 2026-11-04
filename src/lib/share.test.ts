import { describe, expect, it } from "vitest";
import type { DiaryEntry } from "../state/store";
import { applySharedPlan, journeyLines, journeyStats, planSnapshot, planText } from "./share";

const WEEK = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"];
const NEXT = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"];

describe("shared meal plans", () => {
  const plan = {
    "2026-10-19": { Breakfast: "akara-pap", Dinner: "egusi-eba" },
    "2026-10-21": { Lunch: "jollof-chicken", Snacks: "no-such-dish" },
    "2026-10-27": { Lunch: "moimoi" },
  };
  const portions = { "2026-10-19|Dinner": 1.5 };

  it("takes the week's meals by weekday, with portions, skipping unknown dishes and other weeks", () => {
    expect(planSnapshot(plan, portions, WEEK)).toEqual({
      title: "Week of 19 Oct",
      items: [
        { day: 0, meal: "Breakfast", recipeId: "akara-pap" },
        { day: 0, meal: "Dinner", recipeId: "egusi-eba", portion: 1.5 },
        { day: 2, meal: "Lunch", recipeId: "jollof-chicken" },
      ],
    });
  });

  it("drops a received plan onto any week", () => {
    const shared = planSnapshot(plan, portions, WEEK);
    expect(applySharedPlan({ ...shared, items: [...shared.items, { day: 3, meal: "Lunch", recipeId: "gone" }] }, NEXT)).toEqual([
      { date: "2026-10-26", meal: "Breakfast", recipeId: "akara-pap", portion: 1 },
      { date: "2026-10-26", meal: "Dinner", recipeId: "egusi-eba", portion: 1.5 },
      { date: "2026-10-28", meal: "Lunch", recipeId: "jollof-chicken", portion: 1 },
    ]);
  });

  it("writes WhatsApp text by day", () => {
    const text = planText(planSnapshot(plan, portions, WEEK), "https://kalorax.netlify.app");
    expect(text).toContain("Week of 19 Oct");
    expect(text).toContain("*Monday*\n🍳 Breakfast: Akara with pap\n🍲 Dinner: Egusi soup with spinach & eba (1½ servings)");
    expect(text).toContain("*Wednesday*\n🍛 Lunch: Jollof rice with grilled chicken");
    expect(text).not.toContain("Tuesday");
    expect(text.trim().endsWith("https://kalorax.netlify.app")).toBe(true);
  });
});

describe("journey summary", () => {
  const entry = (date: string, foodId = "jollof", grams = 300): DiaryEntry => ({ id: date + foodId, date, meal: "Lunch", foodId, grams, portionLabel: "1 plate" });

  it("counts the streak up to today or yesterday, the month, and the weight change", () => {
    const diary = [entry("2026-10-19"), entry("2026-10-18"), entry("2026-10-17"), entry("2026-10-15"), entry("2026-08-01")];
    const weights = [{ date: "2026-09-01", weightKg: 80 }, { date: "2026-10-18", weightKg: 77.5 }];
    const s = journeyStats(diary, weights, "2026-10-19", 2000);
    expect(s).toMatchObject({ streak: 3, daysLogged30: 4, mealsLogged30: 4, weightChangeKg: -2.5, since: "2026-09-01", targetKcal: 2000 });
    expect(Math.round(s.avgKcal!)).toBe(480);
    // Nothing logged today yet: the streak still counts up to yesterday.
    expect(journeyStats(diary.slice(1), weights, "2026-10-19", null).streak).toBe(2);
  });

  it("only shows weight when the person chooses to", () => {
    const s = journeyStats([entry("2026-10-19")], [{ date: "2026-09-01", weightKg: 80 }, { date: "2026-10-18", weightKg: 78 }], "2026-10-19", null);
    expect(journeyLines(s, false).some((l) => l.value.includes("kg"))).toBe(false);
    expect(journeyLines(s, true).at(-1)).toEqual({ value: "−2 kg", label: "weight since 1 Sept" });
    expect(journeyLines(journeyStats([], [], "2026-10-19", null), true).map((l) => l.value)).toEqual(["0 days", "0 of 30"]);
  });
});

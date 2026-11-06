import { describe, expect, it } from "vitest";
import { bestStreak, currentStreak, earnedBadges, nextBadge, scoreWeek } from "./challenges";

const WEEK = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"];
const empty = { dates: WEEK, today: "2026-11-08", diary: [], water: [], waterTargetMl: 2000, exercises: [], weights: [] };
const threeMeals = (date: string) => ["Breakfast", "Lunch", "Dinner"].map((meal) => ({ date, meal }));

describe("challenges", () => {
  it("score nothing for an empty week", () => {
    const s = scoreWeek(empty);
    expect(s.points).toBe(0);
    expect(s.challenges.every((c) => !c.done)).toBe(true);
  });

  it("give 10 points a logged day plus each finished challenge", () => {
    const s = scoreWeek({
      ...empty,
      diary: WEEK.slice(0, 5).flatMap(threeMeals),
      water: WEEK.slice(0, 5).map((date) => ({ date, ml: 2100 })),
      exercises: [{ date: WEEK[0], minutes: 100, status: "completed" }, { date: WEEK[1], minutes: 60, status: "completed" }, { date: WEEK[2], minutes: 90, status: "planned" }],
      weights: [{ date: WEEK[3] }],
    });
    expect(s.challenges.map((c) => [c.id, c.done])).toEqual([["meals", true], ["water", true], ["active", true], ["weigh", true]]);
    expect(s.activeMinutes).toBe(160);
    expect(s.points).toBe(5 * 10 + 100 + 100 + 100 + 50);
  });

  it("ignore days outside the week and days after today", () => {
    const s = scoreWeek({ ...empty, today: WEEK[2], diary: [...threeMeals("2026-11-01"), ...threeMeals(WEEK[1]), ...threeMeals(WEEK[5])] });
    expect(s.daysLogged).toBe(1);
  });

  it("only count a full day with 3 different meals", () => {
    const s = scoreWeek({ ...empty, diary: WEEK.flatMap((date) => [{ date, meal: "Lunch" }, { date, meal: "Lunch" }]) });
    expect(s.challenges[0].progress).toBe(0);
    expect(s.points).toBe(70);
  });

  it("count streaks that may end yesterday", () => {
    expect(currentStreak(["2026-11-06", "2026-11-07"], "2026-11-08")).toBe(2);
    expect(currentStreak(["2026-11-06", "2026-11-07", "2026-11-08"], "2026-11-08")).toBe(3);
    expect(currentStreak(["2026-11-05"], "2026-11-08")).toBe(0);
    expect(bestStreak(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-10", "2026-10-31", "2026-11-01"])).toBe(3);
  });

  it("keep badges once earned and point to the next one", () => {
    expect(earnedBadges(8).map((b) => b.days)).toEqual([3, 7]);
    expect(nextBadge(8)?.days).toBe(14);
    expect(nextBadge(500)).toBeNull();
  });
});

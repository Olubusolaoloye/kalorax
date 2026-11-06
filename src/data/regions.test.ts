import { describe, expect, it } from "vitest";
import { planCuisinesFor } from "../lib/planner";
import { CUISINES, cuisineOrder, FOODS, searchFoods } from "./foods";
import { DEFAULT_REGION, guessRegion, isRegion, regionById, REGIONS } from "./regions";

describe("regions", () => {
  it("only list cuisines that have foods, with unique ids", () => {
    expect(new Set(REGIONS.map((r) => r.id)).size).toBe(REGIONS.length);
    for (const r of REGIONS) {
      expect(r.cuisines.length).toBeGreaterThan(0);
      for (const c of r.cuisines) expect(FOODS.some((f) => f.cuisine === c), `${r.id} / ${c}`).toBe(true);
    }
  });

  it("treat a missing or unknown region as Nigeria, for profiles made before regions", () => {
    expect(regionById(undefined).id).toBe(DEFAULT_REGION);
    expect(regionById("atlantis").id).toBe(DEFAULT_REGION);
    expect(isRegion("ghana")).toBe(true);
    expect(isRegion("atlantis")).toBe(false);
  });

  it("guess the region from the time zone", () => {
    expect(guessRegion("Africa/Lagos")).toBe("nigeria");
    expect(guessRegion("Africa/Accra")).toBe("ghana");
    expect(guessRegion("Africa/Nairobi")).toBe("east-africa");
    expect(guessRegion("Europe/Moscow")).toBe("russia");
    expect(guessRegion("Europe/London")).toBe("uk-europe");
    expect(guessRegion("America/Jamaica")).toBe("caribbean");
    expect(guessRegion("America/Toronto")).toBe("north-america");
    expect(guessRegion("Asia/Kolkata")).toBe("india");
    expect(guessRegion("Pacific/Auckland")).toBe("other");
  });

  it("put the region's cuisines first and keep every cuisine", () => {
    const order = cuisineOrder(regionById("russia").cuisines);
    expect(order[0]).toBe("Russian");
    expect(new Set(order).size).toBe(CUISINES.length);
  });

  it("rank search results by the region's cuisines", () => {
    // "jollof" is both Nigerian and Ghanaian: each region sees its own first.
    expect(searchFoods("jollof", regionById("ghana").cuisines)[0].cuisine).toBe("Ghanaian");
    expect(searchFoods("jollof", regionById("nigeria").cuisines)[0].cuisine).toBe("Nigerian");
    expect(searchFoods("jollof").length).toBe(searchFoods("jollof", ["Russian"]).length);
  });

  it("start meal plans with cuisines that have recipes", () => {
    expect(planCuisinesFor(regionById("nigeria").cuisines)).toEqual(["Nigerian", "International"]);
    expect(planCuisinesFor(regionById("russia").cuisines)).toEqual(["Continental", "International"]);
    expect(planCuisinesFor(["Indian"])).toEqual(["Continental", "International"]);
  });
});

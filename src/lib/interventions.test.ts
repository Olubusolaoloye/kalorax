import { describe, expect, it } from "vitest";
import { PROGRAMMES } from "../data/programmes";
import { adherence, clientFlags, intakeError, priceError, programmeEnd, programmeWeek, splitPayment, targetError } from "./interventions";

describe("programmes", () => {
  it("have sane price ranges", () => {
    expect(new Set(PROGRAMMES.map((p) => p.id)).size).toBe(PROGRAMMES.length);
    for (const p of PROGRAMMES) {
      expect(p.minPrice, p.id).toBeLessThanOrEqual(p.suggestedPrice);
      expect(p.suggestedPrice, p.id).toBeLessThanOrEqual(p.maxPrice);
    }
  });
});

describe("payments", () => {
  it("splits the price into Kalorax's fee and the dietitian's payout", () => {
    expect(splitPayment(30000)).toEqual({ price: 30000, fee: 6000, payout: 24000 });
    expect(splitPayment(12345, 15)).toEqual({ price: 12345, fee: 1852, payout: 10493 });
  });

  it("keeps prices inside the programme range", () => {
    expect(priceError("diabetes", 40000)).toBeNull();
    expect(priceError("diabetes", 1000)).toMatch(/between ₦25,000 and ₦60,000/);
    expect(priceError("diabetes", 40000.5)).not.toBeNull();
    expect(priceError("nope", 40000)).toBe("Unknown programme.");
  });
});

describe("programme timeline", () => {
  it("counts weeks from the start date", () => {
    expect(programmeWeek(undefined, "2026-10-20", 12)).toBeNull();
    expect(programmeWeek("2026-10-20", "2026-10-19", 12)).toBeNull();
    expect(programmeWeek("2026-10-20", "2026-10-20", 12)).toBe(1);
    expect(programmeWeek("2026-10-20", "2026-10-27", 12)).toBe(2);
    expect(programmeWeek("2026-10-20", "2027-06-01", 12)).toBe(12);
    expect(programmeWeek("2026-10-20", "2026-10-30", 0)).toBe(1);
  });

  it("finds the last day", () => {
    expect(programmeEnd("2026-10-20", 12)).toBe("2027-01-11");
    expect(programmeEnd("2026-10-20", 0)).toBe("2026-10-26");
  });
});

describe("client monitoring", () => {
  it("measures logging in the last 7 days", () => {
    const dates = ["2026-10-20", "2026-10-20", "2026-10-18", "2026-10-14", "2026-10-13", "2026-10-25"];
    expect(adherence(dates, "2026-10-20")).toEqual({ daysLogged7: 3, lastLogDate: "2026-10-20" });
    expect(adherence([], "2026-10-20")).toEqual({ daysLogged7: 0, lastLogDate: null });
  });

  it("flags clients who need attention", () => {
    const base = { status: "active" as const, daysLogged7: 6, lastLogDate: "2026-10-20", weightChangeKg: 0.5, unread: 0, startDate: "2026-09-08" };
    expect(clientFlags(base, "2026-10-20")).toEqual([]);
    expect(clientFlags({ ...base, lastLogDate: "2026-10-15", daysLogged7: 2 }, "2026-10-20")).toEqual(["No logs for 5 days"]);
    expect(clientFlags({ ...base, daysLogged7: 2 }, "2026-10-20")).toEqual(["Logging less than 4 days a week"]);
    // 6 weeks in: losing 4 kg is a healthy pace, 7 kg is too fast, and a 2 kg gain is flagged.
    expect(clientFlags({ ...base, weightChangeKg: -4, unread: 2 }, "2026-10-20")).toEqual(["2 unread"]);
    expect(clientFlags({ ...base, weightChangeKg: -7 }, "2026-10-20")).toEqual(["Losing over 1 kg a week (7.0 kg)"]);
    expect(clientFlags({ ...base, weightChangeKg: 2 }, "2026-10-20")).toEqual(["Weight up 2.0 kg"]);
    expect(clientFlags({ ...base, startDate: "2026-10-13", weightChangeKg: -1.8 }, "2026-10-20")).toEqual(["Losing over 1 kg a week (1.8 kg)"]);
    expect(clientFlags({ ...base, lastLogDate: null }, "2026-10-20")).toEqual(["No logs yet"]);
    expect(clientFlags({ ...base, status: "completed", lastLogDate: null }, "2026-10-20")).toEqual([]);
  });
});

describe("validation", () => {
  it("checks dietitian targets", () => {
    expect(targetError({ kcal: 1800, carbsPercent: 45, proteinPercent: 20, fatPercent: 35 })).toBeNull();
    expect(targetError({ kcal: 500, carbsPercent: 45, proteinPercent: 20, fatPercent: 35 })).toMatch(/800/);
    expect(targetError({ kcal: 1800, carbsPercent: 50, proteinPercent: 20, fatPercent: 35 })).toMatch(/100%/);
  });

  it("checks the intake form", () => {
    const ok = { goals: "Lower my sugar", conditions: [], medications: "", typicalDay: "", allergies: "", consent: true };
    expect(intakeError(ok)).toBeNull();
    expect(intakeError({ ...ok, consent: false })).toMatch(/agree/);
    expect(intakeError({ ...ok, goals: " " })).toMatch(/achieve/);
  });
});

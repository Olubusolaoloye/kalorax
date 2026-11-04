import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";
import { waitlistCsv } from "../pages/Admin";

describe("waitlist CSV", () => {
  it("has a header row, readable roles and dates, and defuses formula-like emails", () => {
    const csv = waitlistCsv([
      { email: "ada@example.com", role: "member", joinedAt: "2026-11-04T10:00:00.000Z" },
      { email: "=hyperlink@x.com", role: "dietitian", joinedAt: "2026-11-03T08:00:00.000Z" },
    ]);
    expect(parseCsv(csv)).toEqual([
      ["Email", "Role", "Joined"],
      ["ada@example.com", "Member", "2026-11-04"],
      ["'=hyperlink@x.com", "Dietitian", "2026-11-03"],
    ]);
  });
});

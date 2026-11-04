import { describe, expect, it } from "vitest";
import { cleanReport } from "../../convex/vitals";
import { pagePattern } from "./vitals";

describe("speed reports", () => {
  it("group pages without ids", () => {
    expect(pagePattern("/clients/k17d2v8x9q0w1e2r3t4y5u6i")).toBe("/clients/:id");
    expect(pagePattern("/learn/drink-more-water")).toBe("/learn/drink-more-water");
    expect(pagePattern("/")).toBe("/");
  });

  it("keep plausible reports and rate them by Google's thresholds", () => {
    expect(cleanReport({ metric: "LCP", value: 1800, path: "/home", device: "mobile" }, 1)).toEqual({ metric: "LCP", value: 1800, rating: "good", path: "/home", device: "mobile", at: 1 });
    expect(cleanReport({ metric: "INP", value: 350, path: "/diary", device: "desktop" }, 1)?.rating).toBe("needs-improvement");
    expect(cleanReport({ metric: "CLS", value: 0.4, path: "/x" }, 1)).toMatchObject({ rating: "poor", device: "desktop" });
  });

  it("drop broken or fake ones", () => {
    expect(cleanReport({ metric: "LCP", value: -5, path: "/" }, 1)).toBeNull();
    expect(cleanReport({ metric: "LCP", value: 1e9, path: "/" }, 1)).toBeNull();
    expect(cleanReport({ metric: "FID", value: 10, path: "/" }, 1)).toBeNull();
    expect(cleanReport("nonsense", 1)).toBeNull();
    // A path that isn't a plain page path is stored as "/".
    expect(cleanReport({ metric: "TTFB", value: 300, path: "https://evil.example/<script>" }, 1)?.path).toBe("/");
  });
});

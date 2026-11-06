// Real-user speed tracking: each visitor's browser reports how fast pages loaded and responded
// (Core Web Vitals, measured with the web-vitals library) to POST /vitals (see http.ts).
// Admins see the 75th percentile per metric on the Admin overview. Nothing identifies the visitor.
import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { requireAdmin } from "./helpers";
import { tryTake } from "./rateLimit";

const DAY = 86_400_000;
const KEEP_DAYS = 30;
const METRICS = ["LCP", "INP", "CLS", "FCP", "TTFB"] as const;
type Metric = (typeof METRICS)[number];

/** Plausible ranges; anything outside is a broken or fake report. CLS has no unit, the rest are milliseconds. */
const MAX: Record<Metric, number> = { LCP: 120_000, INP: 60_000, CLS: 10, FCP: 120_000, TTFB: 120_000 };

/** Google's thresholds for "good" and "poor". */
export const THRESHOLDS: Record<Metric, [good: number, poor: number]> = {
  LCP: [2500, 4000],
  INP: [200, 500],
  CLS: [0.1, 0.25],
  FCP: [1800, 3000],
  TTFB: [800, 1800],
};

const rate = (m: Metric, value: number): "good" | "needs-improvement" | "poor" =>
  value <= THRESHOLDS[m][0] ? "good" : value <= THRESHOLDS[m][1] ? "needs-improvement" : "poor";

/** Keeps a report only if it looks real. Returns the row to store, or null. */
export function cleanReport(r: unknown, now: number) {
  if (!r || typeof r !== "object") return null;
  const { metric, value, path, device } = r as Record<string, unknown>;
  if (typeof metric !== "string" || !(METRICS as readonly string[]).includes(metric)) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX[metric as Metric]) return null;
  const p = typeof path === "string" && /^\/[\w/:.-]{0,59}$/.test(path) ? path : "/";
  return {
    metric: metric as Metric,
    value,
    rating: rate(metric as Metric, value),
    path: p,
    device: device === "mobile" ? ("mobile" as const) : ("desktop" as const),
    at: now,
  };
}

export const record = internalMutation({
  args: { reports: v.array(v.any()) },
  handler: async (ctx, { reports }) => {
    const now = Date.now();
    // Anyone can post here, so the whole endpoint has an hourly cap; extra reports are dropped.
    if (!(await tryTake(ctx, "vitalsGlobal", "", Math.min(reports.length, 10)))) return;
    for (const r of reports.slice(0, 10)) {
      const row = cleanReport(r, now);
      if (row) await ctx.db.insert("vitals", row);
    }
  },
});

/** Drops reports older than 30 days (runs daily, see crons.ts). */
export const prune = internalMutation({
  args: {},
  handler: async (ctx) => {
    const old = await ctx.db.query("vitals").withIndex("by_at", (q) => q.lt("at", Date.now() - KEEP_DAYS * DAY)).take(2000);
    for (const r of old) await ctx.db.delete(r._id);
  },
});

const p75 = (values: number[]) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.75) - 1)];
};

/** Admin: the last 7 days of real-visitor speed, per metric, overall and on phones. */
export const summary = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("vitals").withIndex("by_at", (q) => q.gt("at", Date.now() - 7 * DAY)).order("desc").take(20_000);
    const slowest = new Map<string, number[]>();
    for (const r of rows) if (r.metric === "LCP") slowest.set(r.path, [...(slowest.get(r.path) ?? []), r.value]);
    return {
      reports: rows.length,
      metrics: METRICS.map((metric) => {
        const mine = rows.filter((r) => r.metric === metric);
        const p = p75(mine.map((r) => r.value));
        return {
          metric,
          count: mine.length,
          p75: p,
          p75Mobile: p75(mine.filter((r) => r.device === "mobile").map((r) => r.value)),
          rating: p === null ? null : rate(metric, p),
          goodShare: mine.length ? mine.filter((r) => r.rating === "good").length / mine.length : null,
        };
      }),
      /** Pages with the slowest typical load (LCP), at least 5 reports each. */
      slowestPages: [...slowest.entries()]
        .filter(([, vals]) => vals.length >= 5)
        .map(([path, vals]) => ({ path, p75: p75(vals)!, count: vals.length }))
        .sort((a, b) => b.p75 - a.p75)
        .slice(0, 5),
    };
  },
});

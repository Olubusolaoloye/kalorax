// On-device reminders (no account): checks every 30 seconds while Kalorax is open and shows a
// notification when something is due. Accounts get server-sent push and WhatsApp instead.
import { useEffect, useRef } from "react";
import { dailyWaterTargetMl } from "../lib/nutrition";
import { dishLabel } from "../lib/planner";
import { showNotification } from "../lib/push";
import { REMINDER_MEALS, SNOOZE_MINUTES, dueReminders, localParts, type ReminderContext } from "../lib/reminders";
import { portionOf, useStore } from "./store";

const SENT_KEY = "kalorax:reminders-sent";
const KEEP_MS = 3 * 24 * 3600_000;

function readSent(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function useLocalReminders() {
  const store = useStore();
  const latest = useRef(store);
  latest.current = store;
  const enabled = store.mode === "local" && store.reminders.push && !!store.profile;

  useEffect(() => {
    if (!enabled || typeof Notification === "undefined") return;
    const run = () => {
      if (Notification.permission !== "granted") return;
      const { reminders, plan, planPortions, events, water, latestWeightKg } = latest.current;
      const now = Date.now();
      const settings = { ...reminders, utcOffsetMinutes: -new Date().getTimezoneOffset() };
      const { date } = localParts(now, settings.utcOffsetMinutes);
      const ctx: ReminderContext = { plan: {}, events, waterMl: water[date] ?? 0, waterTargetMl: latestWeightKg ? dailyWaterTargetMl(latestWeightKg) : null };
      for (const meal of REMINDER_MEALS) {
        const id = plan[date]?.[meal];
        const label = id && dishLabel(id, portionOf(planPortions, date, meal));
        if (label) ctx.plan[meal] = label;
      }
      const sent = readSent();
      for (const m of dueReminders(settings, now, ctx)) {
        if (sent[m.key]) continue;
        sent[m.key] = now;
        void showNotification(m.title, m.body, m.url, m.key, m.priority);
      }
      for (const [k, t] of Object.entries(sent)) if (now - t > KEEP_MS) delete sent[k];
      try {
        localStorage.setItem(SENT_KEY, JSON.stringify(sent));
      } catch {
        // Storage unavailable: reminders may repeat this visit, which is harmless.
      }
    };
    run();
    const id = setInterval(run, 30_000);
    // "Snooze" on an alarm (public/sw.js asks the open app): show it again in 10 minutes.
    const timers: number[] = [];
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; title?: string; body?: string; url?: string; tag?: string } | null;
      if (d?.type !== "snooze" || !d.title) return;
      const title = d.title.startsWith("⏰") ? d.title : `⏰ ${d.title}`;
      timers.push(window.setTimeout(() => void showNotification(title, d.body ?? "", d.url, d.tag, true), SNOOZE_MINUTES * 60_000));
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      clearInterval(id);
      timers.forEach(clearTimeout);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [enabled]);
}

// Weekly challenges, streaks and badges. One pure function scores a week, so the app (your own card) and the
// server (friends' and team leaderboards) always agree. Challenges reward habits (logging, water, movement,
// weighing in), never eating less: a leaderboard shouldn't turn calories into a competition.
import { shiftDate } from "./dates";

export interface WeekData {
  /** The 7 dates of the week (Mon–Sun). */
  dates: string[];
  /** Days after this aren't counted yet. */
  today: string;
  diary: Array<{ date: string; meal: string }>;
  water: Array<{ date: string; ml: number }>;
  waterTargetMl: number;
  exercises: Array<{ date: string; minutes: number; status: string }>;
  weights: Array<{ date: string }>;
}

export interface Challenge {
  id: "meals" | "water" | "active" | "weigh";
  emoji: string;
  title: string;
  progress: number;
  goal: number;
  unit: string;
  points: number;
  done: boolean;
}

export interface WeekScore {
  challenges: Challenge[];
  /** Days with at least one meal logged this week. */
  daysLogged: number;
  activeMinutes: number;
  points: number;
}

/** Points for each day with something logged. */
export const DAY_POINTS = 10;
/** The WHO's weekly guideline for adults. */
export const ACTIVE_GOAL = 150;

export function scoreWeek(w: WeekData): WeekScore {
  const inWeek = (date: string) => w.dates.includes(date) && date <= w.today;
  const mealsByDay = new Map<string, Set<string>>();
  for (const e of w.diary) if (inWeek(e.date)) mealsByDay.set(e.date, (mealsByDay.get(e.date) ?? new Set()).add(e.meal));
  const fullDays = [...mealsByDay.values()].filter((m) => m.size >= 3).length;
  const waterByDay = new Map<string, number>();
  for (const r of w.water) if (inWeek(r.date)) waterByDay.set(r.date, (waterByDay.get(r.date) ?? 0) + r.ml);
  const waterDays = [...waterByDay.values()].filter((ml) => w.waterTargetMl > 0 && ml >= w.waterTargetMl).length;
  const activeMinutes = w.exercises.filter((x) => inWeek(x.date) && x.status === "completed").reduce((t, x) => t + x.minutes, 0);
  const weighIns = w.weights.filter((x) => inWeek(x.date)).length;

  const challenge = (c: Omit<Challenge, "done">): Challenge => ({ ...c, progress: Math.min(c.progress, c.goal), done: c.progress >= c.goal });
  const challenges = [
    challenge({ id: "meals", emoji: "🍽️", title: "Log 3 meals a day on 5 days", progress: fullDays, goal: 5, unit: "days", points: 100 }),
    challenge({ id: "water", emoji: "💧", title: "Hit your water goal on 5 days", progress: waterDays, goal: 5, unit: "days", points: 100 }),
    challenge({ id: "active", emoji: "🏃", title: `${ACTIVE_GOAL} active minutes`, progress: activeMinutes, goal: ACTIVE_GOAL, unit: "min", points: 100 }),
    challenge({ id: "weigh", emoji: "⚖️", title: "Weigh in this week", progress: weighIns, goal: 1, unit: "weigh-in", points: 50 }),
  ];
  const daysLogged = mealsByDay.size;
  return {
    challenges,
    daysLogged,
    activeMinutes,
    points: daysLogged * DAY_POINTS + challenges.filter((c) => c.done).reduce((t, c) => t + c.points, 0),
  };
}

/** Days in a row with a meal logged, ending today (or yesterday, since today may not be logged yet). */
export function currentStreak(loggedDates: Iterable<string>, today: string): number {
  const days = new Set(loggedDates);
  let streak = 0;
  for (let d = days.has(today) ? today : shiftDate(today, -1); days.has(d); d = shiftDate(d, -1)) streak++;
  return streak;
}

/** The longest run of days in a row with a meal logged. */
export function bestStreak(loggedDates: Iterable<string>): number {
  const sorted = [...new Set(loggedDates)].sort();
  let best = 0;
  let run = 0;
  sorted.forEach((d, i) => {
    run = i > 0 && shiftDate(sorted[i - 1], 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

export const STREAK_BADGES = [
  { days: 3, emoji: "✨", name: "3-day spark" },
  { days: 7, emoji: "🔥", name: "One full week" },
  { days: 14, emoji: "💪", name: "Two weeks strong" },
  { days: 30, emoji: "🏅", name: "30-day habit" },
  { days: 60, emoji: "🚀", name: "60 days in a row" },
  { days: 100, emoji: "👑", name: "100-day legend" },
] as const;

/** Badges are earned by the best streak ever, so a missed day never takes one away. */
export const earnedBadges = (best: number) => STREAK_BADGES.filter((b) => best >= b.days);
export const nextBadge = (best: number) => STREAK_BADGES.find((b) => best < b.days) ?? null;

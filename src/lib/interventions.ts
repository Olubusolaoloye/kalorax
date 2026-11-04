// Paid interventions and dietitian client tools: shared types and pure rules.
// Used by the app and the Convex server, so it has no app imports beyond types and data.
import { PLATFORM_FEE_PERCENT, programmeById } from "../data/programmes";
import type { Condition } from "./nutrition";

export type EnrolmentStatus = "pending_payment" | "active" | "completed" | "cancelled";

export interface Intake {
  goals: string;
  conditions: Condition[];
  medications: string;
  typicalDay: string;
  allergies: string;
  /** The member agreed to share their logs with this dietitian for the programme. */
  consent: boolean;
}

export interface DietitianTarget {
  kcal: number;
  carbsPercent: number;
  proteinPercent: number;
  fatPercent: number;
  note?: string;
  setAt: string;
}

export interface Adjunct {
  id: string;
  name: string;
  dose: string;
  timing: string;
  reason: string;
  approvedBy: string;
  approvedAt: string;
}

export interface CheckIn {
  id: string;
  week: number;
  summary: string;
  nextSteps: string;
  weightKg?: number;
  createdAt: string;
}

export interface ThreadMessage {
  id: string;
  fromMe: boolean;
  senderName: string;
  text: string;
  sentAt: string;
}

export interface DietitianCard {
  id: string;
  name: string;
  bio: string;
  languages: string[];
  yearsExperience: number;
  /** Clients who finished a programme with them. */
  clientsHelped: number;
}

export interface Offering {
  id: string;
  programmeId: string;
  priceNaira: number;
  dietitian: DietitianCard;
}

export interface MemberEnrolment {
  id: string;
  programmeId: string;
  priceNaira: number;
  status: EnrolmentStatus;
  createdAt: string;
  startDate?: string;
  dietitian: DietitianCard;
  target?: DietitianTarget;
  planWeekStart?: string;
  adjuncts: Adjunct[];
  checkIns: CheckIn[];
  messages: ThreadMessage[];
  /** Messages from the dietitian the member hasn't opened. */
  unread?: number;
  /** Preview (no account): nothing is stored on a server and no payment was taken. */
  sample?: boolean;
}

export interface ClientSummary {
  enrolmentId: string;
  name: string;
  programmeId: string;
  status: EnrolmentStatus;
  startDate?: string;
  daysLogged7: number;
  lastLogDate: string | null;
  latestWeightKg: number | null;
  weightChangeKg: number | null;
  unread: number;
  sample?: boolean;
}

export interface ClientDetail extends ClientSummary {
  sex: "female" | "male";
  birthDate: string;
  heightCm: number;
  activity: "sedentary" | "light" | "moderate" | "vigorous";
  goal: "lose" | "maintain" | "gain" | "eat_healthier";
  conditions: Condition[];
  intake: Intake;
  weights: Array<{ date: string; weightKg: number }>;
  diary: Array<{ date: string; meal: "Breakfast" | "Lunch" | "Dinner" | "Snacks"; foodId: string; grams: number; portionLabel: string }>;
  water: Record<string, number>;
  notes: Array<{ date: string; slot: string; feeling?: number; tags: string[]; text: string }>;
  target?: DietitianTarget;
  planWeekStart?: string;
  adjuncts: Adjunct[];
  checkIns: CheckIn[];
  messages: ThreadMessage[];
}

export interface Earnings {
  grossNaira: number;
  feeNaira: number;
  netNaira: number;
  paidOutNaira: number;
  balanceNaira: number;
  activeClients: number;
}

/** What the member pays, Kalorax's fee and the dietitian's share (whole Naira). */
export function splitPayment(priceNaira: number, feePercent = PLATFORM_FEE_PERCENT) {
  const fee = Math.round((priceNaira * feePercent) / 100);
  return { price: priceNaira, fee, payout: priceNaira - fee };
}

/** A dietitian's price must sit inside the programme's range. Returns an error message or null. */
export function priceError(programmeId: string, priceNaira: number): string | null {
  const p = programmeById(programmeId);
  if (!p) return "Unknown programme.";
  if (!Number.isInteger(priceNaira) || priceNaira < p.minPrice || priceNaira > p.maxPrice) {
    return `Price must be between ₦${p.minPrice.toLocaleString("en-NG")} and ₦${p.maxPrice.toLocaleString("en-NG")}.`;
  }
  return null;
}

const dayMs = 86_400_000;
const days = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / dayMs);

/** Current programme week (1-based), capped at the programme length. Null before it starts. */
export function programmeWeek(startDate: string | undefined, today: string, weeks: number): number | null {
  if (!startDate) return null;
  const d = days(startDate, today);
  if (d < 0) return null;
  return Math.min(Math.max(1, weeks), Math.floor(d / 7) + 1);
}

/** Last day of the programme (consultations run for 7 days of chat). */
export function programmeEnd(startDate: string, weeks: number): string {
  const end = new Date(`${startDate}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + Math.max(1, weeks) * 7 - 1);
  return end.toISOString().slice(0, 10);
}

/** Days with at least one diary entry in the 7 days up to `today`, and the most recent log date. */
export function adherence(diaryDates: string[], today: string) {
  const window = new Set<string>();
  let last: string | null = null;
  for (const d of diaryDates) {
    const diff = days(d, today);
    if (diff >= 0 && diff < 7) window.add(d);
    if (diff >= 0 && (!last || d > last)) last = d;
  }
  return { daysLogged7: window.size, lastLogDate: last };
}

/** Things a dietitian should look at first. */
export function clientFlags(c: Pick<ClientSummary, "status" | "daysLogged7" | "lastLogDate" | "weightChangeKg" | "unread" | "startDate">, today: string): string[] {
  const flags: string[] = [];
  if (c.status !== "active") return flags;
  if (c.unread > 0) flags.push(`${c.unread} unread`);
  if (!c.lastLogDate) flags.push("No logs yet");
  else if (days(c.lastLogDate, today) >= 3) flags.push(`No logs for ${days(c.lastLogDate, today)} days`);
  else if (c.daysLogged7 < 4) flags.push("Logging less than 4 days a week");
  if (c.weightChangeKg !== null) {
    // Faster than ~1 kg a week on average is worth a look; so is any real gain.
    const weeks = Math.max(1, (c.startDate ? days(c.startDate, today) : 7) / 7);
    if (c.weightChangeKg <= -weeks && c.weightChangeKg <= -1.5) flags.push(`Losing over 1 kg a week (${Math.abs(c.weightChangeKg).toFixed(1)} kg)`);
    else if (c.weightChangeKg >= 1.5) flags.push(`Weight up ${c.weightChangeKg.toFixed(1)} kg`);
  }
  return flags;
}

/** Validation for a dietitian-set target. Returns an error message or null. */
export function targetError(t: Pick<DietitianTarget, "kcal" | "carbsPercent" | "proteinPercent" | "fatPercent">): string | null {
  if (!Number.isFinite(t.kcal) || t.kcal < 800 || t.kcal > 5000) return "Daily energy must be between 800 and 5,000 kcal.";
  const parts = [t.carbsPercent, t.proteinPercent, t.fatPercent];
  if (parts.some((p) => !Number.isFinite(p) || p < 0 || p > 100)) return "Macro percentages must be 0–100.";
  if (Math.abs(parts.reduce((a, b) => a + b, 0) - 100) > 0.5) return "Carbs, protein and fat must add up to 100%.";
  return null;
}

/** Validation for the intake form. Returns an error message or null. */
export function intakeError(i: Intake): string | null {
  if (!i.consent) return "Please agree to share your logs with your dietitian so they can support you.";
  if (!i.goals.trim()) return "Tell your dietitian what you'd like to achieve.";
  for (const [label, value] of [["Goals", i.goals], ["Medicines", i.medications], ["Typical day", i.typicalDay], ["Allergies", i.allergies]] as const) {
    if (value.length > 1000) return `${label} is too long (max 1000 characters).`;
  }
  return null;
}

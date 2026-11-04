// Usernames (@handles): how members find each other to chat. Lowercase, unique, 3–20 characters.
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const RESERVED = new Set([
  "admin", "administrator", "kalorax", "nutrintel", "nutrifi", "support", "help", "root", "system", "official", "moderator", "mod",
  "staff", "team", "dietitian", "dietician", "doctor", "me", "you", "null", "undefined", "everyone", "here",
]);

/** "@DevOlu " → "devolu". */
export const normalizeUsername = (raw: string) => raw.trim().replace(/^@+/, "").toLowerCase();

/** Why a username can't be used, or null if it's fine (not counting whether it's taken). */
export function usernameProblem(u: string): string | null {
  if (u.length < 3 || u.length > 20) return "Use 3 to 20 characters.";
  if (!/^[a-z0-9._]+$/.test(u)) return "Use only letters, numbers, _ and .";
  if (!/^[a-z]/.test(u)) return "Start with a letter.";
  if (u.endsWith(".") || u.includes("..")) return "Dots can't be at the end or next to each other.";
  if (RESERVED.has(u.replace(/[._]/g, ""))) return "That username is reserved.";
  return null;
}

export async function profileByUsername(ctx: QueryCtx | MutationCtx, username: string) {
  return ctx.db.query("profiles").withIndex("by_username", (q) => q.eq("username", username)).unique();
}

/** A free username made from the person's name, e.g. "Ada Okafor" → "adaokafor" or "adaokafor27". */
export async function suggestUsername(ctx: MutationCtx, name: string, userId: Id<"users">): Promise<string> {
  let base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "").slice(0, 15);
  if (!/^[a-z]/.test(base)) base = `n${base}`;
  if (base.length < 3 || usernameProblem(base)) base = `member${base}`.slice(0, 15);
  // Deterministic tries first (so tests and retries are stable), then random digits.
  const seed = parseInt(String(userId).replace(/[^0-9]/g, "").slice(-4) || "0", 10);
  const tries = [base, ...Array.from({ length: 30 }, (_, i) => `${base}${i < 10 ? (seed + i) % 100 : Math.floor(Math.random() * 9000) + 1000}`)];
  for (const t of tries) if (!usernameProblem(t) && !(await profileByUsername(ctx, t))) return t;
  throw new ConvexError("Couldn't make a username. Please choose one on the Me page.");
}

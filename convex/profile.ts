import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { checkDate, checkRange, checkText, getProfile, requireUser } from "./helpers";
import { normalizeUsername, profileByUsername, suggestUsername, usernameProblem } from "./usernames";
import { isRegion } from "../src/data/regions";
import { profileFields, role } from "./validators";

function checkProfile(p: { name?: string; birthDate?: string; heightCm?: number; region?: string }) {
  if (p.name !== undefined) checkText(p.name, 60, "Name");
  if (p.region !== undefined && !isRegion(p.region)) throw new ConvexError("Pick a region from the list.");
  if (p.birthDate !== undefined) checkDate(p.birthDate);
  if (p.heightCm !== undefined) checkRange(p.heightCm, 50, 250, "Height (cm)");
}

/** Create the profile at the end of onboarding, with the first weight. */
export const create = mutation({
  args: { ...profileFields, role, weightKg: v.number(), credential: v.optional(v.string()) },
  handler: async (ctx, { weightKg, credential, ...p }) => {
    const userId = await requireUser(ctx);
    if (await getProfile(ctx, userId)) throw new ConvexError("Your profile already exists.");
    checkProfile(p);
    checkRange(weightKg, 20, 350, "Weight (kg)");
    const isPro = p.role !== "consumer";
    const now = Date.now();
    const username = await suggestUsername(ctx, p.name, userId);
    await ctx.db.insert("profiles", { ...p, userId, verification: isPro && credential ? "pending" : "none", createdAt: now, username });
    await ctx.db.insert("weights", { userId, date: new Date(now).toISOString().slice(0, 10), weightKg });
    if (isPro && credential) {
      checkText(credential, 120, "Credential");
      await ctx.db.insert("verifications", {
        userId,
        role: p.role as "student" | "dietitian",
        credential: credential.trim(),
        status: "pending",
        submittedAt: now,
      });
    }
  },
});

/** Members can edit their own details. Role and verification can't be changed here. */
export const update = mutation({
  args: {
    name: v.optional(profileFields.name),
    sex: v.optional(profileFields.sex),
    birthDate: v.optional(profileFields.birthDate),
    heightCm: v.optional(profileFields.heightCm),
    activity: v.optional(profileFields.activity),
    goal: v.optional(profileFields.goal),
    conditions: v.optional(profileFields.conditions),
    region: v.optional(v.string()),
  },
  handler: async (ctx, patch) => {
    const userId = await requireUser(ctx);
    const profile = await getProfile(ctx, userId);
    if (!profile) throw new ConvexError("Finish setting up your profile first.");
    checkProfile(patch);
    await ctx.db.patch(profile._id, patch);
  },
});

/** Gives a profile made before usernames existed its username. Safe to call any time. */
export const ensureUsername = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const profile = await getProfile(ctx, userId);
    if (!profile) return null;
    if (profile.username) return profile.username;
    const username = await suggestUsername(ctx, profile.name, userId);
    await ctx.db.patch(profile._id, { username });
    return username;
  },
});

/** Whether a username can be used: null if it's free (or already yours), otherwise why not. */
export const usernameAvailable = query({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const userId = await requireUser(ctx);
    const u = normalizeUsername(username);
    const problem = usernameProblem(u);
    if (problem) return problem;
    const owner = await profileByUsername(ctx, u);
    return owner && owner.userId !== userId ? "That username is taken." : null;
  },
});

export const setUsername = mutation({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const userId = await requireUser(ctx);
    const profile = await getProfile(ctx, userId);
    if (!profile) throw new ConvexError("Finish setting up your profile first.");
    const u = normalizeUsername(username);
    const problem = usernameProblem(u);
    if (problem) throw new ConvexError(problem);
    const owner = await profileByUsername(ctx, u);
    if (owner && owner.userId !== userId) throw new ConvexError("That username is taken.");
    await ctx.db.patch(profile._id, { username: u });
    return u;
  },
});

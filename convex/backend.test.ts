// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

const PROFILE = {
  name: "Adaeze",
  sex: "female" as const,
  birthDate: "1996-01-15",
  heightCm: 165,
  activity: "light" as const,
  goal: "lose" as const,
  conditions: [],
};

/** A signed-in client for a new user (Convex Auth reads "userId|sessionId" from the token subject). */
async function signedIn(t: ReturnType<typeof convexTest>, email: string) {
  const userId = await t.run((ctx) => ctx.db.insert("users", { email }));
  const sessionId = await t.run((ctx) => ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 1e9 }));
  return { userId, as: t.withIdentity({ subject: `${userId}|${sessionId}` }) };
}

beforeEach(() => vi.stubEnv("ADMIN_EMAILS", "admin@kalorax.app"));
afterEach(() => vi.unstubAllEnvs());

describe("accounts and profile", () => {
  it("returns nothing when signed out", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.me.snapshot, {})).toBeNull();
  });

  it("creates a profile with the first weight, once", async () => {
    const t = convexTest(schema, modules);
    const { as } = await signedIn(t, "ada@example.com");
    expect((await as.query(api.me.snapshot, {}))!.profile).toBeNull();
    await as.mutation(api.profile.create, { ...PROFILE, role: "consumer", weightKg: 70 });
    const s = (await as.query(api.me.snapshot, {}))!;
    expect(s.email).toBe("ada@example.com");
    expect(s.profile).toMatchObject({ name: "Adaeze", role: "consumer", verification: "none" });
    expect(s.weights.map((w) => w.weightKg)).toEqual([70]);
    await expect(as.mutation(api.profile.create, { ...PROFILE, role: "consumer", weightKg: 70 })).rejects.toThrow(/already exists/);
  });

  it("rejects out-of-range values", async () => {
    const t = convexTest(schema, modules);
    const { as } = await signedIn(t, "ada@example.com");
    await expect(as.mutation(api.profile.create, { ...PROFILE, heightCm: 20, role: "consumer", weightKg: 70 })).rejects.toThrow(/Height/);
  });
});

describe("verification", () => {
  it("students start pending and can't approve themselves", async () => {
    const t = convexTest(schema, modules);
    const { as } = await signedIn(t, "tunde@unn.edu.ng");
    await as.mutation(api.profile.create, { ...PROFILE, name: "Tunde", role: "student", weightKg: 72, credential: "UNN 2022/1234" });
    const s = (await as.query(api.me.snapshot, {}))!;
    expect(s.profile!.verification).toBe("pending");
    expect(s.verification).toMatchObject({ status: "pending", credential: "UNN 2022/1234" });
    // The profile update endpoint has no verification field at all.
    await expect(
      as.mutation(api.profile.update, { verification: "verified" } as unknown as Record<string, never>),
    ).rejects.toThrow();
    await expect(as.query(api.verification.listPending, {})).rejects.toThrow(/Admins only/);
  });

  it("an admin approves or rejects, and the profile follows", async () => {
    const t = convexTest(schema, modules);
    const student = await signedIn(t, "tunde@unn.edu.ng");
    const admin = await signedIn(t, "admin@kalorax.app");
    await student.as.mutation(api.profile.create, { ...PROFILE, role: "student", weightKg: 72, credential: "UNN 2022/1234" });

    const queue = await admin.as.query(api.verification.listPending, {});
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ email: "tunde@unn.edu.ng", credential: "UNN 2022/1234", documentUrl: null });

    await admin.as.mutation(api.verification.review, { id: queue[0]._id, decision: "rejected", note: "Matric not found" });
    let s = (await student.as.query(api.me.snapshot, {}))!;
    expect(s.profile!.verification).toBe("rejected");
    expect(s.verification!.reviewerNote).toBe("Matric not found");

    await student.as.mutation(api.verification.submit, { credential: "UNN 2022/12345" });
    const again = await admin.as.query(api.verification.listPending, {});
    await admin.as.mutation(api.verification.review, { id: again[0]._id, decision: "verified" });
    s = (await student.as.query(api.me.snapshot, {}))!;
    expect(s.profile!.verification).toBe("verified");
    await expect(admin.as.mutation(api.verification.review, { id: again[0]._id, decision: "verified" })).rejects.toThrow(/already handled/);
  });

  it("members can't submit verification", async () => {
    const t = convexTest(schema, modules);
    const { as } = await signedIn(t, "ada@example.com");
    await as.mutation(api.profile.create, { ...PROFILE, role: "consumer", weightKg: 70 });
    await expect(as.mutation(api.verification.submit, { credential: "DT/1" })).rejects.toThrow(/Only students and dietitians/);
  });
});

describe("logs and ownership", () => {
  it("keeps each user's data private", async () => {
    const t = convexTest(schema, modules);
    const a = await signedIn(t, "a@example.com");
    const b = await signedIn(t, "b@example.com");
    for (const u of [a, b]) await u.as.mutation(api.profile.create, { ...PROFILE, role: "consumer", weightKg: 70 });
    await a.as.mutation(api.data.addDiaryEntries, { entries: [{ date: "2026-10-16", meal: "Lunch", foodId: "jollof", grams: 140, portionLabel: "2 cooking spoons" }] });
    const entryId = (await a.as.query(api.me.snapshot, {}))!.diary[0]._id;

    expect((await b.as.query(api.me.snapshot, {}))!.diary).toHaveLength(0);
    await expect(b.as.mutation(api.data.removeDiaryEntry, { id: entryId })).rejects.toThrow(/Not found/);
    await a.as.mutation(api.data.removeDiaryEntry, { id: entryId });
    expect((await a.as.query(api.me.snapshot, {}))!.diary).toHaveLength(0);
  });

  it("accumulates water and never goes below zero", async () => {
    const t = convexTest(schema, modules);
    const { as } = await signedIn(t, "a@example.com");
    await as.mutation(api.data.addWater, { date: "2026-10-16", ml: 500 });
    await as.mutation(api.data.addWater, { date: "2026-10-16", ml: 250 });
    await as.mutation(api.data.addWater, { date: "2026-10-16", ml: -1000 });
    await as.mutation(api.data.addWater, { date: "2026-10-17", ml: 500 });
    const water = (await as.query(api.me.snapshot, {}))!.water;
    expect(Object.fromEntries(water.map((w) => [w.date, w.ml]))).toEqual({ "2026-10-16": 0, "2026-10-17": 500 });
  });

  it("upserts and deletes notes and plan slots", async () => {
    const t = convexTest(schema, modules);
    const { as } = await signedIn(t, "a@example.com");
    await as.mutation(api.data.setNote, { date: "2026-10-16", slot: "Lunch", note: { feeling: 4, tags: ["Satisfied"], text: "Good" } });
    await as.mutation(api.data.setNote, { date: "2026-10-16", slot: "Lunch", note: { feeling: 5, tags: [], text: "Great" } });
    await as.mutation(api.data.setPlanSlot, { date: "2026-10-16", meal: "Dinner", recipeId: "egusi-eba" });
    await as.mutation(api.data.setPlanSlot, { date: "2026-10-16", meal: "Dinner", recipeId: "beans-dodo" });
    let s = (await as.query(api.me.snapshot, {}))!;
    expect(s.notes).toHaveLength(1);
    expect(s.notes[0]).toMatchObject({ feeling: 5, text: "Great" });
    expect(s.plan).toEqual([expect.objectContaining({ meal: "Dinner", recipeId: "beans-dodo" })]);
    await as.mutation(api.data.setNote, { date: "2026-10-16", slot: "Lunch", note: null });
    await as.mutation(api.data.setPlanSlot, { date: "2026-10-16", meal: "Dinner", recipeId: null });
    s = (await as.query(api.me.snapshot, {}))!;
    expect(s.notes).toHaveLength(0);
    expect(s.plan).toHaveLength(0);
  });

  it("rejects bad dates", async () => {
    const t = convexTest(schema, modules);
    const { as } = await signedIn(t, "a@example.com");
    await expect(as.mutation(api.data.addWater, { date: "16/10/2026", ml: 500 })).rejects.toThrow(/Invalid date/);
  });
});

describe("import, deletion and waitlist", () => {
  const payload = {
    diary: [{ date: "2026-10-15", meal: "Dinner" as const, foodId: "eba", grams: 250, portionLabel: "Medium wrap" }],
    water: [{ date: "2026-10-15", ml: 1500 }],
    weights: [{ date: "2026-10-01", weightKg: 71 }],
    notes: [],
    plan: [],
    events: [],
    exercises: [{ date: "2026-10-15", activityId: "brisk-walking", minutes: 30, status: "completed" as const }],
  };

  it("imports on-device data once", async () => {
    const t = convexTest(schema, modules);
    const { as } = await signedIn(t, "a@example.com");
    expect((await as.mutation(api.importLocal.importLocal, payload)).imported).toBe(4);
    const s = (await as.query(api.me.snapshot, {}))!;
    expect(s.diary).toHaveLength(1);
    expect(s.exercises).toHaveLength(1);
    await expect(as.mutation(api.importLocal.importLocal, payload)).rejects.toThrow(/already has logs/);
  });

  it("deletes data, and optionally the account", async () => {
    const t = convexTest(schema, modules);
    const { as, userId } = await signedIn(t, "a@example.com");
    await as.mutation(api.profile.create, { ...PROFILE, role: "consumer", weightKg: 70 });
    await as.mutation(api.importLocal.importLocal, payload);
    await as.mutation(api.data.deleteMyData, {});
    const s = (await as.query(api.me.snapshot, {}))!;
    expect(s.profile).toBeNull();
    expect(s.diary.length + s.weights.length + s.water.length + s.exercises.length).toBe(0);

    await as.mutation(api.data.deleteMyData, { deleteAccount: true });
    expect(await t.run((ctx) => ctx.db.get(userId))).toBeNull();
  });

  it("adds each email to the waitlist once", async () => {
    const t = convexTest(schema, modules);
    const first = await t.mutation(api.waitlist.join, { email: "Folake@Example.com ", role: "dietitian" });
    expect(first).toMatchObject({ alreadyJoined: false, emailed: false });
    expect(first.code).toMatch(/^[a-z2-9]{8}$/);
    // Joining again gives back the same code.
    expect(await t.mutation(api.waitlist.join, { email: "folake@example.com", role: "dietitian" })).toEqual({ alreadyJoined: true, emailed: false, code: first.code });
    await expect(t.mutation(api.waitlist.join, { email: "not-an-email", role: "member" })).rejects.toThrow(/valid email/);
    expect(await t.run((ctx) => ctx.db.query("waitlist").collect())).toHaveLength(1);
  });
});

describe("meal plan portions and preferences", () => {
  it("stores portions with plan slots and saves plan preferences", async () => {
    const t = convexTest(schema, modules);
    const { as } = await signedIn(t, "ada@example.com");
    await as.mutation(api.profile.create, { ...PROFILE, role: "consumer", weightKg: 70 });
    await as.mutation(api.data.replacePlan, { items: [{ date: "2026-10-19", meal: "Lunch", recipeId: "jollof-chicken", portion: 1.5 }] });
    await as.mutation(api.data.setPlanSlot, { date: "2026-10-19", meal: "Dinner", recipeId: "pepper-soup", portion: 0.75 });
    await expect(as.mutation(api.data.setPlanSlot, { date: "2026-10-19", meal: "Dinner", recipeId: "pepper-soup", portion: 9 })).rejects.toThrow(/Portion/);
    const prefs = { cuisines: ["Nigerian" as const], diet: "pescatarian" as const, avoid: ["peanut" as const], budgetPerDay: 3000 };
    await as.mutation(api.settings.updatePlanPrefs, { prefs });
    await expect(as.mutation(api.settings.updatePlanPrefs, { prefs: { ...prefs, budgetPerDay: 10 } })).rejects.toThrow(/budget/);
    const s = (await as.query(api.me.snapshot, {}))!;
    expect(s.plan.map((p) => [p.meal, p.portion])).toEqual(expect.arrayContaining([["Lunch", 1.5], ["Dinner", 0.75]]));
    expect(s.planPrefs).toEqual(prefs);
  });
});

const REMINDERS = {
  push: true,
  whatsapp: true,
  meals: {
    Breakfast: { on: true, time: "07:30" },
    Lunch: { on: true, time: "13:00" },
    Dinner: { on: true, time: "19:00" },
    Snacks: { on: false, time: "16:00" },
  },
  water: { on: false, everyHours: 2, from: "08:00", to: "20:00" },
  weighIn: { on: false, day: 1, time: "07:00" },
  planning: { on: false, day: 0, time: "17:00" },
  appointments: { on: true, minutesBefore: 60 },
  utcOffsetMinutes: 60,
};
const SUB = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", p256dh: "BKey", auth: "authsecret" };

describe("reminders", () => {
  it("validates and saves reminder settings", async () => {
    const t = convexTest(schema, modules);
    const { as } = await signedIn(t, "ada@example.com");
    await expect(as.mutation(api.settings.updateReminders, { reminders: { ...REMINDERS, water: { ...REMINDERS.water, everyHours: 0 } } })).rejects.toThrow(/Water/);
    await as.mutation(api.settings.updateReminders, { reminders: REMINDERS });
    await as.mutation(api.profile.create, { ...PROFILE, role: "consumer", weightKg: 70 });
    expect((await as.query(api.me.snapshot, {}))!.reminders).toEqual(REMINDERS);
  });

  it("keeps one owner per push endpoint", async () => {
    const t = convexTest(schema, modules);
    const a = await signedIn(t, "a@example.com");
    const b = await signedIn(t, "b@example.com");
    await a.as.mutation(api.reminders.savePushSubscription, SUB);
    await b.as.mutation(api.reminders.savePushSubscription, SUB);
    expect((await a.as.query(api.reminders.myChannels, {})).pushEndpoints).toEqual([]);
    expect((await b.as.query(api.reminders.myChannels, {})).pushEndpoints).toEqual([SUB.endpoint]);
    await expect(a.as.mutation(api.reminders.savePushSubscription, { ...SUB, endpoint: "http://insecure" })).rejects.toThrow();
    // Someone else can't remove your subscription.
    await a.as.mutation(api.reminders.removePushSubscription, { endpoint: SUB.endpoint });
    expect((await b.as.query(api.reminders.myChannels, {})).pushEndpoints).toEqual([SUB.endpoint]);
  });

  it("confirms a WhatsApp number with a code before using it", async () => {
    vi.stubEnv("WHATSAPP_TOKEN", "token");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "123");
    const t = convexTest(schema, modules);
    const { as } = await signedIn(t, "ada@example.com");
    await expect(as.mutation(api.reminders.startWhatsApp, { phone: "123" })).rejects.toThrow(/valid phone/);
    expect(await as.mutation(api.reminders.startWhatsApp, { phone: "0803 123 4567" })).toEqual({ phone: "+2348031234567" });
    const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    const code = (jobs.at(-1)!.args[0] as { code: string }).code;
    expect(code).toMatch(/^\d{6}$/);
    expect((await as.query(api.reminders.myChannels, {})).whatsapp).toMatchObject({ verified: false, codePending: true });
    await expect(as.mutation(api.reminders.confirmWhatsApp, { code: code === "000000" ? "111111" : "000000" })).rejects.toThrow(/isn't right/);
    await as.mutation(api.reminders.confirmWhatsApp, { code });
    expect((await as.query(api.reminders.myChannels, {})).whatsapp).toMatchObject({ phone: "+2348031234567", verified: true });
    // Rate limit: 3 codes an hour.
    await as.mutation(api.reminders.startWhatsApp, { phone: "08031234567" });
    await as.mutation(api.reminders.startWhatsApp, { phone: "08031234567" });
    await expect(as.mutation(api.reminders.startWhatsApp, { phone: "08031234567" })).rejects.toThrow(/Too many/);
  });

  it("refuses WhatsApp when the provider isn't configured", async () => {
    const t = convexTest(schema, modules);
    const { as } = await signedIn(t, "ada@example.com");
    expect((await t.query(api.reminders.config, {})).whatsappAvailable).toBe(false);
    await expect(as.mutation(api.reminders.startWhatsApp, { phone: "08031234567" })).rejects.toThrow(/aren't switched on/);
  });

  it("claims due reminders once, with the planned dish", async () => {
    const t = convexTest(schema, modules);
    const { as, userId } = await signedIn(t, "ada@example.com");
    await as.mutation(api.profile.create, { ...PROFILE, role: "consumer", weightKg: 70 });
    await as.mutation(api.settings.updateReminders, { reminders: REMINDERS });
    await as.mutation(api.data.setPlanSlot, { date: "2026-10-20", meal: "Lunch", recipeId: "jollof-chicken", portion: 1.5 });
    const lunch = Date.parse("2026-10-20T12:05:00Z"); // 13:05 in Lagos

    // No channel yet: nothing to deliver, nothing logged.
    expect(await t.mutation(internal.reminders.claimDue, { now: lunch })).toEqual([]);

    await as.mutation(api.reminders.savePushSubscription, SUB);
    const [d] = await t.mutation(internal.reminders.claimDue, { now: lunch });
    expect(d.name).toBe("Adaeze");
    expect(d.push).toEqual([SUB]);
    expect(d.whatsapp).toBeNull();
    expect(d.messages).toEqual([expect.objectContaining({ key: "2026-10-20|meal|Lunch" })]);
    expect(d.messages[0].body).toContain("Jollof rice with grilled chicken (1½ servings)");
    // The next run inside the same window sends nothing.
    expect(await t.mutation(internal.reminders.claimDue, { now: lunch + 5 * 60_000 })).toEqual([]);
    expect(await t.query(internal.reminders.logCount, { userId })).toBe(1);
  });
});

/* ---------- Paid interventions & client tools ---------- */

const INTAKE = { goals: "Lower my blood sugar", conditions: ["diabetes" as const], medications: "Metformin 500 mg", typicalDay: "Bread and tea, rice at lunch", allergies: "", consent: true };

async function dietitian(t: ReturnType<typeof convexTest>, email: string, opts: { verified?: boolean; bio?: boolean } = {}) {
  const d = await signedIn(t, email);
  await d.as.mutation(api.profile.create, { ...PROFILE, name: "Dr Funke", role: "dietitian", weightKg: 65, credential: "LDCN 1234" });
  if (opts.verified !== false) {
    await t.run(async (ctx) => {
      const p = (await ctx.db.query("profiles").collect()).find((row) => row.userId === d.userId);
      await ctx.db.patch(p!._id, { verification: "verified" });
    });
    if (opts.bio !== false) await d.as.mutation(api.clients.saveProfile, { bio: "Diabetes specialist in Lagos.", languages: ["English", "Yoruba"], yearsExperience: 8 });
  }
  return d;
}

/** Dietitian with a diabetes offering, a member enrolled and paid (demo). */
async function paidSetup() {
  vi.stubEnv("PAYMENTS_DEMO", "true");
  const t = convexTest(schema, modules);
  const d = await dietitian(t, "funke@clinic.ng");
  await d.as.mutation(api.clients.saveOffering, { programmeId: "diabetes", priceNaira: 40000, active: true });
  const [offering] = await t.query(api.interventions.catalogue, {});
  const m = await signedIn(t, "ada@example.com");
  await m.as.mutation(api.profile.create, { ...PROFILE, conditions: ["diabetes"], role: "consumer", weightKg: 80 });
  const enrolmentId = await m.as.mutation(api.interventions.enrol, { offeringId: offering.id as Id<"offerings">, intake: INTAKE });
  expect(await m.as.action(api.payments.startPayment, { enrolmentId })).toEqual({ demo: true });
  return { t, d, m, enrolmentId, offeringId: offering.id as Id<"offerings"> };
}

describe("dietitian offerings", () => {
  it("only verified dietitians with a bio can offer programmes, at a price in range", async () => {
    const t = convexTest(schema, modules);
    const pending = await dietitian(t, "new@clinic.ng", { verified: false });
    await expect(pending.as.mutation(api.clients.saveOffering, { programmeId: "diabetes", priceNaira: 40000, active: true })).rejects.toThrow(/verified dietitians/);
    const noBio = await dietitian(t, "nobio@clinic.ng", { bio: false });
    await expect(noBio.as.mutation(api.clients.saveOffering, { programmeId: "diabetes", priceNaira: 40000, active: true })).rejects.toThrow(/bio/);
    const d = await dietitian(t, "funke@clinic.ng");
    await expect(d.as.mutation(api.clients.saveOffering, { programmeId: "diabetes", priceNaira: 999, active: true })).rejects.toThrow(/between/);
    await d.as.mutation(api.clients.saveOffering, { programmeId: "diabetes", priceNaira: 40000, active: true });
    const cat = await t.query(api.interventions.catalogue, {});
    expect(cat).toEqual([expect.objectContaining({ programmeId: "diabetes", priceNaira: 40000, dietitian: expect.objectContaining({ name: "Dr Funke", languages: ["English", "Yoruba"] }) })]);
    await d.as.mutation(api.clients.saveOffering, { programmeId: "diabetes", priceNaira: 40000, active: false });
    expect(await t.query(api.interventions.catalogue, {})).toEqual([]);
  });
});

describe("enrolling and paying", () => {
  it("needs consent, and doesn't activate without a real or demo payment", async () => {
    const t = convexTest(schema, modules);
    const d = await dietitian(t, "funke@clinic.ng");
    await d.as.mutation(api.clients.saveOffering, { programmeId: "diabetes", priceNaira: 40000, active: true });
    const [offering] = await t.query(api.interventions.catalogue, {});
    const m = await signedIn(t, "ada@example.com");
    await m.as.mutation(api.profile.create, { ...PROFILE, role: "consumer", weightKg: 80 });
    const offeringId = offering.id as Id<"offerings">;
    await expect(m.as.mutation(api.interventions.enrol, { offeringId, intake: { ...INTAKE, consent: false } })).rejects.toThrow(/agree/);
    await expect(d.as.mutation(api.interventions.enrol, { offeringId, intake: INTAKE })).rejects.toThrow(/own programme/);
    const enrolmentId = await m.as.mutation(api.interventions.enrol, { offeringId, intake: INTAKE });
    // Enrolling again reuses the unpaid enrolment.
    expect(await m.as.mutation(api.interventions.enrol, { offeringId, intake: INTAKE })).toBe(enrolmentId);
    await expect(m.as.action(api.payments.startPayment, { enrolmentId })).rejects.toThrow(/aren't switched on/);
    expect((await m.as.query(api.interventions.myEnrolments, {}))[0]).toMatchObject({ status: "pending_payment", priceNaira: 40000 });
    // The dietitian can't see unpaid clients.
    expect(await d.as.query(api.clients.myClients, {})).toEqual([]);
    await expect(d.as.query(api.clients.clientDetail, { enrolmentId })).rejects.toThrow(/Not found/);
    await m.as.mutation(api.interventions.cancelPending, { enrolmentId });
    expect(await m.as.query(api.interventions.myEnrolments, {})).toEqual([]);
  });

  it("activates on a correctly signed Paystack webhook with the exact amount, once", async () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_secret");
    const t = convexTest(schema, modules);
    const d = await dietitian(t, "funke@clinic.ng");
    await d.as.mutation(api.clients.saveOffering, { programmeId: "weight-loss", priceNaira: 30000, active: true });
    const [offering] = await t.query(api.interventions.catalogue, {});
    const m = await signedIn(t, "ada@example.com");
    await m.as.mutation(api.profile.create, { ...PROFILE, role: "consumer", weightKg: 80 });
    const enrolmentId = await m.as.mutation(api.interventions.enrol, { offeringId: offering.id as Id<"offerings">, intake: INTAKE });
    await t.mutation(internal.interventions.setPaymentRef, { enrolmentId, reference: "nf_ref1" });

    const send = async (amount: number, secret = "sk_test_secret") => {
      const body = JSON.stringify({ event: "charge.success", data: { reference: "nf_ref1", amount, currency: "NGN", status: "success" } });
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
      const sig = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)))].map((b) => b.toString(16).padStart(2, "0")).join("");
      return t.fetch("/paystack/webhook", { method: "POST", body, headers: { "x-paystack-signature": sig } });
    };
    expect((await send(3_000_000, "wrong")).status).toBe(401);
    expect((await send(100)).status).toBe(200); // underpaid: ignored
    expect((await m.as.query(api.interventions.myEnrolments, {}))[0].status).toBe("pending_payment");
    expect((await send(3_000_000)).status).toBe(200);
    const [e] = await m.as.query(api.interventions.myEnrolments, {});
    expect(e).toMatchObject({ status: "active", demoPayment: false });
    expect(e.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await t.mutation(internal.interventions.markPaid, { reference: "nf_ref1", amountKobo: 3_000_000 })).toBe("already_active");
    // Real payments count towards earnings: ₦30,000 − 20% fee.
    expect((await d.as.query(api.clients.myPractice, {})).earnings).toMatchObject({ grossNaira: 30000, feeNaira: 6000, netNaira: 24000, balanceNaira: 24000, activeClients: 1 });
  });
});

describe("client tools", () => {
  it("gives the dietitian the client's logs, and nobody else", async () => {
    const { t, d, m, enrolmentId } = await paidSetup();
    await m.as.mutation(api.data.addDiaryEntries, { entries: [{ date: "2026-10-20", meal: "Lunch", foodId: "jollof", grams: 280, portionLabel: "4 spoons" }] });
    const [summary] = await d.as.query(api.clients.myClients, {});
    expect(summary).toMatchObject({ enrolmentId, name: "Adaeze", programmeId: "diabetes", status: "active", latestWeightKg: 80 });
    const detail = await d.as.query(api.clients.clientDetail, { enrolmentId });
    expect(detail.intake.medications).toBe("Metformin 500 mg");
    expect(detail.weights).toEqual([expect.objectContaining({ weightKg: 80 })]);

    const other = await dietitian(t, "other@clinic.ng");
    await expect(other.as.query(api.clients.clientDetail, { enrolmentId })).rejects.toThrow(/Not found/);
    await expect(other.as.mutation(api.clients.setTarget, { enrolmentId, target: { kcal: 1800, carbsPercent: 45, proteinPercent: 20, fatPercent: 35, setAt: "" } })).rejects.toThrow(/Not found/);
    await expect(m.as.query(api.clients.clientDetail, { enrolmentId })).rejects.toThrow(/verified dietitians/);
  });

  it("sets the member's target, sends a plan, approves supplements and checks in", async () => {
    const { d, m, enrolmentId } = await paidSetup();
    expect((await m.as.query(api.me.snapshot, {}))!.dietitianTarget).toBeNull();
    await expect(d.as.mutation(api.clients.setTarget, { enrolmentId, target: { kcal: 1800, carbsPercent: 60, proteinPercent: 20, fatPercent: 35, setAt: "" } })).rejects.toThrow(/100%/);
    await d.as.mutation(api.clients.setTarget, { enrolmentId, target: { kcal: 1750, carbsPercent: 45, proteinPercent: 20, fatPercent: 35, note: "Carb-aware", setAt: "" } });
    expect((await m.as.query(api.me.snapshot, {}))!.dietitianTarget).toMatchObject({ kcal: 1750, carbsPercent: 45 });

    await expect(d.as.mutation(api.clients.sendPlan, { enrolmentId, weekStart: "2026-10-19", items: [{ date: "2026-10-30", meal: "Lunch", recipeId: "okra-eba" }] })).rejects.toThrow(/chosen week/);
    await d.as.mutation(api.clients.sendPlan, { enrolmentId, weekStart: "2026-10-19", items: [{ date: "2026-10-19", meal: "Lunch", recipeId: "okra-eba", portion: 1.25 }] });
    const snap = (await m.as.query(api.me.snapshot, {}))!;
    expect(snap.plan).toEqual([expect.objectContaining({ date: "2026-10-19", meal: "Lunch", recipeId: "okra-eba", portion: 1.25 })]);

    await d.as.mutation(api.clients.addAdjunct, { enrolmentId, name: "Folic acid", dose: "400 µg", timing: "Morning", reason: "Planning pregnancy" });
    await d.as.mutation(api.clients.addCheckIn, { enrolmentId, summary: "Good first week", nextSteps: "Swap white bread for oats twice a week", weightKg: 79.4 });
    await d.as.mutation(api.interventions.sendMessage, { enrolmentId, text: "Welcome! Your plan is ready." });
    const [e] = await m.as.query(api.interventions.myEnrolments, {});
    expect(e.adjuncts).toEqual([expect.objectContaining({ name: "Folic acid", approvedBy: "Dr Funke" })]);
    expect(e.checkIns).toEqual([expect.objectContaining({ week: 1, summary: "Good first week", weightKg: 79.4 })]);
    expect(e.planWeekStart).toBe("2026-10-19");
    expect(e.messages).toEqual([expect.objectContaining({ fromMe: false, senderName: "Dr Funke", text: "Welcome! Your plan is ready." })]);
    expect(e.unread).toBe(1);
    await m.as.mutation(api.interventions.markRead, { enrolmentId });
    expect((await m.as.query(api.interventions.myEnrolments, {}))[0].unread).toBe(0);

    await m.as.mutation(api.interventions.sendMessage, { enrolmentId, text: "Thank you!" });
    expect((await d.as.query(api.clients.myClients, {}))[0].unread).toBe(1);
    // Members can't add supplements for themselves.
    await expect(m.as.mutation(api.clients.addAdjunct, { enrolmentId, name: "Anything", dose: "", timing: "", reason: "" })).rejects.toThrow();

    await d.as.mutation(api.clients.completeEnrolment, { enrolmentId });
    await m.as.mutation(api.interventions.endProgramme, { enrolmentId, ended: true });
    expect((await m.as.query(api.me.snapshot, {}))!.dietitianTarget).toBeNull();
    await expect(m.as.mutation(api.interventions.sendMessage, { enrolmentId, text: "Hi" })).rejects.toThrow(/Messages open/);
    // Completed programmes keep the history but no longer share health logs.
    expect((await d.as.query(api.clients.clientDetail, { enrolmentId })).weights).toEqual([]);
  });

  it("doesn't count demo payments as earnings, and admins record payouts up to the balance", async () => {
    const { t, d } = await paidSetup();
    expect((await d.as.query(api.clients.myPractice, {})).earnings).toMatchObject({ grossNaira: 0, activeClients: 1 });
    const admin = await signedIn(t, "admin@kalorax.app");
    await expect(admin.as.mutation(api.clients.recordPayout, { dietitianId: d.userId, amountNaira: 100, reference: "TRF1" })).rejects.toThrow(/balance/);
    await expect(d.as.query(api.clients.payoutsOverview, {})).rejects.toThrow(/Admins only/);
  });

  it("deleting a member's data keeps only the payment record", async () => {
    const { d, m, enrolmentId } = await paidSetup();
    await d.as.mutation(api.interventions.sendMessage, { enrolmentId, text: "Hello" });
    await m.as.mutation(api.data.deleteMyData, {});
    const detail = await d.as.query(api.clients.clientDetail, { enrolmentId });
    expect(detail).toMatchObject({ name: "Deleted member", status: "completed", messages: [] });
    expect(detail.intake.medications).toBe("");
  });
});

describe("member messages", () => {
  async function member(t: ReturnType<typeof convexTest>, email: string, name: string) {
    const m = await signedIn(t, email);
    await m.as.mutation(api.profile.create, { ...PROFILE, name, role: "consumer", weightKg: 70 });
    return m;
  }
  const PLAN = { title: "Week of 20 Oct", items: [{ day: 0, meal: "Breakfast" as const, recipeId: "akara-pap" }, { day: 2, meal: "Dinner" as const, recipeId: "egusi-eba", portion: 1.5 }] };

  it("finds a member by @username and keeps one chat per pair", async () => {
    const t = convexTest(schema, modules);
    const ada = await member(t, "ada@example.com", "Ada");
    const bisi = await member(t, "bisi@example.com", "Bisi");
    const id = await ada.as.mutation(api.social.start, { username: " @Bisi " });
    expect(await bisi.as.mutation(api.social.start, { username: "ada" })).toBe(id);
    await expect(ada.as.mutation(api.social.start, { username: "nobody" })).rejects.toThrow(/no Kalorax member/);
    await expect(ada.as.mutation(api.social.start, { username: "ada" })).rejects.toThrow(/your own username/);
    // Email addresses no longer find anyone.
    await expect(ada.as.mutation(api.social.start, { username: "bisi@example.com" })).rejects.toThrow(/no Kalorax member/);
  });

  it("sends text and a meal plan, counts unread and marks read", async () => {
    const t = convexTest(schema, modules);
    const ada = await member(t, "ada@example.com", "Ada");
    const bisi = await member(t, "bisi@example.com", "Bisi");
    const id = await ada.as.mutation(api.social.start, { username: "bisi" });
    await ada.as.mutation(api.social.send, { conversationId: id, text: "Try my plan!" });
    await ada.as.mutation(api.social.send, { conversationId: id, text: "", plan: PLAN });

    const inbox = (await bisi.as.query(api.social.inbox, {}))!;
    expect(inbox).toMatchObject([{ id, name: "Ada", unread: 2, lastText: "📅 Week of 20 Oct", lastFromMe: false }]);
    const th = await bisi.as.query(api.social.thread, { conversationId: id });
    expect(th.name).toBe("Ada");
    expect(th.messages.map((m) => [m.fromMe, m.text, m.plan?.items.length ?? 0])).toEqual([[false, "Try my plan!", 0], [false, "", 2]]);
    await bisi.as.mutation(api.social.markRead, { conversationId: id });
    expect((await bisi.as.query(api.social.inbox, {}))![0].unread).toBe(0);
    expect((await ada.as.query(api.social.inbox, {}))![0]).toMatchObject({ name: "Bisi", unread: 0, lastFromMe: true });
  });

  it("keeps chats private and checks shared plans", async () => {
    const t = convexTest(schema, modules);
    const ada = await member(t, "ada@example.com", "Ada");
    await member(t, "bisi@example.com", "Bisi");
    const eve = await member(t, "eve@example.com", "Eve");
    const id = await ada.as.mutation(api.social.start, { username: "bisi" });
    await expect(eve.as.query(api.social.thread, { conversationId: id })).rejects.toThrow(/Not found/);
    await expect(eve.as.mutation(api.social.send, { conversationId: id, text: "hi" })).rejects.toThrow(/Not found/);
    await expect(ada.as.mutation(api.social.send, { conversationId: id, text: "", plan: { title: "x", items: [{ day: 7, meal: "Lunch", recipeId: "moimoi" }] } })).rejects.toThrow(/Plan day/);
    await expect(ada.as.mutation(api.social.send, { conversationId: id, text: "x".repeat(2001) })).rejects.toThrow(/too long/);
  });

  it("blocking stops messages both ways until the blocker unblocks", async () => {
    const t = convexTest(schema, modules);
    const ada = await member(t, "ada@example.com", "Ada");
    const bisi = await member(t, "bisi@example.com", "Bisi");
    const id = await ada.as.mutation(api.social.start, { username: "bisi" });
    await bisi.as.mutation(api.social.setBlocked, { conversationId: id, blocked: true });
    await expect(ada.as.mutation(api.social.send, { conversationId: id, text: "hello?" })).rejects.toThrow(/can't send/);
    await expect(bisi.as.mutation(api.social.send, { conversationId: id, text: "hi" })).rejects.toThrow(/can't send/);
    await ada.as.mutation(api.social.setBlocked, { conversationId: id, blocked: false });
    expect((await ada.as.query(api.social.thread, { conversationId: id })).blocked).toBe(true);
    await bisi.as.mutation(api.social.setBlocked, { conversationId: id, blocked: false });
    await ada.as.mutation(api.social.send, { conversationId: id, text: "hello again" });
  });

  it("deleting your data removes your chats for both people", async () => {
    const t = convexTest(schema, modules);
    const ada = await member(t, "ada@example.com", "Ada");
    const bisi = await member(t, "bisi@example.com", "Bisi");
    const id = await ada.as.mutation(api.social.start, { username: "bisi" });
    await ada.as.mutation(api.social.send, { conversationId: id, text: "hi" });
    await ada.as.mutation(api.data.deleteMyData, {});
    expect(await bisi.as.query(api.social.inbox, {})).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("directMessages").collect())).toEqual([]);
  });
});

describe("admin dashboard", () => {
  it("is admin-only", async () => {
    const t = convexTest(schema, modules);
    const { as } = await signedIn(t, "ada@example.com");
    await as.mutation(api.profile.create, { ...PROFILE, role: "consumer", weightKg: 70 });
    await expect(as.query(api.admin.overview, {})).rejects.toThrow(/Admins only/);
    await expect(as.query(api.admin.feed, {})).rejects.toThrow(/Admins only/);
    await expect(as.query(api.admin.people, {})).rejects.toThrow(/Admins only/);
  });

  it("counts people, activity and messages, without message text", async () => {
    const t = convexTest(schema, modules);
    const admin = await signedIn(t, "admin@kalorax.app");
    const ada = await signedIn(t, "ada@example.com");
    const bisi = await signedIn(t, "bisi@example.com");
    await signedIn(t, "half@example.com"); // never finished onboarding
    await ada.as.mutation(api.profile.create, { ...PROFILE, name: "Ada", role: "consumer", weightKg: 70 });
    await bisi.as.mutation(api.profile.create, { ...PROFILE, name: "Bisi", role: "consumer", conditions: ["diabetes"], weightKg: 80 });
    await ada.as.mutation(api.data.addDiaryEntries, { entries: [{ date: "2026-10-19", meal: "Lunch", foodId: "jollof", grams: 300, portionLabel: "1 plate" }] });
    const id = await ada.as.mutation(api.social.start, { username: "bisi" });
    await ada.as.mutation(api.social.send, { conversationId: id, text: "secret hello" });

    const o = await admin.as.query(api.admin.overview, {});
    expect(o.people).toMatchObject({ accounts: 4, profiles: 2, unfinished: 2, members: 2, withConditions: 1, newThisWeek: 4 });
    expect(o.active).toMatchObject({ today: 1, week: 1, month: 1 });
    expect(o.usage30).toMatchObject({ foodLogs: 1, memberMessages: 1, planShares: 0 });
    expect(o.messaging).toEqual({ chats: 1, blockedChats: 0 });
    expect(o.trends.signups).toHaveLength(30);
    expect(o.trends.signups.at(-1)!.count).toBe(4);
    expect(o.trends.activeMembers.at(-1)!.count).toBe(1);

    const feed = await admin.as.query(api.admin.feed, {});
    expect(feed.map((f) => f.kind)).toEqual(expect.arrayContaining(["signup", "profile", "chat"]));
    expect(JSON.stringify(feed)).not.toContain("secret hello");
    expect(JSON.stringify(o)).not.toContain("secret hello");

    const people = await admin.as.query(api.admin.people, { search: "bis" });
    expect(people).toMatchObject([{ email: "bisi@example.com", name: "Bisi", role: "consumer", hasCondition: true, lastActiveAt: null }]);
    const all = await admin.as.query(api.admin.people, {});
    expect(all.find((p) => p.email === "ada@example.com")!.lastActiveAt).not.toBeNull();
    expect(all.find((p) => p.email === "half@example.com")).toMatchObject({ name: null, role: null });
  });
});

describe("admin audit log", () => {
  it("records approvals, rejections and payouts with who did them, and only admins can read it", async () => {
    const t = convexTest(schema, modules);
    const student = await signedIn(t, "tunde@unn.edu.ng");
    const admin = await signedIn(t, "admin@kalorax.app");
    await student.as.mutation(api.profile.create, { ...PROFILE, name: "Tunde", role: "student", weightKg: 72, credential: "UNN 2022/1234" });
    const [req] = await admin.as.query(api.verification.listPending, {});
    await admin.as.mutation(api.verification.review, { id: req._id, decision: "rejected", note: "Matric not found" });
    await student.as.mutation(api.verification.submit, { credential: "UNN 2022/12345" });
    const [again] = await admin.as.query(api.verification.listPending, {});
    await admin.as.mutation(api.verification.review, { id: again._id, decision: "verified" });

    const log = await admin.as.query(api.admin.log, {});
    expect(log.map((l) => [l.action, l.by])).toEqual([
      ["verification_approved", "admin@kalorax.app"],
      ["verification_rejected", "admin@kalorax.app"],
    ]);
    expect(log[1].detail).toBe("Tunde as a student (UNN 2022/1234) · note: Matric not found");
    await expect(student.as.query(api.admin.log, {})).rejects.toThrow(/Admins only/);
  });

  it("logs a payout only when it's recorded", async () => {
    const { t, d, enrolmentId } = await paidSetup();
    // Make the demo enrolment a real payment so the dietitian is owed money.
    await t.run((ctx) => ctx.db.patch(enrolmentId, { demoPayment: undefined }));
    const admin = await signedIn(t, "admin@kalorax.app");
    await expect(admin.as.mutation(api.clients.recordPayout, { dietitianId: d.userId, amountNaira: 10_000_000, reference: "TRF0" })).rejects.toThrow(/balance/);
    await admin.as.mutation(api.clients.recordPayout, { dietitianId: d.userId, amountNaira: 1000, reference: "TRF1" });
    expect(await admin.as.query(api.admin.log, {})).toMatchObject([{ action: "payout_recorded", detail: "₦1,000 to Dr Funke · ref TRF1", by: "admin@kalorax.app" }]);
  });
});

describe("usernames", () => {
  async function member(t: ReturnType<typeof convexTest>, email: string, name: string) {
    const m = await signedIn(t, email);
    await m.as.mutation(api.profile.create, { ...PROFILE, name, role: "consumer", weightKg: 70 });
    return m;
  }
  const usernameOf = async (m: Awaited<ReturnType<typeof member>>) => (await m.as.query(api.me.snapshot, {}))!.profile!.username;

  it("are made from the name, unique, and changeable within the rules", async () => {
    const t = convexTest(schema, modules);
    const a = await member(t, "a@example.com", "Ada Okafor");
    const b = await member(t, "b@example.com", "Ada Okafor");
    const c = await member(t, "c@example.com", "Ọ̀lá 12");
    expect(await usernameOf(a)).toBe("adaokafor");
    expect(await usernameOf(b)).toMatch(/^adaokafor\d+$/);
    expect(await usernameOf(c)).toBe("ola12");

    expect(await a.as.query(api.profile.usernameAvailable, { username: "@DevOlu" })).toBeNull();
    expect(await a.as.query(api.profile.usernameAvailable, { username: (await usernameOf(b))! })).toMatch(/taken/);
    expect(await a.as.query(api.profile.usernameAvailable, { username: "adaokafor" })).toBeNull(); // already mine
    expect(await a.as.query(api.profile.usernameAvailable, { username: "ab" })).toMatch(/3 to 20/);
    expect(await a.as.query(api.profile.usernameAvailable, { username: "1ada" })).toMatch(/Start with a letter/);
    expect(await a.as.query(api.profile.usernameAvailable, { username: "ada..o" })).toMatch(/Dots/);
    expect(await a.as.query(api.profile.usernameAvailable, { username: "ad min" })).toMatch(/only letters/);
    expect(await a.as.query(api.profile.usernameAvailable, { username: "Kalorax" })).toMatch(/reserved/);

    expect(await a.as.mutation(api.profile.setUsername, { username: "@DevOlu" })).toBe("devolu");
    await expect(b.as.mutation(api.profile.setUsername, { username: "devolu" })).rejects.toThrow(/taken/);
    expect(await b.as.query(api.social.findPeople, { q: "@dev" })).toEqual([{ username: "devolu", name: "Ada Okafor", role: "consumer", verified: false }]);
    expect(await b.as.query(api.social.findPeople, { q: "d" })).toEqual([]);
    // You don't find yourself.
    expect(await a.as.query(api.social.findPeople, { q: "dev" })).toEqual([]);
  });

  it("older profiles get one on their next visit", async () => {
    const t = convexTest(schema, modules);
    const a = await member(t, "a@example.com", "Bisi");
    await t.run(async (ctx) => {
      const p = await ctx.db.query("profiles").first();
      await ctx.db.patch(p!._id, { username: undefined });
    });
    expect(await usernameOf(a)).toBeUndefined();
    expect(await a.as.mutation(api.profile.ensureUsername, {})).toBe("bisi");
    expect(await a.as.mutation(api.profile.ensureUsername, {})).toBe("bisi");
  });
});

describe("shared grocery lists", () => {
  async function member(t: ReturnType<typeof convexTest>, email: string, name: string) {
    const m = await signedIn(t, email);
    await m.as.mutation(api.profile.create, { ...PROFILE, name, role: "consumer", weightKg: 70 });
    return m;
  }
  const LIST = {
    title: "Groceries · week of 19 Oct",
    people: 2,
    items: [
      { key: "rice", name: "Rice", category: "Grains", qty: 1.5, unit: "kg", costNaira: 2700 },
      { key: "tomatoes", name: "Tomatoes", category: "Veggies", qty: 1, unit: "kg", costNaira: 2000 },
    ],
  };

  it("sends a list that either person can tick off", async () => {
    const t = convexTest(schema, modules);
    const ada = await member(t, "ada@example.com", "Ada");
    const bisi = await member(t, "bisi@example.com", "Bisi");
    const id = await ada.as.mutation(api.social.start, { username: "bisi" });
    // Items Ada already bought arrive ticked; unknown keys are dropped.
    await ada.as.mutation(api.social.send, { conversationId: id, text: "", grocery: LIST, checked: ["rice", "nonsense"] });
    expect((await bisi.as.query(api.social.inbox, {}))![0].lastText).toBe("🧺 Groceries · week of 19 Oct");

    let msg = (await bisi.as.query(api.social.thread, { conversationId: id })).messages[0];
    expect(msg.grocery!.items).toHaveLength(2);
    expect(msg.checked).toEqual(["rice"]);
    await bisi.as.mutation(api.social.tickGroceryItem, { messageId: msg.id, key: "tomatoes", done: true });
    await ada.as.mutation(api.social.tickGroceryItem, { messageId: msg.id, key: "rice", done: false });
    msg = (await ada.as.query(api.social.thread, { conversationId: id })).messages[0];
    expect(msg.checked).toEqual(["tomatoes"]);
    await expect(bisi.as.mutation(api.social.tickGroceryItem, { messageId: msg.id, key: "bread", done: true })).rejects.toThrow(/Not found/);
  });

  it("keeps lists private, checks them, and stops ticks when blocked", async () => {
    const t = convexTest(schema, modules);
    const ada = await member(t, "ada@example.com", "Ada");
    const bisi = await member(t, "bisi@example.com", "Bisi");
    const eve = await member(t, "eve@example.com", "Eve");
    const id = await ada.as.mutation(api.social.start, { username: "bisi" });
    await ada.as.mutation(api.social.send, { conversationId: id, text: "", grocery: LIST });
    const msg = (await ada.as.query(api.social.thread, { conversationId: id })).messages[0];
    await expect(eve.as.mutation(api.social.tickGroceryItem, { messageId: msg.id, key: "rice", done: true })).rejects.toThrow(/Not found/);
    await expect(ada.as.mutation(api.social.send, { conversationId: id, text: "", grocery: { ...LIST, items: [] } })).rejects.toThrow(/1 to 80/);
    await expect(ada.as.mutation(api.social.send, { conversationId: id, text: "", grocery: { ...LIST, people: 40 } })).rejects.toThrow(/People/);
    await bisi.as.mutation(api.social.setBlocked, { conversationId: id, blocked: true });
    await expect(bisi.as.mutation(api.social.tickGroceryItem, { messageId: msg.id, key: "rice", done: true })).rejects.toThrow(/can't change/);
  });
});

describe("programme chats", () => {
  it("pins running programmes for both sides, and ends only when both confirm", async () => {
    const { t, d, m, enrolmentId } = await paidSetup();
    const [mine] = await m.as.query(api.interventions.programmeChats, {});
    expect(mine).toMatchObject({ id: enrolmentId, role: "member", name: "Dr Funke", unread: 0, endedByMe: false, endedByThem: false });
    expect(mine.programme).toMatch(/Diabetes/i);
    expect(await d.as.query(api.interventions.programmeChats, {})).toEqual([expect.objectContaining({ role: "dietitian", name: "Adaeze" })]);
    const stranger = await signedIn(t, "bob@example.com");
    expect(await stranger.as.query(api.interventions.programmeChats, {})).toEqual([]);
    expect(await stranger.as.query(api.interventions.programmeThread, { enrolmentId })).toBeNull();
    await expect(stranger.as.mutation(api.interventions.endProgramme, { enrolmentId, ended: true })).rejects.toThrow(/Not found/);

    await d.as.mutation(api.interventions.sendMessage, { enrolmentId, text: "Welcome Ada!" });
    expect((await m.as.query(api.interventions.programmeChats, {}))[0]).toMatchObject({ unread: 1, lastText: "Welcome Ada!", lastFromMe: false });

    // The dietitian marks it finished: still running and pinned, with a note in the chat for the member.
    expect(await d.as.mutation(api.clients.completeEnrolment, { enrolmentId })).toBe("waiting");
    let th = (await m.as.query(api.interventions.programmeThread, { enrolmentId }))!;
    expect(th).toMatchObject({ status: "active", endedByMe: false, endedByThem: true });
    expect(th.messages.at(-1)!.text).toMatch(/Please confirm/);
    // The member can keep going instead; the dietitian takes it back.
    expect(await d.as.mutation(api.interventions.endProgramme, { enrolmentId, ended: false })).toBe("active");
    expect((await m.as.query(api.interventions.programmeThread, { enrolmentId }))!.endedByThem).toBe(false);

    expect(await m.as.mutation(api.interventions.endProgramme, { enrolmentId, ended: true })).toBe("waiting");
    expect(await m.as.mutation(api.interventions.endProgramme, { enrolmentId, ended: true })).toBe("waiting");
    expect(await d.as.mutation(api.interventions.endProgramme, { enrolmentId, ended: true })).toBe("completed");
    th = (await m.as.query(api.interventions.programmeThread, { enrolmentId }))!;
    expect(th.status).toBe("completed");
    expect(await m.as.query(api.interventions.programmeChats, {})).toEqual([]);
    expect(await d.as.query(api.interventions.programmeChats, {})).toEqual([]);
    await expect(m.as.mutation(api.interventions.endProgramme, { enrolmentId, ended: true })).rejects.toThrow(/isn't active/);
  });
});

describe("new message alerts", () => {
  async function member(t: ReturnType<typeof convexTest>, email: string, name: string) {
    const m = await signedIn(t, email);
    await m.as.mutation(api.profile.create, { ...PROFILE, name, role: "consumer", weightKg: 70 });
    return m;
  }
  const PUSH = { endpoint: "https://push.example.com/bisi", p256dh: "k".repeat(80), auth: "a".repeat(20) };

  it("pushes the latest unread message to the other person, unless they've read it or switched alerts off", async () => {
    const t = convexTest(schema, modules);
    const ada = await member(t, "ada@example.com", "Ada");
    const bisi = await member(t, "bisi@example.com", "Bisi");
    const chatId = await ada.as.mutation(api.social.start, { username: "bisi" });
    const sentAt = async () => (await ada.as.query(api.social.thread, { conversationId: chatId })).messages.map((m) => Date.parse(m.sentAt));
    const claim = (at: number) => t.mutation(internal.alerts.claimMessageAlert, { kind: "direct", chatId, to: bisi.userId, from: ada.userId, sentAt: at });

    await ada.as.mutation(api.social.send, { conversationId: chatId, text: "Are you coming to the market?" });
    // No device or WhatsApp yet: nothing to send.
    expect(await claim((await sentAt())[0])).toBeNull();

    await bisi.as.mutation(api.reminders.savePushSubscription, PUSH);
    await bisi.as.mutation(api.settings.updateReminders, { reminders: { ...REMINDERS, whatsapp: false } });
    let d = (await claim((await sentAt())[0]))!;
    expect(d.push).toEqual([expect.objectContaining({ endpoint: PUSH.endpoint })]);
    expect(d.messages).toEqual([{ key: `chat-${chatId}`, title: "💬 Ada", body: "Are you coming to the market?", url: `/messages?c=${chatId}` }]);

    // A burst: only the latest message alerts, and it counts the unread ones.
    await new Promise((r) => setTimeout(r, 5));
    await ada.as.mutation(api.social.send, { conversationId: chatId, text: "", plan: { title: "Week", items: [{ day: 0, meal: "Lunch", recipeId: "akara-pap" }] } });
    const [first, second] = await sentAt();
    expect(await claim(first)).toBeNull();
    d = (await claim(second))!;
    expect(d.messages[0].body).toBe("2 new messages · 📅 Sent you a meal plan");

    // Read in the app: no alert.
    await bisi.as.mutation(api.social.markRead, { conversationId: chatId });
    expect(await claim(second)).toBeNull();

    // Switched off.
    await new Promise((r) => setTimeout(r, 5));
    await ada.as.mutation(api.social.send, { conversationId: chatId, text: "Hello?" });
    const third = (await sentAt())[2];
    expect(await claim(third)).not.toBeNull();
    await bisi.as.mutation(api.settings.updateReminders, { reminders: { ...REMINDERS, whatsapp: false, messages: false } });
    expect(await claim(third)).toBeNull();
  });

  it("keeps programme messages off the lock screen", async () => {
    const { t, d, m, enrolmentId } = await paidSetup();
    await m.as.mutation(api.reminders.savePushSubscription, PUSH);
    await m.as.mutation(api.settings.updateReminders, { reminders: { ...REMINDERS, whatsapp: false } });
    await d.as.mutation(api.interventions.sendMessage, { enrolmentId, text: "Your HbA1c result looks better." });
    const [msg] = (await m.as.query(api.interventions.programmeThread, { enrolmentId }))!.messages;
    const alert = (await t.mutation(internal.alerts.claimMessageAlert, { kind: "programme", chatId: enrolmentId, to: m.userId, from: d.userId, sentAt: Date.parse(msg.sentAt) }))!;
    expect(alert.messages[0]).toMatchObject({ title: "🩺 Dr Funke", body: "New message about your programme", url: `/messages?p=${enrolmentId}` });
    expect(JSON.stringify(alert)).not.toContain("HbA1c");
  });
});

describe("dietitian pro", () => {
  afterEach(() => vi.useRealTimers());

  it("is free until payments are switched on", async () => {
    const t = convexTest(schema, modules);
    const d = await dietitian(t, "funke@clinic.ng");
    expect(await d.as.query(api.pro.status, {})).toMatchObject({ live: false, active: true });
    await expect(d.as.action(api.payments.startProPayment, { months: 1 })).rejects.toThrow(/free until/);
    const m = await signedIn(t, "ada@example.com");
    await m.as.mutation(api.profile.create, { ...PROFILE, role: "consumer", weightKg: 70 });
    expect(await m.as.query(api.pro.status, {})).toBeNull();
  });

  it("gives a 30-day trial, then hides lapsed dietitians from new members but keeps their clients", async () => {
    const { t, d, m, enrolmentId } = await paidSetup();
    let s = (await d.as.query(api.pro.status, {}))!;
    expect(s).toMatchObject({ live: true, active: true, onTrial: true, priceNaira: 7500, paidUntil: null });
    expect(s.trialEndsAt).toBeGreaterThanOrEqual(Date.now() + 29 * 86_400_000);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(s.trialEndsAt + 1000);
    s = (await d.as.query(api.pro.status, {}))!;
    expect(s).toMatchObject({ active: false, onTrial: false });
    expect(await t.query(api.interventions.catalogue, {})).toEqual([]);
    // Existing clients are still looked after.
    await d.as.mutation(api.interventions.sendMessage, { enrolmentId, text: "Still here for you." });
    expect((await d.as.query(api.clients.myClients, {})).length).toBe(1);
    await m.as.mutation(api.interventions.sendMessage, { enrolmentId, text: "Thanks!" });

    // Paying 3 months (demo) brings them back for 90 days from today.
    await expect(d.as.action(api.payments.startProPayment, { months: 2 })).rejects.toThrow(/1, 3, 6 or 12/);
    expect(await d.as.action(api.payments.startProPayment, { months: 3 })).toEqual({ demo: true });
    s = (await d.as.query(api.pro.status, {}))!;
    expect(s.active).toBe(true);
    expect(s.paidUntil! - Date.now()).toBeGreaterThan(89 * 86_400_000);
    expect(s.history).toEqual([expect.objectContaining({ months: 3, amountNaira: 22500, demo: true })]);
    expect(await t.query(api.interventions.catalogue, {})).toHaveLength(1);
  });

  it("adds paid months after the trial, and checks the amount Paystack reports", async () => {
    const { t, d } = await paidSetup();
    const trialEndsAt = (await d.as.query(api.pro.status, {}))!.trialEndsAt;
    await d.as.action(api.payments.startProPayment, { months: 1 });
    expect((await d.as.query(api.pro.status, {}))!.paidUntil).toBeGreaterThanOrEqual(trialEndsAt + 30 * 86_400_000);
    await t.mutation(internal.pro.createPending, { userId: d.userId, reference: "np_x", months: 1, amountNaira: 7500 });
    expect(await t.mutation(internal.pro.markPaid, { reference: "np_x", amountKobo: 100 })).toBe("amount_mismatch");
    expect(await t.mutation(internal.pro.markPaid, { reference: "np_x", amountKobo: 750000 })).toBe("activated");
    expect(await t.mutation(internal.pro.markPaid, { reference: "np_x", amountKobo: 750000 })).toBe("already_active");
    expect(await t.mutation(internal.pro.markPaid, { reference: "np_unknown", amountKobo: 750000 })).toBe("unknown");
  });
});

describe("alarm reminders", () => {
  const SECRET = "test-vapid-private-key";
  const MSG = { key: "2026-10-20|meal|Lunch", title: "Lunch time 🍽️", body: "On your plan: Jollof rice.", url: "/plan" };

  it("signs snooze links that can't be edited, replayed past their limit, or used after they expire", async () => {
    const { signSnooze, readSnooze, MAX_SNOOZES } = await import("./snooze");
    const token = await signSnooze(SECRET, { u: "user1", m: MSG, n: 0 });
    expect(await readSnooze(SECRET, token)).toMatchObject({ u: "user1", m: MSG, n: 0 });
    expect(await readSnooze("another-key", token)).toBeNull();
    const [body, sig] = token.split(".");
    const edited = JSON.parse(decodeURIComponent(escape(atob(body.replace(/-/g, "+").replace(/_/g, "/")))));
    edited.u = "someone-else";
    const forged = `${btoa(unescape(encodeURIComponent(JSON.stringify(edited)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.${sig}`;
    expect(await readSnooze(SECRET, forged)).toBeNull();
    expect(await readSnooze(SECRET, token, Date.now() + 13 * 3600_000)).toBeNull();
    expect(await readSnooze(SECRET, await signSnooze(SECRET, { u: "user1", m: MSG, n: MAX_SNOOZES }))).toBeNull();
  });

  it("snoozing schedules the alarm once, and it comes back to the member's devices", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", SECRET);
    const t = convexTest(schema, modules);
    const ada = await signedIn(t, "ada@example.com");
    await ada.as.mutation(api.profile.create, { ...PROFILE, role: "consumer", weightKg: 70 });
    await ada.as.mutation(api.reminders.savePushSubscription, SUB);
    await ada.as.mutation(api.settings.updateReminders, { reminders: { ...REMINDERS, whatsapp: false } });
    const { signSnooze } = await import("./snooze");
    const token = await signSnooze(SECRET, { u: ada.userId, m: MSG, n: 0 });

    expect((await t.fetch("/reminders/snooze", { method: "POST", body: "nonsense" })).status).toBe(400);
    expect((await t.fetch("/reminders/snooze", { method: "POST", body: token })).status).toBe(200);
    expect((await t.fetch("/reminders/snooze", { method: "POST", body: token })).status).toBe(200);
    const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    expect(scheduled.filter((s) => s.name.includes("snoozed"))).toHaveLength(1);
    expect(scheduled.find((s) => s.name.includes("snoozed"))!.args[0]).toMatchObject({ message: { ...MSG, title: "⏰ Lunch time 🍽️" }, snoozes: 1 });

    const d = (await t.mutation(internal.reminders.snoozedDelivery, { userId: ada.userId, message: { ...MSG, title: "⏰ Lunch time 🍽️" }, snoozes: 1 }))!;
    expect(d).toMatchObject({ snoozes: 1, whatsapp: null, messages: [{ ...MSG, title: "⏰ Lunch time 🍽️", priority: true }] });
    expect(d.push).toHaveLength(1);
  });

  it("test alarms need notifications on a device", async () => {
    const t = convexTest(schema, modules);
    const ada = await signedIn(t, "ada@example.com");
    await ada.as.mutation(api.profile.create, { ...PROFILE, role: "consumer", weightKg: 70 });
    await expect(ada.as.mutation(api.reminders.sendTest, { alarm: true })).rejects.toThrow(/this device/);
    await ada.as.mutation(api.reminders.savePushSubscription, SUB);
    await ada.as.mutation(api.reminders.sendTest, { alarm: true });
  });
});

describe("snapshot size", () => {
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

  it("carries recent months (and planned days ahead); older days come from history on request", async () => {
    const t = convexTest(schema, modules);
    const { userId, as } = await signedIn(t, "ada@example.com");
    await as.mutation(api.profile.create, { ...PROFILE, role: "consumer", weightKg: 70 });
    const food = { meal: "Lunch" as const, foodId: "jollof", grams: 300, portionLabel: "1 plate" };
    await t.run(async (ctx) => {
      for (const offset of [0, -100, -200]) await ctx.db.insert("diary", { ...food, userId, date: day(offset), loggedAt: new Date().toISOString() });
      await ctx.db.insert("plan", { userId, date: day(3), meal: "Dinner", recipeId: "jollof-rice" });
      await ctx.db.insert("weights", { userId, date: day(-300), weightKg: 74 });
    });

    const s = (await as.query(api.me.snapshot, {}))!;
    expect(s.historyFrom).toBe(day(-180));
    expect(s.diary.map((d) => d.date).sort()).toEqual([day(-100), day(0)]);
    expect(s.plan.map((p) => p.date)).toEqual([day(3)]);
    // Every weigh-in stays, for the progress chart.
    expect(s.weights).toHaveLength(2);

    const old = (await as.query(api.me.history, { from: day(-210), to: day(-181) }))!;
    expect(old.diary.map((d) => d.date)).toEqual([day(-200)]);
    await expect(as.query(api.me.history, { from: day(-300), to: day(-181) })).rejects.toThrow(/two months/);

    // Only your own rows.
    const other = await signedIn(t, "bob@example.com");
    expect((await other.as.query(api.me.history, { from: day(-210), to: day(-181) }))!.diary).toEqual([]);
    expect(await t.query(api.me.history, { from: day(-210), to: day(-181) })).toBeNull();
  });
});

describe("programme chat size", () => {
  it("shows the newest 200 messages and counts only unread ones from the other side", async () => {
    const { t, d, m, enrolmentId } = await paidSetup();
    const start = Date.now() - 1_000_000;
    await t.run(async (ctx) => {
      for (let i = 0; i < 205; i++) await ctx.db.insert("messages", { enrolmentId, senderId: d.userId, text: `tip ${i}`, sentAt: start + i * 1000 });
    });
    const th = (await m.as.query(api.interventions.programmeThread, { enrolmentId }))!;
    expect(th.messages).toHaveLength(200);
    expect(th.messages[0].text).toBe("tip 5");
    expect(th.messages.at(-1)!.text).toBe("tip 204");

    expect((await m.as.query(api.interventions.programmeChats, {}))[0]).toMatchObject({ unread: 205, lastText: "tip 204", lastFromMe: false });
    await m.as.mutation(api.interventions.markRead, { enrolmentId });
    await m.as.mutation(api.interventions.sendMessage, { enrolmentId, text: "Thank you!" });
    expect((await m.as.query(api.interventions.programmeChats, {}))[0]).toMatchObject({ unread: 0, lastText: "Thank you!", lastFromMe: true });
    // The dietitian's client list counts the member's new message.
    expect((await d.as.query(api.clients.myClients, {}))[0].unread).toBe(1);
  });
});

describe("real-user speed", () => {
  it("stores browser reports and shows admins the 75th percentile", async () => {
    const t = convexTest(schema, modules);
    const reports = [1000, 1500, 2000, 6000].map((value) => ({ metric: "LCP", value, path: "/home", device: "mobile" }));
    expect((await t.fetch("/vitals", { method: "POST", body: JSON.stringify(reports) })).status).toBe(204);
    expect((await t.fetch("/vitals", { method: "POST", body: "nonsense" })).status).toBe(204);
    expect((await t.fetch("/vitals", { method: "POST", body: JSON.stringify([{ metric: "LCP", value: -1 }]) })).status).toBe(204);

    const member = await signedIn(t, "ada@example.com");
    await expect(member.as.query(api.vitals.summary, {})).rejects.toThrow();
    const admin = await signedIn(t, "admin@kalorax.app");
    const s = await admin.as.query(api.vitals.summary, {});
    expect(s.reports).toBe(4);
    expect(s.metrics.find((m) => m.metric === "LCP")).toMatchObject({ count: 4, p75: 2000, p75Mobile: 2000, rating: "good", goodShare: 0.75 });
  });
});

describe("waitlist", () => {
  it("is visible to admins only, and a download is noted in the audit log", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.waitlist.join, { email: "funke@clinic.ng", role: "dietitian" });
    await t.mutation(api.waitlist.join, { email: "ada@example.com", role: "member" });
    const member = await signedIn(t, "bob@example.com");
    await expect(member.as.query(api.waitlist.list, {})).rejects.toThrow(/Admins only/);
    await expect(member.as.mutation(api.waitlist.recordExport, { count: 2 })).rejects.toThrow(/Admins only/);

    const admin = await signedIn(t, "admin@kalorax.app");
    const rows = await admin.as.query(api.waitlist.list, {});
    // In invite order: earliest first.
    expect(rows.map((r) => [r.email, r.role])).toEqual([["funke@clinic.ng", "dietitian"], ["ada@example.com", "member"]]);
    await admin.as.mutation(api.waitlist.recordExport, { count: rows.length });
    expect((await admin.as.query(api.admin.log, {}))[0]).toMatchObject({ action: "waitlist_exported", detail: "Downloaded the waitlist (2 emails) as CSV" });
  });

  it("emails new joiners once (when email is set up), and caps welcome emails per hour", async () => {
    vi.useFakeTimers();
    vi.stubEnv("AUTH_RESEND_KEY", "re_test");
    const sent: Array<{ to: string[]; subject: string; text: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: string }) => {
      sent.push(JSON.parse(init.body));
      return new Response("{}", { status: 200 });
    }));
    try {
      const t = convexTest(schema, modules);
      expect(await t.mutation(api.waitlist.join, { email: "tunde@unn.edu.ng", role: "student" })).toMatchObject({ alreadyJoined: false, emailed: true });
      await t.mutation(api.waitlist.join, { email: "tunde@unn.edu.ng", role: "student" });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({ to: ["tunde@unn.edu.ng"], subject: "You're on the Kalorax waitlist" });
      expect(sent[0].text).toMatch(/student account verified/);

      // 60 more in the same hour: the 61st join of the hour gets no email.
      for (let i = 0; i < 60; i++) await t.mutation(api.waitlist.join, { email: `p${i}@example.com`, role: "member" });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(sent).toHaveLength(60);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});

describe("waitlist referrals", () => {
  it("moves someone into the first invite group once 3 new friends join with their link", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.waitlist.join, { email: "early@example.com", role: "member" });
    const { code } = await t.mutation(api.waitlist.join, { email: "sharer@example.com", role: "member" });
    expect(await t.query(api.waitlist.status, { code })).toMatchObject({ position: 2, total: 2, referrals: 0, goal: 3, boosted: false });

    await t.mutation(api.waitlist.join, { email: "friend1@example.com", role: "member", ref: code });
    await t.mutation(api.waitlist.join, { email: "friend2@example.com", role: "member", ref: code.toUpperCase() });
    // Joining again, or with a bad code, doesn't count.
    await t.mutation(api.waitlist.join, { email: "friend1@example.com", role: "member", ref: code });
    await t.mutation(api.waitlist.join, { email: "stranger@example.com", role: "member", ref: "nope" });
    expect(await t.query(api.waitlist.status, { code })).toMatchObject({ position: 2, referrals: 2, boosted: false });

    await t.mutation(api.waitlist.join, { email: "friend3@example.com", role: "member", ref: code });
    expect(await t.query(api.waitlist.status, { code })).toMatchObject({ position: 1, total: 6, referrals: 3, boosted: true });

    const { as: admin } = await signedIn(t, "admin@kalorax.app");
    const rows = await admin.query(api.waitlist.list, {});
    expect(rows.map((r) => r.email).slice(0, 2)).toEqual(["sharer@example.com", "early@example.com"]);
    expect(rows[0]).toMatchObject({ position: 1, referrals: 3, boosted: true });
  });

  it("only shows a place in line for a real code", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.waitlist.status, { code: "abcdefgh" })).toBeNull();
    expect(await t.query(api.waitlist.status, { code: "<script>" })).toBeNull();
  });
});

describe("regions", () => {
  it("saves where the member eats and lets them change it", async () => {
    const t = convexTest(schema, modules);
    const { as } = await signedIn(t, "ivan@example.com");
    await expect(as.mutation(api.profile.create, { ...PROFILE, region: "atlantis", role: "consumer", weightKg: 80 })).rejects.toThrow(/region/);
    await as.mutation(api.profile.create, { ...PROFILE, region: "russia", role: "consumer", weightKg: 80 });
    expect((await as.query(api.me.snapshot, {}))!.profile).toMatchObject({ region: "russia" });
    await as.mutation(api.profile.update, { region: "uk-europe" });
    expect((await as.query(api.me.snapshot, {}))!.profile).toMatchObject({ region: "uk-europe" });
    await expect(as.mutation(api.profile.update, { region: "mars" })).rejects.toThrow(/region/);
  });

  it("lets meal plans use any cuisine", async () => {
    const t = convexTest(schema, modules);
    const { as } = await signedIn(t, "priya@example.com");
    await as.mutation(api.profile.create, { ...PROFILE, region: "india", role: "consumer", weightKg: 60 });
    await as.mutation(api.settings.updatePlanPrefs, { prefs: { cuisines: ["Indian", "Continental"], diet: "vegetarian", avoid: [], budgetPerDay: null } });
  });
});

describe("challenges and teams", () => {
  const WEEK = "2026-10-05";
  const TODAY = "2026-10-11";
  async function member(t: ReturnType<typeof convexTest>, email: string, name: string) {
    const m = await signedIn(t, email);
    await m.as.mutation(api.profile.create, { ...PROFILE, name, role: "consumer", weightKg: 70 });
    return m;
  }
  type Member = { as: ReturnType<ReturnType<typeof convexTest>["withIdentity"]> };
  /** Boards are cached: ask for a refresh (as the page does), then read. */
  const friendsOf = async (m: Member) => {
    await m.as.mutation(api.challenges.refreshFriends, { weekStart: WEEK, today: TODAY });
    return m.as.query(api.challenges.friends, { weekStart: WEEK, today: TODAY });
  };
  const boardOf = async (m: Member, teamId: Id<"teams">) => {
    await m.as.mutation(api.teams.refreshBoard, { teamId, weekStart: WEEK, today: TODAY });
    return m.as.query(api.teams.board, { teamId, weekStart: WEEK, today: TODAY });
  };
  const logMeals = (m: { as: ReturnType<ReturnType<typeof convexTest>["withIdentity"]> }, dates: string[]) =>
    m.as.mutation(api.data.addDiaryEntries, { entries: dates.flatMap((date) => (["Breakfast", "Lunch", "Dinner"] as const).map((meal) => ({ date, meal, foodId: "jollof", grams: 140, portionLabel: "2 cooking spoons" }))) });

  it("shows friends' weekly points only when both have joined, and never their food", async () => {
    const t = convexTest(schema, modules);
    const ada = await member(t, "ada@example.com", "Ada Obi");
    const bisi = await member(t, "bisi@example.com", "Bisi");
    const chidi = await member(t, "chidi@example.com", "Chidi");
    await ada.as.mutation(api.social.start, { username: "bisi" });
    await ada.as.mutation(api.social.start, { username: "chidi" });
    await logMeals(ada, ["2026-10-05", "2026-10-06"]);
    await logMeals(bisi, ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"]);
    await bisi.as.mutation(api.data.addExercise, { date: "2026-10-07", activityId: "walking", minutes: 160, status: "completed" });

    // Not joined yet: nothing shown.
    expect(await friendsOf(ada)).toEqual({ joined: false, rows: [], friendsCount: null, updatedAt: null });
    await ada.as.mutation(api.challenges.setLeaderboard, { on: true });
    // Friends who haven't joined stay hidden.
    expect((await friendsOf(ada)).rows.map((r) => r.name)).toEqual(["Ada"]);
    await bisi.as.mutation(api.challenges.setLeaderboard, { on: true });
    const board = await friendsOf(ada);
    // Bisi: 5 days x 10 + 3 meals on 5 days (100) + 150 active minutes (100). Ada: 2 days x 10.
    expect(board.rows.map((r) => [r.name, r.points, r.me])).toEqual([["Bisi", 250, false], ["Ada", 20, true]]);
    expect(Object.keys(board.rows[0]).sort()).toEqual(["activeMinutes", "challengesDone", "daysLogged", "me", "name", "points", "username"]);
    expect(board.friendsCount).toBe(2);
    // Chidi isn't Bisi's friend, so Bisi sees only Ada.
    await chidi.as.mutation(api.challenges.setLeaderboard, { on: true });
    expect((await friendsOf(bisi)).rows.map((r) => r.name).sort()).toEqual(["Ada", "Bisi"]);
  });

  it("runs a team: join by code, shared board, owner controls, and leaving", async () => {
    const t = convexTest(schema, modules);
    const boss = await member(t, "boss@acme.ng", "Funmi");
    const staff = await member(t, "staff@acme.ng", "Tayo");
    const outsider = await member(t, "out@example.com", "Kemi");
    const teamId = await boss.as.mutation(api.teams.create, { name: "  Acme   Lagos ", kind: "company" });
    const owner = (await boardOf(boss, teamId))!;
    expect(owner).toMatchObject({ name: "Acme Lagos", owner: true, activeGoal: 150 });
    expect(owner.code).toMatch(/^[a-z2-9]{8}$/);

    await expect(staff.as.mutation(api.teams.join, { code: "wrongcod" })).rejects.toThrow(/doesn't match/);
    expect(await staff.as.mutation(api.teams.join, { code: owner.code!.toUpperCase() })).toBe(teamId);
    await logMeals(staff, ["2026-10-05"]);
    const seen = (await boardOf(staff, teamId))!;
    expect(seen).toMatchObject({ owner: false, code: null, totalPoints: 10, activeGoal: 300 });
    expect(seen.rows.map((r) => r.name)).toEqual(["Tayo", "Funmi"]);
    // Non-members see nothing, and members can't use owner controls.
    expect(await boardOf(outsider, teamId)).toBeNull();
    await expect(staff.as.mutation(api.teams.newTeamCode, { teamId })).rejects.toThrow(/Only the person who created/);
    await expect(staff.as.mutation(api.teams.removeMember, { teamId, userId: boss.userId })).rejects.toThrow(/Only the person who created/);

    // A new code stops the old one working.
    await boss.as.mutation(api.teams.newTeamCode, { teamId });
    await expect(outsider.as.mutation(api.teams.join, { code: owner.code! })).rejects.toThrow(/doesn't match/);

    // The owner leaving hands the team over; the last one out closes it.
    await boss.as.mutation(api.teams.leave, { teamId });
    expect((await boardOf(staff, teamId))!.owner).toBe(true);
    await staff.as.mutation(api.teams.leave, { teamId });
    expect(await t.run((ctx) => ctx.db.get(teamId))).toBeNull();
  });

  it("removes someone from their teams when they delete their data", async () => {
    const t = convexTest(schema, modules);
    const a = await member(t, "a@example.com", "Ada");
    const b = await member(t, "b@example.com", "Bisi");
    const teamId = await a.as.mutation(api.teams.create, { name: "Run club", kind: "club" });
    const { code } = (await boardOf(a, teamId))!;
    await b.as.mutation(api.teams.join, { code: code! });
    await a.as.mutation(api.data.deleteMyData, {});
    const after = (await boardOf(b, teamId))!;
    expect(after.owner).toBe(true);
    expect(after.rows.map((r) => r.name)).toEqual(["Bisi"]);
  });
});

describe("launch protections", () => {
  async function member(t: ReturnType<typeof convexTest>, email = "ada@example.com") {
    const m = await signedIn(t, email);
    await m.as.mutation(api.profile.create, { ...PROFILE, role: "consumer", weightKg: 70 });
    return m;
  }

  it("pauses the AI coach for everyone once the day's spend cap is reached", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    vi.stubEnv("COACH_DAILY_BUDGET_USD", "10");
    const t = convexTest(schema, modules);
    const m = await member(t);
    await m.as.mutation(api.coach.consent, {});
    const { lagosToday } = await import("./interventions");
    await t.run((ctx) => ctx.db.insert("coachDaily", { day: lagosToday(), replies: 400, inputTokens: 0, outputTokens: 0, costUsd: 10.5 }));
    await expect(m.as.mutation(api.coach.send, { text: "hi" })).rejects.toThrow(/taking a break/);
    await expect(m.as.mutation(api.coach.photoUploadUrl, {})).rejects.toThrow(/taking a break/);
  });

  it("limits photo upload links per member per day", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    const t = convexTest(schema, modules);
    const m = await member(t);
    await m.as.mutation(api.coach.consent, {});
    for (let i = 0; i < 30; i++) await m.as.mutation(api.coach.photoUploadUrl, {});
    await expect(m.as.mutation(api.coach.photoUploadUrl, {})).rejects.toThrow(/a lot of photos/);
    // Someone else still can.
    const other = await member(t, "bisi@example.com");
    await other.as.mutation(api.coach.consent, {});
    await other.as.mutation(api.coach.photoUploadUrl, {});
  });

  it("caps reset codes per address", async () => {
    const t = convexTest(schema, modules);
    const take = () => t.mutation(internal.rateLimit.takeInternal, { name: "passwordResetPerEmail", scope: "ada@example.com" });
    expect([await take(), await take(), await take(), await take()]).toEqual([true, true, true, false]);
    expect(await t.mutation(internal.rateLimit.takeInternal, { name: "passwordResetPerEmail", scope: "bisi@example.com" })).toBe(true);
    await expect(t.mutation(internal.rateLimit.takeInternal, { name: "nope", scope: "" })).rejects.toThrow(/Unknown limit/);
  });

  it("works out places in line from join numbers, including entries made before them", async () => {
    const t = convexTest(schema, modules);
    // Two entries from before join numbers existed.
    await t.run(async (ctx) => {
      await ctx.db.insert("waitlist", { email: "old1@example.com", role: "member", createdAt: 1, code: "aaaaaaaa" });
      await ctx.db.insert("waitlist", { email: "old2@example.com", role: "member", createdAt: 2, code: "bbbbbbbb" });
    });
    const { code } = await t.mutation(api.waitlist.join, { email: "new@example.com", role: "member" });
    expect(await t.query(api.waitlist.status, { code })).toMatchObject({ position: 3, total: 3 });
    expect(await t.query(api.waitlist.status, { code: "bbbbbbbb" })).toMatchObject({ position: 2, total: 3 });
    for (const n of [1, 2, 3]) await t.mutation(api.waitlist.join, { email: `f${n}@example.com`, role: "member", ref: code });
    expect(await t.query(api.waitlist.status, { code })).toMatchObject({ position: 1, total: 6, boosted: true });
    expect(await t.query(api.waitlist.status, { code: "aaaaaaaa" })).toMatchObject({ position: 2 });
    expect(await t.query(api.waitlist.status, { code: "bbbbbbbb" })).toMatchObject({ position: 3 });
  });

  it("deletes uploads never attached to anything, after a day", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      const m = await member(t);
      const stray = await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" })));
      const used = await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" })));
      await t.run((ctx) => ctx.db.insert("coachMessages", { userId: m.userId, role: "user", text: "photo", status: "done", createdAt: Date.now(), imageId: used }));
      expect(await t.mutation(internal.storageCleanup.run, {})).toBe(0); // too new
      vi.advanceTimersByTime(30 * 3_600_000);
      expect(await t.mutation(internal.storageCleanup.run, {})).toBe(1);
      expect(await t.run(async (ctx) => (await ctx.storage.get(stray)) === null)).toBe(true);
      expect(await t.run(async (ctx) => (await ctx.storage.get(used)) === null)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("only lets signed-in members check payments", async () => {
    const t = convexTest(schema, modules);
    await expect(t.action(api.payments.verifyPayment, { reference: "nf_000000000000000000000000" })).rejects.toThrow(/sign in/);
    await expect(t.action(api.payments.verifyProPayment, { reference: "np_000000000000000000000000" })).rejects.toThrow(/sign in/);
  });
});

describe("private mode", () => {
  const token = (n: number) => `tok_${String(n).padStart(39, "0")}`; // 43 URL-safe characters
  const signUp = async (t: ReturnType<typeof convexTest>, email: string, inviteToken?: string) => {
    const { createOrUpdateUser } = await import("./auth");
    return t.run((ctx) => createOrUpdateUser(ctx, { existingUserId: null, profile: { email, ...(inviteToken ? { inviteToken } : {}) } }));
  };

  it("only admins can switch it or make invite links, and each change is in the audit log", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.access.status, {})).toEqual({ privateMode: false });
    const member = await signedIn(t, "ada@example.com");
    await expect(member.as.mutation(api.access.setPrivateMode, { on: true })).rejects.toThrow(/Admins only/);
    await expect(member.as.mutation(api.access.createInvite, { token: token(1), label: "Me", role: "member" })).rejects.toThrow(/Admins only/);
    const admin = await signedIn(t, "admin@kalorax.app");
    await admin.as.mutation(api.access.setPrivateMode, { on: true });
    expect(await t.query(api.access.status, {})).toEqual({ privateMode: true });
    await admin.as.mutation(api.access.setPrivateMode, { on: false });
    expect((await admin.as.query(api.admin.log, {})).map((r) => r.action)).toEqual(["private_mode_off", "private_mode_on"]);
    await expect(admin.as.mutation(api.access.createInvite, { token: "short", label: "X", role: "member" })).rejects.toThrow(/Invalid invite token/);
  });

  it("needs an unused, unexpired invite link to create an account: knowing an email isn't enough", async () => {
    const t = convexTest(schema, modules);
    await signUp(t, "early@example.com"); // private mode off: anyone
    const admin = await signedIn(t, "admin@kalorax.app");
    await admin.as.mutation(api.access.setPrivateMode, { on: true });
    await admin.as.mutation(api.access.createInvite, { token: token(1), label: "tester@company.ng", role: "dietitian" });

    // The attack from the security review: an outsider uses the invited person's email, without the link.
    await expect(signUp(t, "tester@company.ng")).rejects.toThrow(/invite-only/);
    await expect(signUp(t, "stranger@example.com", token(2))).rejects.toThrow(/invite-only/);
    await signUp(t, "tester@company.ng", token(1));
    // One use only.
    await expect(signUp(t, "someone@else.com", token(1))).rejects.toThrow(/invite-only/);
    const o = await admin.as.query(api.access.overview, {});
    expect(o.invites).toEqual([expect.objectContaining({ label: "tester@company.ng", role: "dietitian", status: "used", usedByEmail: "tester@company.ng", token: null })]);

    // Expired links stop working.
    await admin.as.mutation(api.access.createInvite, { token: token(3), label: "Late", role: "member" });
    await t.run(async (ctx) => {
      const inv = await ctx.db.query("invites").withIndex("by_token", (q) => q.eq("token", token(3))).unique();
      await ctx.db.patch(inv!._id, { expiresAt: Date.now() - 1 });
    });
    await expect(signUp(t, "late@example.com", token(3))).rejects.toThrow(/invite-only/);
  });

  it("locks out signed-in people without an invite; a link lets an existing account in, and removing it locks them out again", async () => {
    const t = convexTest(schema, modules);
    const ada = await signedIn(t, "ada@example.com");
    await ada.as.mutation(api.profile.create, { ...PROFILE, role: "consumer", weightKg: 70 });
    const admin = await signedIn(t, "admin@kalorax.app");
    await admin.as.mutation(api.access.setPrivateMode, { on: true });

    expect(await ada.as.query(api.me.snapshot, {})).toMatchObject({ locked: true, email: "ada@example.com", profile: null, weights: [] });
    expect(await ada.as.query(api.me.history, { from: "2026-01-01", to: "2026-01-31" })).toBeNull();
    await expect(ada.as.mutation(api.data.addWater, { date: "2026-01-01", ml: 250 })).rejects.toThrow(/invite-only/);
    await expect(ada.as.mutation(api.access.redeem, { token: token(9) })).rejects.toThrow(/isn't valid/);
    expect((await admin.as.query(api.me.snapshot, {}))!.locked).toBe(false);

    await admin.as.mutation(api.access.createInvite, { token: token(4), label: "Ada", role: "member" });
    expect(await ada.as.mutation(api.access.redeem, { token: token(4) })).toBe("joined");
    expect(await ada.as.query(api.me.snapshot, {})).toMatchObject({ locked: false, profile: { name: "Adaeze" } });
    expect(await ada.as.mutation(api.access.redeem, { token: token(4) })).toBe("already");

    const [inv] = (await admin.as.query(api.access.overview, {})).invites;
    await admin.as.mutation(api.access.removeInvite, { id: inv.id });
    expect((await ada.as.query(api.me.snapshot, {}))!.locked).toBe(true);
    expect((await admin.as.query(api.admin.log, {})).map((r) => r.action)).toEqual(["invite_removed", "invite_added", "private_mode_on"]);
  });

  it("locks the admin list: a later account with an ADMIN_EMAILS address isn't an admin until a confirmed admin says so", async () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@kalorax.app, cofounder@kalorax.app");
    const t = convexTest(schema, modules);
    const admin = await signedIn(t, "admin@kalorax.app");
    await admin.as.mutation(api.access.setPrivateMode, { on: true });
    // Someone signs up with the co-founder's address before they do (with a stolen invite link, or after private mode is off).
    await admin.as.mutation(api.access.createInvite, { token: token(5), label: "Visitor", role: "member" });
    const impostorId = await signUp(t, "cofounder@kalorax.app", token(5));
    const impostor = t.withIdentity({ subject: `${impostorId}|${await t.run((ctx) => ctx.db.insert("authSessions", { userId: impostorId, expirationTime: Date.now() + 1e9 }))}` });
    await expect(impostor.query(api.waitlist.list, {})).rejects.toThrow(/Admins only/);
    expect((await impostor.query(api.me.snapshot, {}))!.isAdmin).toBe(false);

    expect((await admin.as.query(api.access.overview, {})).pendingAdmins).toEqual([{ id: impostorId, email: "cofounder@kalorax.app" }]);
    await expect(impostor.mutation(api.access.confirmAdmin, { userId: impostorId })).rejects.toThrow(/Admins only/);
    await admin.as.mutation(api.access.confirmAdmin, { userId: impostorId });
    expect((await impostor.query(api.me.snapshot, {}))!.isAdmin).toBe(true);
    // Turning private mode off keeps the admin list locked.
    await admin.as.mutation(api.access.setPrivateMode, { on: false });
    expect((await admin.as.query(api.access.overview, {})).adminListLocked).toBe(true);
  });
});

describe("AI coach", () => {
  /** A Claude streaming response (server-sent events) with the given content blocks. */
  const sse = (blocks: Array<{ type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown }>, stop: string) => {
    const ev = (type: string, data: object) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
    let body = ev("message_start", { message: { id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1000, output_tokens: 1 } } });
    blocks.forEach((b, index) => {
      if (b.type === "text") {
        body += ev("content_block_start", { index, content_block: { type: "text", text: "" } });
        body += ev("content_block_delta", { index, delta: { type: "text_delta", text: b.text } });
      } else {
        body += ev("content_block_start", { index, content_block: { type: "tool_use", id: b.id, name: b.name, input: {} } });
        body += ev("content_block_delta", { index, delta: { type: "input_json_delta", partial_json: JSON.stringify(b.input) } });
      }
      body += ev("content_block_stop", { index });
    });
    body += ev("message_delta", { delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 200 } });
    body += ev("message_stop", {});
    return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
  };

  async function member(t: ReturnType<typeof convexTest>) {
    const m = await signedIn(t, "ada@example.com");
    await m.as.mutation(api.profile.create, { ...PROFILE, role: "consumer", weightKg: 70 });
    return m;
  }

  it("is off without an API key, and needs consent first", async () => {
    const t = convexTest(schema, modules);
    const m = await member(t);
    expect(await m.as.query(api.coach.thread, {})).toMatchObject({ enabled: false, consented: false });
    await expect(m.as.mutation(api.coach.send, { text: "hi" })).rejects.toThrow(/isn't switched on/);
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    await expect(m.as.mutation(api.coach.send, { text: "hi" })).rejects.toThrow(/agree/);
  });

  it("streams a reply, turns 'I ate…' into a one-tap diary action, and applies it only when tapped", async () => {
    vi.useFakeTimers();
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    const requests: Array<{ model: string; messages: unknown[]; system: Array<{ text: string }> }> = [];
    const replies = [
      sse([{ type: "text", text: "Nice choice!" }, { type: "tool_use", id: "toolu_1", name: "suggest_log_food", input: { food_id: "eba", grams: 250, portion_label: "Medium wrap", meal: "Lunch" } }], "tool_use"),
      sse([{ type: "text", text: "Tap below to add it to your diary." }], "end_turn"),
    ];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: string }) => { requests.push(JSON.parse(init.body)); return replies.shift()!; }));
    try {
      const t = convexTest(schema, modules);
      const m = await member(t);
      await m.as.mutation(api.coach.consent, {});
      await m.as.mutation(api.coach.send, { text: "I had a medium wrap of eba for lunch" });
      await t.finishAllScheduledFunctions(vi.runAllTimers);

      // The model saw the member's context and the message, on the right model.
      expect(requests[0].model).toBe("claude-opus-5-5");
      expect(requests[0].system[1].text).toContain('"name":"Adaeze"');
      const th = (await m.as.query(api.coach.thread, {}))!;
      const reply = th.messages[1];
      expect(reply).toMatchObject({ role: "assistant", status: "done", text: "Nice choice!\n\nTap below to add it to your diary." });
      expect(reply.actions).toEqual([expect.objectContaining({ kind: "log_food", foodId: "eba", grams: 250, meal: "Lunch", state: "pending" })]);
      expect(th.remaining).toBe(14);

      // Nothing was logged until the member taps.
      expect((await m.as.query(api.me.snapshot, {}))!.diary).toHaveLength(0);
      await m.as.mutation(api.coach.applyAction, { messageId: reply.id, actionId: reply.actions[0].id });
      expect((await m.as.query(api.me.snapshot, {}))!.diary).toEqual([expect.objectContaining({ foodId: "eba", grams: 250, meal: "Lunch", portionLabel: "Medium wrap" })]);
      expect(await m.as.mutation(api.coach.applyAction, { messageId: reply.id, actionId: reply.actions[0].id })).toBe("done"); // once only

      // Someone else can't apply it.
      const bob = await signedIn(t, "bob@example.com");
      await expect(bob.as.mutation(api.coach.applyAction, { messageId: reply.id, actionId: reply.actions[0].id })).rejects.toThrow(/Not found/);

      // Admins see usage and cost, not content.
      const admin = await signedIn(t, "admin@kalorax.app");
      const stats = await admin.as.query(api.coach.adminStats, {});
      expect(stats.today.replies).toBe(1);
      expect(stats.today.costUsd).toBeGreaterThan(0);
      expect(JSON.stringify(stats)).not.toContain("eba");
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it("limits members to 15 replies a day; failed replies don't count", async () => {
    vi.useFakeTimers();
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "bad" } }), { status: 400, headers: { "content-type": "application/json" } })));
    try {
      const t = convexTest(schema, modules);
      const m = await member(t);
      await m.as.mutation(api.coach.consent, {});
      await m.as.mutation(api.coach.send, { text: "hello" });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const th = (await m.as.query(api.coach.thread, {}))!;
      expect(th.messages[1]).toMatchObject({ status: "error" });
      expect(th.remaining).toBe(15);

      // 15 successful replies today, then no more.
      await t.run(async (ctx) => {
        const now = Date.now();
        for (let i = 0; i < 15; i++) await ctx.db.insert("coachMessages", { userId: m.userId, role: "assistant", text: "ok", status: "done", createdAt: now + i });
      });
      await expect(m.as.mutation(api.coach.send, { text: "one more" })).rejects.toThrow(/today's 15/);
      expect((await m.as.query(api.coach.thread, {}))!.remaining).toBe(0);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it("reads a food photo: breakdown card, one-tap log of the whole meal, and the photo is deleted with the chat", async () => {
    vi.useFakeTimers();
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    const requests: Array<{ messages: Array<{ role: string; content: unknown }>; tools: Array<{ name: string }> }> = [];
    const photoMeal = {
      dish: "Jollof rice with chicken and plantain", confidence: "medium", meal: "Lunch",
      items: [{ name: "Jollof rice", amount: "2 cooking spoons (140 g)", kcal: 224 }, { name: "Fried chicken", amount: "1 piece (100 g)", kcal: 260 }, { name: "Dodo", amount: "5 pieces", kcal: 173 }],
      kcal: 657, carbs_g: 72, protein_g: 27, fat_g: 29, note: "Oil in the rice can add 100 kcal.",
    };
    const replies = [
      sse([{ type: "tool_use", id: "toolu_p", name: "report_photo_meal", input: photoMeal }], "tool_use"),
      sse([{ type: "text", text: "That looks like jollof with chicken and dodo, about 657 kcal." }], "end_turn"),
    ];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: string }) => { requests.push(JSON.parse(init.body)); return replies.shift()!; }));
    try {
      const t = convexTest(schema, modules);
      const m = await member(t);
      await m.as.mutation(api.coach.consent, {});
      const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9])], { type: "image/jpeg" });
      const imageId = await t.run((ctx) => ctx.storage.store(jpeg));
      await m.as.mutation(api.coach.send, { text: "", imageId });
      await expect(m.as.mutation(api.coach.send, { text: "again", imageId })).rejects.toThrow(/still replying|already sent/);
      await t.finishAllScheduledFunctions(vi.runAllTimers);

      // The model got the photo as an image, plus the photo tool.
      const first = requests[0].messages.at(-1)!;
      expect(first.role).toBe("user");
      expect(first.content).toEqual([
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9)) } },
        { type: "text", text: "What's in this meal? Give me the ingredients and calories." },
      ]);
      expect(requests[0].tools.map((x) => x.name)).toContain("report_photo_meal");

      const th = (await m.as.query(api.coach.thread, {}))!;
      expect(th.messages[0].imageUrl).toBeTruthy();
      const reply = th.messages[1];
      expect(reply.analysis).toMatchObject({ dish: "Jollof rice with chicken and plantain", kcal: 657, carbs: 72, protein: 27, fat: 29, confidence: "medium" });
      expect(reply.analysis!.items).toHaveLength(3);
      expect(reply.actions).toEqual([expect.objectContaining({ kind: "log_food", kcal: 657, meal: "Lunch", grams: 100 })]);

      // One tap logs the whole meal, and it counts towards the day like any food.
      await m.as.mutation(api.coach.applyAction, { messageId: reply.id, actionId: reply.actions[0].id });
      const entry = (await m.as.query(api.me.snapshot, {}))!.diary[0];
      const { foodById, nutrientsFor } = await import("../src/data/foods");
      const food = foodById(entry.foodId)!;
      expect(food.name).toBe("Jollof rice with chicken and plantain");
      expect(Math.round(nutrientsFor(food, entry.grams).kcal)).toBe(657);

      // Clearing the chat deletes the photo too.
      await m.as.mutation(api.coach.clear, {});
      expect(await t.run(async (ctx) => (await ctx.storage.get(imageId)) === null)).toBe(true);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it("refuses files that aren't photos, by their actual bytes", async () => {
    vi.useFakeTimers();
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    try {
      const t = convexTest(schema, modules);
      const m = await member(t);
      await m.as.mutation(api.coach.consent, {});
      await expect(m.as.mutation(api.coach.send, { text: "" })).rejects.toThrow(/Type a message/);
      const pdf = await t.run((ctx) => ctx.storage.store(new Blob(["%PDF-1.4 not a photo"], { type: "application/pdf" })));
      await m.as.mutation(api.coach.send, { text: "", imageId: pdf });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(fetchMock).not.toHaveBeenCalled();
      const th = (await m.as.query(api.coach.thread, {}))!;
      expect(th.messages[1]).toMatchObject({ status: "error", text: expect.stringMatching(/couldn't open that photo/) });
      expect(th.remaining).toBe(15);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it("deleting my data removes the coach chat", async () => {
    const t = convexTest(schema, modules);
    const m = await member(t);
    await t.run((ctx) => ctx.db.insert("coachMessages", { userId: m.userId, role: "user", text: "hi", status: "done", createdAt: Date.now() }));
    await m.as.mutation(api.data.deleteMyData, {});
    expect(await t.run((ctx) => ctx.db.query("coachMessages").collect())).toEqual([]);
  });
});

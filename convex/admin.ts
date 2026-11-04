// Admin dashboard: what's happening across Kalorax. Admins only (ADMIN_EMAILS).
// Counts and trends, never message text or anyone's food log: admins see activity, not private health details.
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { requireAdmin } from "./helpers";

const DAY = 86_400_000;
/** Days are counted in Nigeria time (WAT, UTC+1). */
const WAT = 3_600_000;
export const dayOf = (ms: number) => new Date(ms + WAT).toISOString().slice(0, 10);

/** One count per day for the last `days` days, oldest first. */
export function perDay(times: number[], days: number, now: number): Array<{ date: string; count: number }> {
  const out = Array.from({ length: days }, (_, i) => ({ date: dayOf(now - (days - 1 - i) * DAY), count: 0 }));
  const index = new Map(out.map((d, i) => [d.date, i]));
  for (const t of times) {
    const i = index.get(dayOf(t));
    if (i !== undefined) out[i].count++;
  }
  return out;
}

/** Distinct people per day (e.g. members who logged food that day). */
function peoplePerDay(rows: Array<{ userId: Id<"users">; at: number }>, days: number, now: number) {
  const sets = new Map<string, Set<string>>();
  for (const r of rows) {
    const d = dayOf(r.at);
    if (!sets.has(d)) sets.set(d, new Set());
    sets.get(d)!.add(r.userId);
  }
  return perDay([], days, now).map((d) => ({ date: d.date, count: sets.get(d.date)?.size ?? 0 }));
}


const isPaid = (e: Doc<"enrolments">) => !!e.paidAt && !e.demoPayment;

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const d30 = now - 30 * DAY;
    const d7 = now - 7 * DAY;

    const [users, profiles, diary30, plans30, exercises30, dms30, dietMsgs30, reminders7, conversations, enrolments, pendingVerifs, waitlist, pushSubs, whatsapp, payouts] =
      await Promise.all([
        ctx.db.query("users").collect(),
        ctx.db.query("profiles").collect(),
        ctx.db.query("diary").withIndex("by_creation_time", (q) => q.gt("_creationTime", d30)).collect(),
        ctx.db.query("plan").withIndex("by_creation_time", (q) => q.gt("_creationTime", d30)).collect(),
        ctx.db.query("exercises").withIndex("by_creation_time", (q) => q.gt("_creationTime", d30)).collect(),
        ctx.db.query("directMessages").withIndex("by_creation_time", (q) => q.gt("_creationTime", d30)).collect(),
        ctx.db.query("messages").withIndex("by_creation_time", (q) => q.gt("_creationTime", d30)).collect(),
        ctx.db.query("reminderLog").withIndex("by_creation_time", (q) => q.gt("_creationTime", d7)).collect(),
        ctx.db.query("conversations").collect(),
        ctx.db.query("enrolments").collect(),
        ctx.db.query("verifications").withIndex("by_status", (q) => q.eq("status", "pending")).collect(),
        ctx.db.query("waitlist").collect(),
        ctx.db.query("pushSubscriptions").collect(),
        ctx.db.query("whatsapp").collect(),
        ctx.db.query("payouts").collect(),
      ]);

    // Anyone who did something (logged food, planned, exercised, messaged) counts as active that day.
    const activity = [
      ...diary30.map((r) => ({ userId: r.userId, at: r._creationTime })),
      ...plans30.map((r) => ({ userId: r.userId, at: r._creationTime })),
      ...exercises30.map((r) => ({ userId: r.userId, at: r._creationTime })),
      ...dms30.map((r) => ({ userId: r.senderId, at: r.sentAt })),
      ...dietMsgs30.map((r) => ({ userId: r.senderId, at: r.sentAt })),
    ];
    const activeSince = (from: number) => new Set(activity.filter((a) => a.at > from).map((a) => a.userId)).size;

    const roleCount = (role: Doc<"profiles">["role"]) => profiles.filter((p) => p.role === role).length;
    const paid = enrolments.filter(isPaid);
    const gross = paid.reduce((t, e) => t + e.priceNaira, 0);
    const fees = paid.reduce((t, e) => t + e.feeNaira, 0);
    const paidOut = payouts.reduce((t, p) => t + p.amountNaira, 0);
    const status = (s: Doc<"enrolments">["status"]) => enrolments.filter((e) => e.status === s).length;

    return {
      generatedAt: new Date(now).toISOString(),
      people: {
        accounts: users.length,
        profiles: profiles.length,
        /** Signed up but never finished onboarding. */
        unfinished: users.length - profiles.length,
        members: roleCount("consumer"),
        students: roleCount("student"),
        dietitians: roleCount("dietitian"),
        verifiedPros: profiles.filter((p) => p.role !== "consumer" && p.verification === "verified").length,
        withConditions: profiles.filter((p) => p.conditions.length > 0).length,
        newThisWeek: users.filter((u) => u._creationTime > d7).length,
      },
      active: { today: activeSince(now - DAY), week: activeSince(d7), month: activeSince(d30) },
      trends: {
        signups: perDay(users.map((u) => u._creationTime), 30, now),
        activeMembers: peoplePerDay(activity, 30, now),
      },
      usage30: {
        foodLogs: diary30.length,
        plannedMeals: plans30.length,
        workouts: exercises30.length,
        memberMessages: dms30.length,
        dietitianMessages: dietMsgs30.length,
        planShares: dms30.filter((m) => m.plan).length,
      },
      messaging: {
        chats: conversations.length,
        blockedChats: conversations.filter((c) => c.blockedBy).length,
      },
      reminders: {
        pushDevices: pushSubs.length,
        whatsappConfirmed: whatsapp.filter((w) => w.verifiedAt).length,
        sentThisWeek: reminders7.length,
      },
      programmes: {
        pendingPayment: status("pending_payment"),
        active: status("active"),
        completed: status("completed"),
        cancelled: status("cancelled"),
        demo: enrolments.filter((e) => e.demoPayment).length,
        grossNaira: gross,
        feesNaira: fees,
        owedToDietitiansNaira: gross - fees - paidOut,
      },
      queue: {
        pendingVerifications: pendingVerifs.length,
        waitlist: waitlist.length,
      },
    };
  },
});

type FeedItem = { at: number; kind: "signup" | "profile" | "verification" | "enrolment" | "payment" | "payout" | "waitlist" | "chat"; text: string };

/** The latest things that happened, newest first. Names only; no health details or message text. */
export const feed = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    await requireAdmin(ctx);
    const n = Math.min(Math.max(limit ?? 40, 1), 100);
    const latest = <T extends "profiles" | "verifications" | "enrolments" | "payouts" | "waitlist" | "conversations" | "users">(table: T) =>
      ctx.db.query(table).order("desc").take(n);
    const [users, profiles, verifs, enrolments, payouts, waitlist, chats] = await Promise.all([
      latest("users"), latest("profiles"), latest("verifications"), latest("enrolments"), latest("payouts"), latest("waitlist"), latest("conversations"),
    ]);
    const names = new Map<string, string>();
    const nameOf = async (id: Id<"users">) => {
      if (!names.has(id)) {
        const p = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", id)).unique();
        names.set(id, p?.name ?? "A member");
      }
      return names.get(id)!;
    };
    const items: FeedItem[] = [];
    for (const u of users) items.push({ at: u._creationTime, kind: "signup", text: `New account: ${u.email ?? "no email"}` });
    for (const p of profiles) items.push({ at: p.createdAt, kind: "profile", text: `${p.name} finished setting up as a ${p.role === "consumer" ? "member" : p.role}` });
    for (const r of verifs) {
      const who = await nameOf(r.userId);
      items.push({ at: r.submittedAt, kind: "verification", text: `${who} asked to be verified as a ${r.role}` });
      if (r.reviewedAt) items.push({ at: r.reviewedAt, kind: "verification", text: `${who} was ${r.status === "verified" ? "verified" : "not verified"}` });
    }
    for (const e of enrolments) {
      const [member, dietitian] = await Promise.all([nameOf(e.memberId), nameOf(e.dietitianId)]);
      items.push({ at: e.createdAt, kind: "enrolment", text: `${member} enrolled with ${dietitian} (${e.programmeId})` });
      if (e.paidAt) items.push({ at: e.paidAt, kind: "payment", text: `${e.demoPayment ? "Demo payment" : `₦${e.priceNaira.toLocaleString("en-NG")} paid`} by ${member}` });
    }
    for (const p of payouts) items.push({ at: p.paidAt, kind: "payout", text: `₦${p.amountNaira.toLocaleString("en-NG")} paid out to ${await nameOf(p.dietitianId)}` });
    for (const w of waitlist) items.push({ at: w.createdAt, kind: "waitlist", text: `${w.email} joined the waitlist (${w.role})` });
    for (const c of chats) items.push({ at: c._creationTime, kind: "chat", text: `${await nameOf(c.a)} and ${await nameOf(c.b)} started a chat` });
    return items
      .sort((a, b) => b.at - a.at)
      .slice(0, n)
      .map((i) => ({ ...i, at: new Date(i.at).toISOString() }));
  },
});

/** Everyone with an account: who they are, when they joined and when they were last active. */
export const people = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, { search }) => {
    await requireAdmin(ctx);
    const q = (search ?? "").trim().toLowerCase();
    const [users, profiles] = await Promise.all([ctx.db.query("users").order("desc").collect(), ctx.db.query("profiles").collect()]);
    const byUser = new Map(profiles.map((p) => [p.userId as string, p]));
    const rows = users
      .map((u) => ({ u, p: byUser.get(u._id) ?? null }))
      .filter(({ u, p }) => !q || (u.email ?? "").toLowerCase().includes(q) || (p?.name ?? "").toLowerCase().includes(q) || (p?.username ?? "").includes(q.replace(/^@/, "")))
      .slice(0, 200);
    return Promise.all(
      rows.map(async ({ u, p }) => {
        const [lastLog, lastPlan] = await Promise.all([
          ctx.db.query("diary").withIndex("by_user_date", (x) => x.eq("userId", u._id)).order("desc").first(),
          ctx.db.query("plan").withIndex("by_user_date_meal", (x) => x.eq("userId", u._id)).order("desc").first(),
        ]);
        const last = Math.max(lastLog?._creationTime ?? 0, lastPlan?._creationTime ?? 0);
        return {
          id: u._id,
          email: u.email ?? null,
          name: p?.name ?? null,
          username: p?.username ?? null,
          role: p?.role ?? null,
          verification: p?.verification ?? null,
          hasCondition: !!p && p.conditions.length > 0,
          joinedAt: new Date(u._creationTime).toISOString(),
          lastActiveAt: last ? new Date(last).toISOString() : null,
        };
      }),
    );
  },
});

/** The audit log: every admin action, newest first, with who did it. */
export const log = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("adminLog").order("desc").take(200);
    const emails = new Map<string, string>();
    for (const id of new Set(rows.map((r) => r.adminId))) emails.set(id, (await ctx.db.get(id))?.email ?? "deleted account");
    return rows.map((r) => ({ id: r._id, action: r.action, detail: r.detail, by: emails.get(r.adminId)!, at: new Date(r.at).toISOString() }));
  },
});

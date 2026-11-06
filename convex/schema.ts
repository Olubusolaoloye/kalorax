import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  dietitianTarget,
  diaryFields,
  enrolmentStatus,
  eventFields,
  exerciseFields,
  intake,
  isoDate,
  meal,
  noteFields,
  noteSlot,
  planPrefs,
  photoAnalysis,
  profileFields,
  reminderSettings,
  sharedGrocery,
  sharedPlan,
  role,
  verification,
} from "./validators";

export default defineSchema({
  // users, sessions, accounts… managed by Convex Auth.
  ...authTables,

  profiles: defineTable({
    userId: v.id("users"),
    ...profileFields,
    role,
    /** Only changed by the server: on submission (pending) and by admins (verified/rejected). */
    verification,
    createdAt: v.number(),
    /** Public handle, lowercase without the @ (e.g. "devolu"). Unique. Older profiles get one on their next visit. */
    username: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_username", ["username"]),

  verifications: defineTable({
    userId: v.id("users"),
    role: v.union(v.literal("student"), v.literal("dietitian")),
    credential: v.string(),
    documentId: v.optional(v.id("_storage")),
    status: v.union(v.literal("pending"), v.literal("verified"), v.literal("rejected")),
    submittedAt: v.number(),
    reviewedAt: v.optional(v.number()),
    reviewerNote: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_document", ["documentId"]),

  diary: defineTable({ userId: v.id("users"), ...diaryFields }).index("by_user_date", ["userId", "date"]),

  water: defineTable({ userId: v.id("users"), date: isoDate, ml: v.number() }).index("by_user_date", ["userId", "date"]),

  weights: defineTable({ userId: v.id("users"), date: isoDate, weightKg: v.number() }).index("by_user_date", ["userId", "date"]),

  notes: defineTable({ userId: v.id("users"), date: isoDate, slot: noteSlot, ...noteFields, updatedAt: v.string() }).index(
    "by_user_date_slot",
    ["userId", "date", "slot"],
  ),

  plan: defineTable({ userId: v.id("users"), date: isoDate, meal, recipeId: v.string(), portion: v.optional(v.number()) }).index("by_user_date_meal", [
    "userId",
    "date",
    "meal",
  ]),

  grocery: defineTable({
    userId: v.id("users"),
    people: v.number(),
    purchased: v.record(v.string(), v.boolean()),
    qtyOverride: v.record(v.string(), v.number()),
  }).index("by_user", ["userId"]),

  events: defineTable({ userId: v.id("users"), ...eventFields }).index("by_user_date", ["userId", "date"]),

  exercises: defineTable({ userId: v.id("users"), ...exerciseFields }).index("by_user_date", ["userId", "date"]),

  /** Per-user preferences: meal-plan preferences and reminder settings. */
  settings: defineTable({
    userId: v.id("users"),
    planPrefs: v.optional(planPrefs),
    reminders: v.optional(reminderSettings),
    /** When the member agreed to share their logs with the AI coach. */
    coachConsentAt: v.optional(v.number()),
    /** On: friends (people they chat with) see their weekly challenge points. Off unless they join. */
    leaderboard: v.optional(v.boolean()),
    /** True when they turned off beta emails (Me page). */
    betaEmailsOff: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),

  /** A company, gym or club doing weekly challenges together. People join with the team's code. */
  teams: defineTable({
    name: v.string(),
    kind: v.union(v.literal("company"), v.literal("gym"), v.literal("club")),
    /** Join code, 8 characters. The owner can change it to stop the old one working. */
    code: v.string(),
    ownerId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_owner", ["ownerId"]),

  /** Joining a team shares your weekly challenge points (never your food or weight) with its members. */
  teamMembers: defineTable({
    teamId: v.id("teams"),
    userId: v.id("users"),
    joinedAt: v.number(),
  })
    .index("by_team", ["teamId"])
    .index("by_user", ["userId"])
    .index("by_team_user", ["teamId", "userId"]),

  /** Chat with the Kalorax AI coach. Assistant replies stream in (status "streaming") and may carry one-tap actions. */
  coachMessages: defineTable({
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    text: v.string(),
    status: v.union(v.literal("streaming"), v.literal("done"), v.literal("error")),
    /** Suggestions the member can apply in one tap (the coach never changes data by itself). */
    actions: v.optional(
      v.array(
        v.object({
          id: v.string(),
          kind: v.union(v.literal("log_food"), v.literal("plan_meal")),
          label: v.string(),
          date: v.string(),
          meal: v.union(v.literal("Breakfast"), v.literal("Lunch"), v.literal("Dinner"), v.literal("Snacks")),
          kcal: v.number(),
          foodId: v.optional(v.string()),
          grams: v.optional(v.number()),
          portionLabel: v.optional(v.string()),
          recipeId: v.optional(v.string()),
          portion: v.optional(v.number()),
          state: v.union(v.literal("pending"), v.literal("done"), v.literal("dismissed")),
        }),
      ),
    ),
    /** A food photo the member sent (theirs only; deleted with the chat). */
    imageId: v.optional(v.id("_storage")),
    /** The coach's breakdown of a food photo: the dish, its ingredients and estimated nutrition. */
    analysis: v.optional(photoAnalysis),
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_image", ["imageId"]),

  /** AI coach usage per Lagos day, across everyone, for the admin overview (no message content). */
  coachDaily: defineTable({
    day: v.string(),
    replies: v.number(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    costUsd: v.number(),
  }).index("by_day", ["day"]),

  /** Web push subscriptions, one per device/browser. */
  pushSubscriptions: defineTable({
    userId: v.id("users"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_endpoint", ["endpoint"]),

  /** WhatsApp number for reminders. Only used once the member has confirmed it with a code. */
  whatsapp: defineTable({
    userId: v.id("users"),
    phone: v.string(),
    verifiedAt: v.optional(v.number()),
    codeHash: v.optional(v.string()),
    codeExpiresAt: v.optional(v.number()),
    attempts: v.number(),
    /** When codes were sent (for rate limiting). */
    codesSentAt: v.array(v.number()),
  }).index("by_user", ["userId"]),

  /** Reminders already sent, so each one goes out once. Old rows are cleaned up by the cron. */
  reminderLog: defineTable({ userId: v.id("users"), key: v.string(), sentAt: v.number() })
    .index("by_user_key", ["userId", "key"])
    .index("by_sentAt", ["sentAt"]),

  /* ---------- Paid interventions ---------- */

  /** A dietitian's public profile and payout details (payout details are never shown to members). */
  dietitianProfiles: defineTable({
    userId: v.id("users"),
    bio: v.string(),
    languages: v.array(v.string()),
    yearsExperience: v.number(),
    payout: v.optional(v.object({ bankName: v.string(), accountNumber: v.string(), accountName: v.string() })),
  }).index("by_user", ["userId"]),

  /** A programme a dietitian offers, at their price. */
  offerings: defineTable({
    dietitianId: v.id("users"),
    programmeId: v.string(),
    priceNaira: v.number(),
    active: v.boolean(),
  })
    .index("by_dietitian", ["dietitianId"])
    .index("by_active", ["active"]),

  /** Dietitian Pro payments (see pro.ts). A paid row covers [start, periodEnd). */
  proPayments: defineTable({
    userId: v.id("users"),
    reference: v.string(),
    months: v.number(),
    amountNaira: v.number(),
    status: v.union(v.literal("pending"), v.literal("paid")),
    createdAt: v.number(),
    paidAt: v.optional(v.number()),
    periodEnd: v.optional(v.number()),
    /** Simulated (PAYMENTS_DEMO). */
    demo: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_reference", ["reference"]),

  /** A member's place on a programme with one dietitian. Price and fee are fixed when they enrol. */
  enrolments: defineTable({
    memberId: v.id("users"),
    dietitianId: v.id("users"),
    offeringId: v.id("offerings"),
    programmeId: v.string(),
    priceNaira: v.number(),
    feeNaira: v.number(),
    status: enrolmentStatus,
    intake,
    createdAt: v.number(),
    paymentRef: v.optional(v.string()),
    paidAt: v.optional(v.number()),
    /** Set to true when the payment was simulated (PAYMENTS_DEMO). */
    demoPayment: v.optional(v.boolean()),
    startDate: v.optional(isoDate),
    target: v.optional(dietitianTarget),
    planWeekStart: v.optional(isoDate),
    memberReadAt: v.optional(v.number()),
    dietitianReadAt: v.optional(v.number()),
    /** Ending takes both sides: each one's confirmation time; it completes when both are set. */
    memberEndedAt: v.optional(v.number()),
    dietitianEndedAt: v.optional(v.number()),
    /** The member deleted their data; the row stays as a payment record only. */
    memberDeleted: v.optional(v.boolean()),
  })
    .index("by_member", ["memberId"])
    .index("by_dietitian", ["dietitianId"])
    .index("by_paymentRef", ["paymentRef"]),

  /** Supplements and adjuncts — only ever added by the member's dietitian. */
  adjuncts: defineTable({
    enrolmentId: v.id("enrolments"),
    name: v.string(),
    dose: v.string(),
    timing: v.string(),
    reason: v.string(),
    approvedBy: v.id("users"),
    approvedAt: v.number(),
  }).index("by_enrolment", ["enrolmentId"]),

  checkIns: defineTable({
    enrolmentId: v.id("enrolments"),
    week: v.number(),
    summary: v.string(),
    nextSteps: v.string(),
    weightKg: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_enrolment", ["enrolmentId"]),

  /** Real visitors' page speed (Core Web Vitals), sent by the browser. No account or personal details. */
  vitals: defineTable({
    metric: v.union(v.literal("LCP"), v.literal("INP"), v.literal("CLS"), v.literal("FCP"), v.literal("TTFB")),
    value: v.number(),
    rating: v.union(v.literal("good"), v.literal("needs-improvement"), v.literal("poor")),
    /** The page, with ids replaced by ":id" (e.g. "/clients/:id"). */
    path: v.string(),
    device: v.union(v.literal("mobile"), v.literal("desktop")),
    at: v.number(),
  }).index("by_at", ["at"]),

  messages: defineTable({
    enrolmentId: v.id("enrolments"),
    senderId: v.id("users"),
    text: v.string(),
    sentAt: v.number(),
  })
    .index("by_enrolment", ["enrolmentId"])
    // Newest message and unread messages without reading the whole chat.
    .index("by_enrolment_sent", ["enrolmentId", "sentAt"]),

  /** Member-to-member chats. a < b (by id) so each pair has one conversation. */
  conversations: defineTable({
    a: v.id("users"),
    b: v.id("users"),
    lastMessageAt: v.number(),
    aReadAt: v.number(),
    bReadAt: v.number(),
    /** Set when one side blocks the other: no new messages either way. */
    blockedBy: v.optional(v.id("users")),
  })
    .index("by_pair", ["a", "b"])
    .index("by_a", ["a", "lastMessageAt"])
    .index("by_b", ["b", "lastMessageAt"]),

  directMessages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    text: v.string(),
    plan: v.optional(sharedPlan),
    grocery: v.optional(sharedGrocery),
    /** Keys of grocery items ticked off (by either person). */
    checked: v.optional(v.array(v.string())),
    sentAt: v.number(),
  }).index("by_conversation", ["conversationId", "sentAt"]),

  /** Every admin action (approvals, rejections, payouts): who did what, to whom, and when. Never edited or deleted by the app. */
  adminLog: defineTable({
    adminId: v.id("users"),
    action: v.union(v.literal("verification_approved"), v.literal("verification_rejected"), v.literal("payout_recorded"), v.literal("waitlist_exported"),
      v.literal("private_mode_on"), v.literal("private_mode_off"), v.literal("invite_added"), v.literal("invite_removed"),
      v.literal("admin_confirmed"), v.literal("beta_email_started")),
    subjectId: v.optional(v.id("users")),
    detail: v.string(),
    at: v.number(),
  }),

  /** Payouts to dietitians, recorded by admins after a bank transfer. */
  payouts: defineTable({
    dietitianId: v.id("users"),
    amountNaira: v.number(),
    reference: v.string(),
    paidAt: v.number(),
    recordedBy: v.id("users"),
  }).index("by_dietitian", ["dietitianId"]),

  /** App-wide switches set by admins. One row per key; "access" holds private mode. */
  appConfig: defineTable({
    key: v.literal("access"),
    /** On: only confirmed admins and people with an invite link can sign up or use the app; the public sees the waitlist. */
    privateMode: v.boolean(),
    /**
     * Confirmed admin accounts. Unset until private mode is first turned on, when the existing ADMIN_EMAILS
     * accounts are confirmed; after that, a new ADMIN_EMAILS account is an admin only once a confirmed admin
     * confirms it (sign-ups aren't email-verified, so the email alone isn't proof).
     */
    adminIds: v.optional(v.array(v.id("users"))),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  /**
   * One-time invite links for private mode (/join/<token>). The token is the secret; the label is for the
   * admin's reference only. Using it ties the invite to the account; removing it takes access away.
   */
  invites: defineTable({
    token: v.string(),
    label: v.string(),
    role: v.union(v.literal("member"), v.literal("student"), v.literal("dietitian")),
    invitedBy: v.id("users"),
    createdAt: v.number(),
    expiresAt: v.number(),
    usedBy: v.optional(v.id("users")),
    usedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_used_by", ["usedBy"]),

  /** Feedback from testers (Me → Send feedback). Only admins read it. */
  feedback: defineTable({ userId: v.id("users"), text: v.string(), createdAt: v.number() }).index("by_created", ["createdAt"]).index("by_user", ["userId"]),

  /** One row per account per one-off email (e.g. the beta welcome), so nobody gets it twice. */
  emailLog: defineTable({
    userId: v.id("users"),
    kind: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed")),
    emailId: v.optional(v.string()),
    sentAt: v.number(),
  })
    .index("by_user_kind", ["userId", "kind"])
    .index("by_kind", ["kind"]),

  /** Rate-limit windows (see rateLimit.ts). */
  rateLimits: defineTable({ key: v.string(), windowStart: v.number(), count: v.number() })
    .index("by_key", ["key"])
    .index("by_window", ["windowStart"]),

  /** Cached leaderboards, rebuilt at most every few minutes instead of on every log (see challenges.ts). */
  boardCache: defineTable({ key: v.string(), computedAt: v.number(), data: v.any() }).index("by_key", ["key"]),

  /** Running totals, e.g. the waitlist's join counter that gives each entry its place in line. */
  counters: defineTable({ name: v.string(), value: v.number() }).index("by_name", ["name"]),

  waitlist: defineTable({
    email: v.string(),
    role: v.union(v.literal("member"), v.literal("student"), v.literal("dietitian")),
    createdAt: v.number(),
    /** Private referral code for their share link (/?ref=CODE). Older entries get one when they come back. */
    code: v.optional(v.string()),
    /** The entry whose link they joined with. */
    referredBy: v.optional(v.id("waitlist")),
    /** How many new people joined with their link. */
    referrals: v.optional(v.number()),
    /** When they reached the referral goal: from then on they're in the first invite group. */
    boostedAt: v.optional(v.number()),
    /** Join order (1, 2, 3…), so a place in line is worked out without reading the whole list. */
    seq: v.optional(v.number()),
    /** Secret in the welcome email's confirm link. A referral only counts once the friend confirms. */
    confirmToken: v.optional(v.string()),
    confirmedAt: v.optional(v.number()),
    /** Set once this entry's referrer has been credited for it (so it's never counted twice). */
    referralCredited: v.optional(v.boolean()),
  })
    .index("by_email", ["email"])
    .index("by_code", ["code"])
    .index("by_boosted", ["boostedAt"])
    .index("by_confirm_token", ["confirmToken"]),
});

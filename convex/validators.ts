// Shared validators so the schema, mutations and import stay in step with the app's types.
import { v } from "convex/values";

export const role = v.union(v.literal("consumer"), v.literal("student"), v.literal("dietitian"));
export const verification = v.union(v.literal("none"), v.literal("pending"), v.literal("verified"), v.literal("rejected"));
export const sex = v.union(v.literal("female"), v.literal("male"));
export const activity = v.union(v.literal("sedentary"), v.literal("light"), v.literal("moderate"), v.literal("vigorous"));
export const goal = v.union(v.literal("lose"), v.literal("maintain"), v.literal("gain"), v.literal("eat_healthier"));
export const condition = v.union(
  v.literal("diabetes"),
  v.literal("hypertension"),
  v.literal("kidney_disease"),
  v.literal("pregnant"),
  v.literal("breastfeeding"),
);
export const meal = v.union(v.literal("Breakfast"), v.literal("Lunch"), v.literal("Dinner"), v.literal("Snacks"));
export const noteSlot = v.union(meal, v.literal("Day"));
export const eventType = v.union(v.literal("meal"), v.literal("activity"), v.literal("appointment"));
export const exerciseStatus = v.union(v.literal("completed"), v.literal("planned"), v.literal("skipped"));
/** YYYY-MM-DD */
export const isoDate = v.string();

export const profileFields = {
  name: v.string(),
  sex,
  birthDate: isoDate,
  heightCm: v.number(),
  activity,
  goal,
  conditions: v.array(condition),
  /** Where the member eats (see src/data/regions.ts). Missing on profiles made before regions: treated as Nigeria. */
  region: v.optional(v.string()),
};

export const diaryFields = {
  date: isoDate,
  meal,
  foodId: v.string(),
  grams: v.number(),
  portionLabel: v.string(),
  loggedAt: v.optional(v.string()),
};

export const noteFields = {
  feeling: v.optional(v.number()),
  tags: v.array(v.string()),
  text: v.string(),
};

export const eventFields = {
  date: isoDate,
  time: v.string(),
  type: eventType,
  title: v.string(),
  location: v.optional(v.string()),
  note: v.optional(v.string()),
};

export const exerciseFields = {
  date: isoDate,
  activityId: v.string(),
  minutes: v.number(),
  sets: v.optional(v.number()),
  reps: v.optional(v.number()),
  status: exerciseStatus,
};

const cuisine = v.union(
  v.literal("Nigerian"), v.literal("Ghanaian"), v.literal("East African"), v.literal("South African"), v.literal("Continental"),
  v.literal("Caribbean"), v.literal("Russian"), v.literal("Indian"), v.literal("Chinese"), v.literal("International"),
);
const allergen = v.union(v.literal("egg"), v.literal("dairy"), v.literal("peanut"), v.literal("fish"), v.literal("shellfish"), v.literal("gluten"));

/** Mirrors PlanPrefs in src/lib/planner.ts. */
export const planPrefs = v.object({
  cuisines: v.array(cuisine),
  diet: v.union(v.literal("any"), v.literal("pescatarian"), v.literal("vegetarian")),
  avoid: v.array(allergen),
  budgetPerDay: v.union(v.number(), v.null()),
});

const timed = v.object({ on: v.boolean(), time: v.string() });
const weekly = v.object({ on: v.boolean(), day: v.number(), time: v.string() });

/** Mirrors ReminderSettings in src/lib/reminders.ts. */
export const reminderSettings = v.object({
  push: v.boolean(),
  whatsapp: v.boolean(),
  meals: v.object({ Breakfast: timed, Lunch: timed, Dinner: timed, Snacks: timed }),
  water: v.object({ on: v.boolean(), everyHours: v.number(), from: v.string(), to: v.string() }),
  weighIn: weekly,
  planning: weekly,
  appointments: v.object({ on: v.boolean(), minutesBefore: v.number() }),
  /** New chat messages (on unless switched off). */
  messages: v.optional(v.boolean()),
  /** Reminder types sent as alarms. */
  alarms: v.optional(v.object({
    meals: v.optional(v.boolean()),
    water: v.optional(v.boolean()),
    weighIn: v.optional(v.boolean()),
    planning: v.optional(v.boolean()),
    appointments: v.optional(v.boolean()),
  })),
  utcOffsetMinutes: v.number(),
});

/** Mirrors Intake in src/lib/interventions.ts. */
export const intake = v.object({
  goals: v.string(),
  conditions: v.array(condition),
  medications: v.string(),
  typicalDay: v.string(),
  allergies: v.string(),
  consent: v.boolean(),
});

/** Mirrors DietitianTarget in src/lib/interventions.ts. */
export const dietitianTarget = v.object({
  kcal: v.number(),
  carbsPercent: v.number(),
  proteinPercent: v.number(),
  fatPercent: v.number(),
  note: v.optional(v.string()),
  setAt: v.string(),
});

export const enrolmentStatus = v.union(v.literal("pending_payment"), v.literal("active"), v.literal("completed"), v.literal("cancelled"));

/** A week of the meal plan sent in a message: day 0 is Monday. Recipe ids refer to the app's recipe list. */
export const sharedPlan = v.object({
  title: v.string(),
  items: v.array(v.object({ day: v.number(), meal, recipeId: v.string(), portion: v.optional(v.number()) })),
});

/** A week's grocery list sent in a message. Either person in the chat can tick items off. */
export const sharedGrocery = v.object({
  title: v.string(),
  people: v.number(),
  items: v.array(v.object({ key: v.string(), name: v.string(), category: v.string(), qty: v.number(), unit: v.string(), costNaira: v.number() })),
});

/** The AI coach's estimate for a food photo. Mirrors PhotoAnalysis in convex/coachTools.ts. */
export const photoAnalysis = v.object({
  dish: v.string(),
  confidence: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  items: v.array(v.object({ name: v.string(), amount: v.string(), kcal: v.number() })),
  kcal: v.number(),
  carbs: v.number(),
  protein: v.number(),
  fat: v.number(),
  note: v.optional(v.string()),
});

// Paid interventions: the programmes dietitians can offer. Prices are set by each dietitian within
// the range here (Nigeria, to test — see KALORAX_STRATEGY.md §6). Descriptions are SAMPLE copy.
import type { Condition } from "../lib/nutrition";

export interface Programme {
  id: string;
  name: string;
  emoji: string;
  /** 0 = one-off consultation. */
  weeks: number;
  /** Conditions this programme is designed for (used to suggest it). */
  forConditions: Condition[];
  summary: string;
  includes: string[];
  minPrice: number;
  maxPrice: number;
  suggestedPrice: number;
}

export const PROGRAMMES: Programme[] = [
  {
    id: "consult", name: "One-off consultation", emoji: "💬", weeks: 0, forConditions: [],
    summary: "A single session to review your eating, set a safe daily target and get a starter plan.",
    includes: ["Intake review", "Personal daily target", "One week meal plan", "Chat for 7 days"],
    minPrice: 5000, maxPrice: 20000, suggestedPrice: 10000,
  },
  {
    id: "diabetes", name: "Diabetes control", emoji: "🩸", weeks: 12, forConditions: ["diabetes"],
    summary: "Steadier blood sugar with Nigerian foods you already eat: portions, swallow swaps and timing.",
    includes: ["Carb-aware target set by your dietitian", "Weekly plans with local dishes", "Weekly check-ins", "Supplements reviewed by your dietitian"],
    minPrice: 25000, maxPrice: 60000, suggestedPrice: 40000,
  },
  {
    id: "hypertension", name: "Blood pressure (DASH, localised)", emoji: "❤️", weeks: 8, forConditions: ["hypertension"],
    summary: "Less salt and seasoning cubes, more potassium-rich local foods, built into your weekly menu.",
    includes: ["Lower-salt targets", "Weekly plans", "Weekly check-ins", "Label reading for seasoning and stock"],
    minPrice: 20000, maxPrice: 45000, suggestedPrice: 30000,
  },
  {
    id: "weight-loss", name: "Weight loss", emoji: "⚖️", weeks: 12, forConditions: [],
    summary: "Sustainable weight loss without giving up jollof: a safe deficit, real portions and habits that last.",
    includes: ["Target set by your dietitian", "Weekly plans and swaps", "Weekly weigh-in review", "Chat support"],
    minPrice: 20000, maxPrice: 50000, suggestedPrice: 30000,
  },
  {
    id: "pcos", name: "PCOS nutrition", emoji: "🌸", weeks: 12, forConditions: [],
    summary: "Eating for hormone balance and insulin sensitivity, with plans that fit your cycle and routine.",
    includes: ["Personal target", "Low-GI weekly plans", "Weekly check-ins", "Supplements reviewed by your dietitian"],
    minPrice: 25000, maxPrice: 55000, suggestedPrice: 35000,
  },
  {
    id: "kidney", name: "Kidney-friendly eating (CKD)", emoji: "🫘", weeks: 12, forConditions: ["kidney_disease"],
    summary: "Protein, potassium, phosphorus and fluid set for your stage, working alongside your doctor.",
    includes: ["Stage-specific targets", "Weekly plans", "Fortnightly check-ins", "Lab result review"],
    minPrice: 30000, maxPrice: 60000, suggestedPrice: 45000,
  },
  {
    id: "pregnancy", name: "Pregnancy nutrition", emoji: "🤰", weeks: 12, forConditions: ["pregnant", "breastfeeding"],
    summary: "Healthy weight gain, iron and folate from local foods, and what to avoid — trimester by trimester.",
    includes: ["Trimester targets", "Weekly plans", "Weekly check-ins", "Supplements reviewed by your dietitian"],
    minPrice: 20000, maxPrice: 45000, suggestedPrice: 30000,
  },
  {
    id: "child-growth", name: "Child catch-up growth", emoji: "🧒", weeks: 8, forConditions: [],
    summary: "Affordable, energy-dense family meals to help a child under 5 grow, with regular growth reviews.",
    includes: ["Growth review", "Family meal plans", "Weekly check-ins", "Feeding tips for caregivers"],
    minPrice: 10000, maxPrice: 30000, suggestedPrice: 15000,
  },
  {
    id: "sports", name: "Sports nutrition", emoji: "🏃", weeks: 8, forConditions: [],
    summary: "Fuel training and recovery: timing, protein and hydration around your sessions.",
    includes: ["Training-day and rest-day targets", "Weekly plans", "Weekly check-ins"],
    minPrice: 20000, maxPrice: 50000, suggestedPrice: 30000,
  },
];

export const programmeById = (id: string) => PROGRAMMES.find((p) => p.id === id);

/** Kalorax's share of each payment, in percent (strategy: 15–30%). */
export const PLATFORM_FEE_PERCENT = 20;

export const LANGUAGES = ["English", "Pidgin", "Yoruba", "Igbo", "Hausa"];

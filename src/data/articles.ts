// SAMPLE CONTENT for the prototype. Real articles are written or reviewed by Kalorax's dietitians.
export type ArticleScope = "Global" | "Nigeria" | "Prevention";

export interface Article {
  id: string;
  scope: ArticleScope;
  topic: string;
  emoji: string;
  title: string;
  summary: string;
  body: string[];
  tags: string[];
  readMinutes: number;
  /** ISO date the article was published. */
  published: string;
  featured?: boolean;
  source: string;
}

const SOURCE = "Sample content – Kalorax editorial (to be dietitian-reviewed)";

export const ARTICLES: Article[] = [
  {
    id: "swallow-portions", scope: "Nigeria", topic: "Healthy plates", emoji: "🫓", featured: true,
    title: "Enjoy your swallow — just mind the wrap size",
    summary: "Eba, amala and pounded yam can fit a healthy diet. Portion size and what you pair them with matter most.",
    body: [
      "Swallows are mostly starch, which gives you energy. A fist-sized wrap is a sensible portion for most adults at one meal.",
      "Fill more of your bowl with vegetable-rich soups like efo riro, okra or egusi with plenty of greens, and add a palm-sized piece of fish, meat or a serving of beans.",
      "Try this plate: about half vegetables and soup, a quarter swallow, a quarter protein. You still get the meal you love, with more fibre and less overeating.",
    ],
    tags: ["Portions", "Swallow", "Balanced plate"], readMinutes: 3, published: "2026-10-12", source: SOURCE,
  },
  {
    id: "water-sachets", scope: "Prevention", topic: "Hydration", emoji: "💧", featured: true,
    title: "Hot weather? Keep your water sachets coming",
    summary: "Simple ways to stay hydrated through the day, at work, at school or on the road.",
    body: [
      "Thirst, dark urine, tiredness and headaches can be signs you need more fluid — especially in hot weather or after activity.",
      "Keep a sachet or bottle within reach and drink regularly through the day, not only with meals.",
      "Choose water over sugary drinks most of the time. Soft drinks, sweetened zobo and juice drinks can carry a lot of sugar.",
    ],
    tags: ["Hydration", "Heat", "Everyday habits"], readMinutes: 2, published: "2026-10-10", source: SOURCE,
  },
  {
    id: "salt-bp", scope: "Global", topic: "Heart health", emoji: "🧂",
    title: "Less salt, healthier blood pressure",
    summary: "Seasoning cubes and added salt add up quickly. Small swaps make a real difference.",
    body: [
      "Eating less salt is one of the simplest ways to protect your heart and blood pressure.",
      "Use fewer seasoning cubes, taste before adding salt, and build flavour with onions, peppers, ginger, garlic and local spices.",
      "If you have high blood pressure, ask a dietitian for a plan that keeps your favourite meals on the menu.",
    ],
    tags: ["Salt", "Blood pressure", "Heart health"], readMinutes: 3, published: "2026-10-08", source: SOURCE,
  },
  {
    id: "fruit-veg", scope: "Prevention", topic: "Fruit & veg", emoji: "🥬",
    title: "Add colour to every meal",
    summary: "Local fruits and vegetables are affordable ways to get vitamins, minerals and fibre.",
    body: [
      "Garden egg, ugu, waterleaf, carrots, oranges, pawpaw and watermelon are easy local choices.",
      "Aim to include a vegetable or fruit at every meal and snack — add greens to soups and stews, and keep fruit for snacks.",
      "Buying what's in season is usually cheaper and fresher.",
    ],
    tags: ["Vegetables", "Fruit", "Fibre"], readMinutes: 2, published: "2026-10-05", source: SOURCE,
  },
  {
    id: "iron-foods", scope: "Nigeria", topic: "Nutrients", emoji: "🥩",
    title: "Iron-rich foods you already know",
    summary: "Beans, leafy greens, fish and lean meat help you get the iron your body needs.",
    body: [
      "Iron helps carry oxygen around your body. Low iron can leave you tired and weak, and it's a common concern for women and children.",
      "Good sources include lean meat, fish, beans, and dark leafy vegetables like ugu and spinach.",
      "Pair plant sources with vitamin C-rich foods such as oranges or tomatoes to help your body absorb more iron. If you're pregnant or think you may be low in iron, speak to a health worker.",
    ],
    tags: ["Iron", "Nutrients", "Women's health"], readMinutes: 3, published: "2026-10-02", source: SOURCE,
  },
  {
    id: "eating-out", scope: "Global", topic: "Eating out", emoji: "🍽️",
    title: "Eating out without going off track",
    summary: "Shawarma, pizza or buka — a few simple choices keep your meal balanced.",
    body: [
      "Go for grilled over fried where you can, and ask for sauces on the side.",
      "Add a side of vegetables or salad, and choose water instead of a soft drink.",
      "Share a large portion, or save half for later. Logging it in Kalorax afterwards helps you see the bigger picture of your week.",
    ],
    tags: ["Eating out", "Fast food", "Portions"], readMinutes: 3, published: "2026-09-29", source: SOURCE,
  },
  {
    id: "breakfast-ideas", scope: "Nigeria", topic: "Meal ideas", emoji: "🍳",
    title: "Five quick breakfasts that keep you full",
    summary: "Moi moi, eggs, oats and more: breakfasts with protein and fibre to power your morning.",
    body: [
      "Moi moi with pap, boiled eggs with wholemeal bread, oats with banana, akara with a cup of tea, or yoghurt with fruit.",
      "Including some protein at breakfast can help you stay full until lunch.",
      "Prepare ahead: steam moi moi in batches and freeze portions for busy mornings.",
    ],
    tags: ["Breakfast", "Meal prep", "Protein"], readMinutes: 2, published: "2026-09-25", source: SOURCE,
  },
  {
    id: "food-labels", scope: "Global", topic: "Shopping", emoji: "🏷️",
    title: "How to read a food label in 30 seconds",
    summary: "Check the serving size, then sugar, salt and fat — and compare products side by side.",
    body: [
      "Start with the serving size: all the numbers on the label refer to it, and it's often smaller than what you actually eat.",
      "Compare sugar, salt (sodium) and saturated fat between similar products and pick the lower one.",
      "Ingredients are listed from most to least. If sugar is near the top, it's a sweet product.",
    ],
    tags: ["Labels", "Shopping", "Sugar"], readMinutes: 3, published: "2026-09-20", source: SOURCE,
  },
];

export function relatedArticles(a: Article, limit = 3): Article[] {
  return ARTICLES.filter((x) => x.id !== a.id)
    .map((x) => ({ x, score: x.tags.filter((t) => a.tags.includes(t)).length + (x.scope === a.scope ? 0.5 : 0) }))
    .sort((p, q) => q.score - p.score)
    .slice(0, limit)
    .map((p) => p.x);
}

export function trendingTags(): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const a of ARTICLES) for (const t of a.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

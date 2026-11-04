// SAMPLE RECIPES — placeholder nutrition and ₦ price estimates for the prototype, NOT for clinical use.
// Recipes and values will be written and reviewed by Kalorax's dietitians.
import type { Meal } from "../state/store";
import type { Cuisine } from "./foods";

export type GroceryCategory = "Grains" | "Protein" | "Veggies" | "Fruits" | "Dairy" | "Oils & spices" | "Others";
export const GROCERY_CATEGORIES: GroceryCategory[] = ["Grains", "Protein", "Veggies", "Fruits", "Dairy", "Oils & spices", "Others"];

/** Shopping catalogue: unit and an estimated price per unit in Naira (sample values, not live market prices). */
export const INGREDIENTS = {
  rice: { name: "Rice", category: "Grains", unit: "kg", priceNaira: 1800 },
  garri: { name: "Garri", category: "Grains", unit: "kg", priceNaira: 1200 },
  oats: { name: "Rolled oats", category: "Grains", unit: "kg", priceNaira: 4500 },
  spaghetti: { name: "Spaghetti", category: "Grains", unit: "pack", priceNaira: 1100 },
  pita: { name: "Pita / shawarma bread", category: "Grains", unit: "piece", priceNaira: 400 },
  beans: { name: "Beans (oloyin)", category: "Protein", unit: "kg", priceNaira: 2200 },
  chicken: { name: "Chicken", category: "Protein", unit: "kg", priceNaira: 5500 },
  beef: { name: "Beef", category: "Protein", unit: "kg", priceNaira: 7000 },
  salmon: { name: "Salmon / mackerel fillet", category: "Protein", unit: "kg", priceNaira: 9000 },
  eggs: { name: "Eggs", category: "Protein", unit: "piece", priceNaira: 200 },
  crayfish: { name: "Ground crayfish", category: "Protein", unit: "cup", priceNaira: 1500 },
  egusi: { name: "Egusi (ground melon)", category: "Protein", unit: "cup", priceNaira: 1200 },
  groundnuts: { name: "Groundnuts", category: "Protein", unit: "cup", priceNaira: 600 },
  tomatoes: { name: "Tomatoes", category: "Veggies", unit: "kg", priceNaira: 2000 },
  peppers: { name: "Tatashe & rodo peppers", category: "Veggies", unit: "kg", priceNaira: 2500 },
  onions: { name: "Onions", category: "Veggies", unit: "piece", priceNaira: 150 },
  spinach: { name: "Spinach / ugu", category: "Veggies", unit: "bunch", priceNaira: 500 },
  cabbage: { name: "Cabbage", category: "Veggies", unit: "piece", priceNaira: 800 },
  carrots: { name: "Carrots", category: "Veggies", unit: "kg", priceNaira: 1500 },
  plantain: { name: "Ripe plantain", category: "Fruits", unit: "piece", priceNaira: 400 },
  banana: { name: "Banana", category: "Fruits", unit: "piece", priceNaira: 100 },
  berries: { name: "Mixed berries / fruit", category: "Fruits", unit: "cup", priceNaira: 1500 },
  pawpaw: { name: "Pawpaw", category: "Fruits", unit: "piece", priceNaira: 900 },
  watermelon: { name: "Watermelon", category: "Fruits", unit: "piece", priceNaira: 1500 },
  milk: { name: "Milk", category: "Dairy", unit: "litre", priceNaira: 2500 },
  yoghurt: { name: "Greek / plain yoghurt", category: "Dairy", unit: "cup", priceNaira: 1200 },
  palmOil: { name: "Palm oil", category: "Oils & spices", unit: "cup", priceNaira: 900 },
  vegOil: { name: "Vegetable oil", category: "Oils & spices", unit: "cup", priceNaira: 800 },
  spices: { name: "Curry, thyme & spices", category: "Oils & spices", unit: "tbsp", priceNaira: 100 },
  stock: { name: "Seasoning / stock", category: "Oils & spices", unit: "cube", priceNaira: 40 },
  garlicSauce: { name: "Garlic sauce", category: "Others", unit: "tbsp", priceNaira: 150 },
  ofadaRice: { name: "Ofada rice", category: "Grains", unit: "kg", priceNaira: 2500 },
  yamFlour: { name: "Yam flour (elubo)", category: "Grains", unit: "kg", priceNaira: 2500 },
  yam: { name: "Yam", category: "Grains", unit: "kg", priceNaira: 1500 },
  bread: { name: "Bread (loaf)", category: "Grains", unit: "piece", priceNaira: 1500 },
  potatoes: { name: "Irish potatoes", category: "Veggies", unit: "kg", priceNaira: 2000 },
  okra: { name: "Okra", category: "Veggies", unit: "kg", priceNaira: 2000 },
  lettuce: { name: "Lettuce", category: "Veggies", unit: "piece", priceNaira: 700 },
  fish: { name: "Fresh fish (titus / catfish)", category: "Protein", unit: "kg", priceNaira: 4500 },
  chickpeas: { name: "Chickpeas", category: "Protein", unit: "kg", priceNaira: 3000 },
} satisfies Record<string, { name: string; category: GroceryCategory; unit: string; priceNaira: number }>;

export type IngredientId = keyof typeof INGREDIENTS;

export interface Recipe {
  id: string;
  name: string;
  cuisine: Cuisine;
  meal: Meal;
  emoji: string;
  description: string;
  prepMinutes: number;
  cookMinutes: number;
  difficulty: "Easy" | "Medium" | "Hard";
  /** Number of servings the ingredient quantities make. */
  servings: number;
  /** Per serving. */
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  ingredients: Array<{ id: IngredientId; qty: number; note?: string }>;
  steps: Array<{ title: string; text: string }>;
  tips?: string[];
}

export const RECIPES: Recipe[] = [
  {
    id: "jollof-chicken", name: "Jollof rice with grilled chicken", cuisine: "Nigerian", meal: "Lunch", emoji: "🍛",
    description: "Smoky party-style jollof with less oil, served with grilled chicken and a side of steamed vegetables.",
    prepMinutes: 20, cookMinutes: 45, difficulty: "Medium", servings: 4, kcal: 560, carbs: 72, protein: 32, fat: 15,
    ingredients: [
      { id: "rice", qty: 0.5 }, { id: "chicken", qty: 0.6 }, { id: "tomatoes", qty: 0.5 }, { id: "peppers", qty: 0.3 },
      { id: "onions", qty: 2 }, { id: "vegOil", qty: 0.25 }, { id: "spices", qty: 2 }, { id: "stock", qty: 2 }, { id: "carrots", qty: 0.2 },
    ],
    steps: [
      { title: "Season the chicken", text: "Season with onion, thyme, curry and a little stock. Grill or bake until cooked through." },
      { title: "Make the base", text: "Blend tomatoes, peppers and one onion. Fry the blend in the oil until the raw taste is gone." },
      { title: "Cook the rice", text: "Add washed rice, stock and water to just cover. Cover tightly and cook on low heat until tender." },
      { title: "Serve", text: "Serve 2 cooking spoons of rice with one chicken piece and steamed carrots." },
    ],
    tips: ["Use less oil than usual and let the rice steam on low heat for the smoky bottom-pot flavour."],
  },
  {
    id: "egusi-eba", name: "Egusi soup with spinach & eba", cuisine: "Nigerian", meal: "Dinner", emoji: "🍲",
    description: "A vegetable-rich egusi with lean beef. Pair with a fist-sized wrap of eba for a balanced plate.",
    prepMinutes: 20, cookMinutes: 40, difficulty: "Medium", servings: 4, kcal: 640, carbs: 62, protein: 30, fat: 31,
    ingredients: [
      { id: "egusi", qty: 1 }, { id: "beef", qty: 0.5 }, { id: "spinach", qty: 2 }, { id: "palmOil", qty: 0.25 },
      { id: "crayfish", qty: 0.25 }, { id: "peppers", qty: 0.2 }, { id: "onions", qty: 1 }, { id: "stock", qty: 2 }, { id: "garri", qty: 0.6 },
    ],
    steps: [
      { title: "Cook the beef", text: "Boil the beef with onion and stock until tender. Keep the stock." },
      { title: "Fry the egusi", text: "Heat the palm oil, add ground egusi mixed with a little water and stir until it forms curds." },
      { title: "Simmer", text: "Add blended pepper, crayfish, beef and stock. Simmer for 15 minutes." },
      { title: "Add greens", text: "Stir in the chopped spinach and cook for 3 minutes. Serve with eba." },
    ],
  },
  {
    id: "moimoi", name: "Moi moi with egg", cuisine: "Nigerian", meal: "Breakfast", emoji: "🫘",
    description: "Steamed bean pudding — high in protein and fibre. Great for breakfast with pap or a cup of tea.",
    prepMinutes: 30, cookMinutes: 50, difficulty: "Medium", servings: 6, kcal: 290, carbs: 24, protein: 16, fat: 14,
    ingredients: [
      { id: "beans", qty: 0.5 }, { id: "peppers", qty: 0.2 }, { id: "onions", qty: 1 }, { id: "eggs", qty: 3 },
      { id: "vegOil", qty: 0.25 }, { id: "crayfish", qty: 0.25 }, { id: "stock", qty: 2 },
    ],
    steps: [
      { title: "Peel the beans", text: "Soak and peel the beans, then blend with pepper and onion until smooth." },
      { title: "Season", text: "Mix in oil, crayfish and stock. Add warm water until the batter pours." },
      { title: "Fill", text: "Pour into leaves or bowls and add slices of boiled egg." },
      { title: "Steam", text: "Steam for 45–50 minutes until firm." },
    ],
  },
  {
    id: "akara-pap", name: "Akara with pap", cuisine: "Nigerian", meal: "Breakfast", emoji: "🧆",
    description: "Classic weekend breakfast. Air-fry or shallow-fry the akara to cut down on oil.",
    prepMinutes: 25, cookMinutes: 20, difficulty: "Easy", servings: 4, kcal: 380, carbs: 46, protein: 13, fat: 16,
    ingredients: [
      { id: "beans", qty: 0.4 }, { id: "onions", qty: 1 }, { id: "peppers", qty: 0.1 }, { id: "vegOil", qty: 0.5 }, { id: "milk", qty: 0.25 },
    ],
    steps: [
      { title: "Make the batter", text: "Blend peeled beans with pepper and onion using very little water. Whisk until fluffy." },
      { title: "Fry", text: "Scoop spoonfuls into hot oil and fry until golden, or air-fry for a lighter version." },
      { title: "Serve", text: "Serve 3 akara balls with a cup of pap and a splash of milk." },
    ],
  },
  {
    id: "beans-dodo", name: "Beans porridge & dodo", cuisine: "Nigerian", meal: "Dinner", emoji: "🍌",
    description: "Comforting stewed beans with a side of fried plantain. Rich in fibre and plant protein.",
    prepMinutes: 10, cookMinutes: 60, difficulty: "Easy", servings: 4, kcal: 520, carbs: 78, protein: 20, fat: 14,
    ingredients: [
      { id: "beans", qty: 0.5 }, { id: "plantain", qty: 2 }, { id: "palmOil", qty: 0.2 }, { id: "tomatoes", qty: 0.2 },
      { id: "onions", qty: 1 }, { id: "crayfish", qty: 0.25 }, { id: "stock", qty: 1 },
    ],
    steps: [
      { title: "Cook the beans", text: "Boil the beans until soft. Drain the first water to reduce bloating." },
      { title: "Make the sauce", text: "Add blended tomatoes, onion, palm oil, crayfish and stock. Simmer until thick." },
      { title: "Fry the plantain", text: "Slice the plantain and shallow-fry until golden." },
    ],
  },
  {
    id: "fruit-salad", name: "Naija fruit salad", cuisine: "Nigerian", meal: "Snacks", emoji: "🍉",
    description: "Pawpaw, watermelon and banana — a sweet, hydrating snack with no added sugar.",
    prepMinutes: 10, cookMinutes: 0, difficulty: "Easy", servings: 4, kcal: 130, carbs: 30, protein: 2, fat: 0.5,
    ingredients: [{ id: "pawpaw", qty: 1 }, { id: "watermelon", qty: 0.5 }, { id: "banana", qty: 2 }],
    steps: [{ title: "Chop and mix", text: "Peel and cube the fruit. Chill before serving." }],
  },
  {
    id: "groundnut-banana", name: "Groundnuts & banana", cuisine: "Nigerian", meal: "Snacks", emoji: "🥜",
    description: "The classic on-the-go snack: a handful of roasted groundnuts with a banana.",
    prepMinutes: 1, cookMinutes: 0, difficulty: "Easy", servings: 1, kcal: 270, carbs: 30, protein: 9, fat: 14,
    ingredients: [{ id: "groundnuts", qty: 0.25 }, { id: "banana", qty: 1 }],
    steps: [{ title: "Pack it", text: "Measure a small handful of groundnuts and pair with one banana." }],
  },
  {
    id: "omelette", name: "Vegetable omelette & toast", cuisine: "Continental", meal: "Breakfast", emoji: "🍳",
    description: "Fluffy two-egg omelette packed with peppers, onions and spinach.",
    prepMinutes: 5, cookMinutes: 8, difficulty: "Easy", servings: 1, kcal: 330, carbs: 22, protein: 18, fat: 19,
    ingredients: [{ id: "eggs", qty: 2 }, { id: "peppers", qty: 0.05 }, { id: "onions", qty: 0.5 }, { id: "spinach", qty: 0.25 }, { id: "vegOil", qty: 0.05 }],
    steps: [
      { title: "Prep", text: "Chop the vegetables and whisk the eggs with a pinch of salt." },
      { title: "Cook", text: "Soften the vegetables in a little oil, pour in the eggs and cook until just set." },
    ],
  },
  {
    id: "salmon-veg", name: "Grilled salmon & vegetables", cuisine: "Continental", meal: "Dinner", emoji: "🐟",
    description: "Oily fish rich in omega-3, with roasted carrots and greens. Mackerel works well too.",
    prepMinutes: 10, cookMinutes: 20, difficulty: "Easy", servings: 2, kcal: 450, carbs: 18, protein: 36, fat: 25,
    ingredients: [{ id: "salmon", qty: 0.3 }, { id: "carrots", qty: 0.3 }, { id: "spinach", qty: 1 }, { id: "vegOil", qty: 0.05 }, { id: "spices", qty: 1 }],
    steps: [
      { title: "Season", text: "Rub the fish with oil, spices and a squeeze of lemon." },
      { title: "Roast", text: "Roast with sliced carrots at 200°C for 15–20 minutes." },
      { title: "Finish", text: "Wilt the greens in the hot tray and serve." },
    ],
  },
  {
    id: "bolognese", name: "Spaghetti bolognese", cuisine: "Continental", meal: "Lunch", emoji: "🍝",
    description: "Lean beef and tomato sauce with extra vegetables over spaghetti.",
    prepMinutes: 10, cookMinutes: 30, difficulty: "Easy", servings: 4, kcal: 520, carbs: 64, protein: 28, fat: 16,
    ingredients: [
      { id: "spaghetti", qty: 1 }, { id: "beef", qty: 0.4 }, { id: "tomatoes", qty: 0.6 }, { id: "onions", qty: 1 },
      { id: "carrots", qty: 0.2 }, { id: "vegOil", qty: 0.1 }, { id: "spices", qty: 2 },
    ],
    steps: [
      { title: "Brown the beef", text: "Fry minced beef with onion and grated carrot until browned." },
      { title: "Simmer the sauce", text: "Add blended tomatoes and spices. Simmer for 20 minutes." },
      { title: "Serve", text: "Cook the spaghetti and serve with the sauce." },
    ],
  },
  {
    id: "shawarma", name: "Chicken shawarma (lighter)", cuisine: "International", meal: "Dinner", emoji: "🌯",
    description: "Home-made shawarma with grilled chicken, crunchy cabbage and a light garlic sauce.",
    prepMinutes: 15, cookMinutes: 15, difficulty: "Easy", servings: 2, kcal: 540, carbs: 52, protein: 34, fat: 21,
    ingredients: [{ id: "pita", qty: 2 }, { id: "chicken", qty: 0.3 }, { id: "cabbage", qty: 0.25 }, { id: "carrots", qty: 0.1 }, { id: "garlicSauce", qty: 2 }, { id: "spices", qty: 1 }],
    steps: [
      { title: "Grill the chicken", text: "Season strips of chicken with spices and grill until charred." },
      { title: "Assemble", text: "Fill warm bread with chicken, shredded cabbage, carrots and a little garlic sauce. Roll tightly." },
    ],
  },
  {
    id: "curry-rice", name: "Chicken curry & rice", cuisine: "International", meal: "Lunch", emoji: "🍛",
    description: "A mild, tomato-based chicken curry with vegetables, served over boiled rice.",
    prepMinutes: 15, cookMinutes: 35, difficulty: "Medium", servings: 4, kcal: 540, carbs: 62, protein: 30, fat: 17,
    ingredients: [{ id: "chicken", qty: 0.5 }, { id: "rice", qty: 0.4 }, { id: "tomatoes", qty: 0.3 }, { id: "onions", qty: 2 }, { id: "carrots", qty: 0.2 }, { id: "spices", qty: 3 }, { id: "vegOil", qty: 0.1 }],
    steps: [
      { title: "Brown the chicken", text: "Fry onion and spices, then add chicken pieces and brown." },
      { title: "Simmer", text: "Add tomatoes and carrots with a little water. Simmer for 25 minutes." },
      { title: "Serve", text: "Serve with boiled rice." },
    ],
  },
  {
    id: "oatmeal", name: "Oatmeal with banana", cuisine: "International", meal: "Breakfast", emoji: "🥣",
    description: "Creamy oats cooked in milk, topped with sliced banana and a few groundnuts.",
    prepMinutes: 2, cookMinutes: 6, difficulty: "Easy", servings: 1, kcal: 340, carbs: 55, protein: 12, fat: 9,
    ingredients: [{ id: "oats", qty: 0.05 }, { id: "milk", qty: 0.25 }, { id: "banana", qty: 1 }, { id: "groundnuts", qty: 0.05 }],
    steps: [
      { title: "Cook the oats", text: "Simmer the oats in milk for 5 minutes, stirring often." },
      { title: "Top", text: "Top with sliced banana and a sprinkle of groundnuts." },
    ],
  },
  {
    id: "yoghurt-berries", name: "Yoghurt & fruit bowl", cuisine: "International", meal: "Snacks", emoji: "🫐",
    description: "Plain or Greek yoghurt with fresh fruit — a protein-rich snack.",
    prepMinutes: 3, cookMinutes: 0, difficulty: "Easy", servings: 1, kcal: 210, carbs: 24, protein: 14, fat: 6,
    ingredients: [{ id: "yoghurt", qty: 1 }, { id: "berries", qty: 0.5 }],
    steps: [{ title: "Assemble", text: "Spoon the yoghurt into a bowl and top with fruit." }],
  },
  {
    id: "white-rice-stew", name: "White rice, stew & boiled egg", cuisine: "Nigerian", meal: "Lunch", emoji: "🍚",
    description: "Everyday rice and tomato stew made with less oil, with chicken and a boiled egg for protein.",
    prepMinutes: 15, cookMinutes: 50, difficulty: "Easy", servings: 4, kcal: 590, carbs: 82, protein: 22, fat: 19,
    ingredients: [
      { id: "rice", qty: 0.5 }, { id: "tomatoes", qty: 0.6 }, { id: "peppers", qty: 0.3 }, { id: "onions", qty: 2 },
      { id: "vegOil", qty: 0.25 }, { id: "chicken", qty: 0.4 }, { id: "eggs", qty: 4 }, { id: "stock", qty: 2 },
    ],
    steps: [
      { title: "Make the stew", text: "Blend tomatoes, peppers and an onion. Fry in the oil with the chicken until thick." },
      { title: "Boil", text: "Boil the rice until soft and the eggs for 10 minutes." },
      { title: "Serve", text: "2 cooking spoons of rice, a ladle of stew, one chicken piece and an egg." },
    ],
  },
  {
    id: "ofada-stew", name: "Ofada rice & pepper stew", cuisine: "Nigerian", meal: "Lunch", emoji: "🍚",
    description: "Wholegrain ofada rice with a lighter ayamase-style pepper stew, beef and egg.",
    prepMinutes: 20, cookMinutes: 50, difficulty: "Medium", servings: 4, kcal: 560, carbs: 76, protein: 24, fat: 17,
    ingredients: [
      { id: "ofadaRice", qty: 0.5 }, { id: "beef", qty: 0.4 }, { id: "peppers", qty: 0.4 }, { id: "palmOil", qty: 0.2 },
      { id: "onions", qty: 2 }, { id: "stock", qty: 2 }, { id: "eggs", qty: 4 },
    ],
    steps: [
      { title: "Wash the rice", text: "Pick and wash the ofada rice well, then boil until tender." },
      { title: "Make the stew", text: "Bleach a little palm oil briefly, fry onions and blended peppers, add beef and stock." },
      { title: "Serve", text: "Serve the rice with stew, beef and a boiled egg." },
    ],
  },
  {
    id: "okra-eba", name: "Okra soup with fish & eba", cuisine: "Nigerian", meal: "Lunch", emoji: "🍲",
    description: "Light, quick okra soup with fresh fish — high in fibre and lower in fat than most soups.",
    prepMinutes: 15, cookMinutes: 25, difficulty: "Easy", servings: 4, kcal: 480, carbs: 64, protein: 28, fat: 12,
    ingredients: [
      { id: "okra", qty: 0.5 }, { id: "fish", qty: 0.5 }, { id: "palmOil", qty: 0.1 }, { id: "crayfish", qty: 0.25 },
      { id: "peppers", qty: 0.1 }, { id: "stock", qty: 2 }, { id: "garri", qty: 0.6 },
    ],
    steps: [
      { title: "Cook the fish", text: "Simmer the fish with stock, pepper and crayfish for 10 minutes." },
      { title: "Add okra", text: "Stir in grated okra and a little palm oil. Cook for 5 minutes, uncovered." },
      { title: "Serve", text: "Serve with a fist-sized wrap of eba." },
    ],
  },
  {
    id: "efo-amala", name: "Efo riro with fish & amala", cuisine: "Nigerian", meal: "Dinner", emoji: "🥬",
    description: "Spinach-rich efo riro with fish, served with amala. Plenty of iron and vitamin A.",
    prepMinutes: 20, cookMinutes: 30, difficulty: "Medium", servings: 4, kcal: 520, carbs: 60, protein: 30, fat: 18,
    ingredients: [
      { id: "spinach", qty: 3 }, { id: "fish", qty: 0.5 }, { id: "palmOil", qty: 0.2 }, { id: "peppers", qty: 0.2 },
      { id: "onions", qty: 1 }, { id: "crayfish", qty: 0.25 }, { id: "stock", qty: 2 }, { id: "yamFlour", qty: 0.5 },
    ],
    steps: [
      { title: "Make the base", text: "Fry onion and blended peppers in palm oil, then add crayfish, stock and fish." },
      { title: "Add greens", text: "Fold in chopped spinach and cook for 3–4 minutes so it stays green." },
      { title: "Make amala", text: "Stir yam flour into boiling water until smooth. Serve a fist-sized portion." },
    ],
  },
  {
    id: "pepper-soup", name: "Catfish pepper soup", cuisine: "Nigerian", meal: "Dinner", emoji: "🍲",
    description: "A warming, low-carb pepper soup. A light dinner that's high in protein.",
    prepMinutes: 10, cookMinutes: 25, difficulty: "Easy", servings: 4, kcal: 320, carbs: 8, protein: 34, fat: 17,
    ingredients: [{ id: "fish", qty: 0.8 }, { id: "peppers", qty: 0.1 }, { id: "onions", qty: 1 }, { id: "spices", qty: 2 }, { id: "stock", qty: 2 }],
    steps: [
      { title: "Simmer", text: "Boil water with onion, pepper soup spice, pepper and stock for 10 minutes." },
      { title: "Add the fish", text: "Add cleaned catfish and simmer gently for 12 minutes without stirring too much." },
    ],
  },
  {
    id: "yam-egg", name: "Boiled yam & egg sauce", cuisine: "Nigerian", meal: "Breakfast", emoji: "🍳",
    description: "Boiled yam with a tomato-pepper egg sauce. A filling Saturday-morning favourite.",
    prepMinutes: 10, cookMinutes: 25, difficulty: "Easy", servings: 2, kcal: 420, carbs: 58, protein: 14, fat: 14,
    ingredients: [
      { id: "yam", qty: 0.6 }, { id: "eggs", qty: 4 }, { id: "tomatoes", qty: 0.3 }, { id: "onions", qty: 1 },
      { id: "peppers", qty: 0.1 }, { id: "vegOil", qty: 0.1 },
    ],
    steps: [
      { title: "Boil the yam", text: "Peel, slice and boil the yam with a pinch of salt until soft." },
      { title: "Make the sauce", text: "Fry chopped onion, tomato and pepper, then stir in the beaten eggs until just set." },
    ],
  },
  {
    id: "bread-egg-tea", name: "Bread, boiled egg & tea", cuisine: "Nigerian", meal: "Breakfast", emoji: "🍞",
    description: "The quick weekday breakfast, balanced with an egg for protein and less sugar in the tea.",
    prepMinutes: 2, cookMinutes: 10, difficulty: "Easy", servings: 1, kcal: 360, carbs: 46, protein: 16, fat: 12,
    ingredients: [{ id: "bread", qty: 0.25 }, { id: "eggs", qty: 1 }, { id: "milk", qty: 0.1 }],
    steps: [
      { title: "Boil the egg", text: "Boil the egg for 10 minutes." },
      { title: "Serve", text: "3 slices of bread with the egg and tea with milk and one spoon of sugar or none." },
    ],
  },
  {
    id: "suya-salad", name: "Suya with cabbage & onions", cuisine: "Nigerian", meal: "Snacks", emoji: "🍢",
    description: "A small portion of beef suya with crunchy cabbage and onions. Protein-rich and satisfying.",
    prepMinutes: 15, cookMinutes: 15, difficulty: "Easy", servings: 1, kcal: 300, carbs: 10, protein: 30, fat: 16,
    ingredients: [{ id: "beef", qty: 0.15 }, { id: "cabbage", qty: 0.25 }, { id: "onions", qty: 0.5 }, { id: "groundnuts", qty: 0.05 }],
    steps: [
      { title: "Grill", text: "Thinly slice the beef, coat with yaji (ground groundnut spice) and grill until charred." },
      { title: "Serve", text: "Serve with sliced cabbage and onions." },
    ],
  },
  {
    id: "french-toast-fruit", name: "French toast & banana", cuisine: "Continental", meal: "Breakfast", emoji: "🍞",
    description: "Egg-dipped toast cooked in a little oil, served with sliced banana instead of syrup.",
    prepMinutes: 5, cookMinutes: 10, difficulty: "Easy", servings: 2, kcal: 380, carbs: 50, protein: 14, fat: 14,
    ingredients: [{ id: "bread", qty: 0.2 }, { id: "eggs", qty: 2 }, { id: "milk", qty: 0.1 }, { id: "banana", qty: 2 }, { id: "vegOil", qty: 0.02 }],
    steps: [
      { title: "Dip", text: "Whisk eggs with milk and dip each slice on both sides." },
      { title: "Cook", text: "Cook in a lightly oiled pan until golden. Top with banana." },
    ],
  },
  {
    id: "chicken-salad", name: "Grilled chicken salad", cuisine: "Continental", meal: "Lunch", emoji: "🥗",
    description: "Caesar-style salad with grilled chicken, egg and a light yoghurt dressing.",
    prepMinutes: 15, cookMinutes: 12, difficulty: "Easy", servings: 1, kcal: 420, carbs: 20, protein: 36, fat: 22,
    ingredients: [
      { id: "chicken", qty: 0.15 }, { id: "lettuce", qty: 0.5 }, { id: "eggs", qty: 1 }, { id: "bread", qty: 0.1 },
      { id: "yoghurt", qty: 0.25 }, { id: "spices", qty: 0.5 },
    ],
    steps: [
      { title: "Grill", text: "Season and grill the chicken, then slice." },
      { title: "Toss", text: "Toss lettuce with yoghurt dressing, toasted bread cubes, chicken and a halved egg." },
    ],
  },
  {
    id: "roast-chicken-veg", name: "Roast chicken & potatoes", cuisine: "Continental", meal: "Dinner", emoji: "🍗",
    description: "Oven-roasted chicken with potatoes and carrots — a simple Sunday dinner.",
    prepMinutes: 15, cookMinutes: 50, difficulty: "Easy", servings: 4, kcal: 520, carbs: 34, protein: 40, fat: 24,
    ingredients: [{ id: "chicken", qty: 0.8 }, { id: "potatoes", qty: 0.6 }, { id: "carrots", qty: 0.3 }, { id: "vegOil", qty: 0.1 }, { id: "spices", qty: 2 }],
    steps: [
      { title: "Season", text: "Rub the chicken with oil and spices. Cut potatoes and carrots into chunks." },
      { title: "Roast", text: "Roast everything at 200°C for 45–50 minutes, turning once." },
    ],
  },
  {
    id: "chicken-bowl", name: "Chicken grain bowl", cuisine: "International", meal: "Lunch", emoji: "🥙",
    description: "Rice, grilled chicken and crunchy vegetables in one bowl. Easy to pack for work.",
    prepMinutes: 10, cookMinutes: 20, difficulty: "Easy", servings: 1, kcal: 500, carbs: 58, protein: 34, fat: 14,
    ingredients: [{ id: "chicken", qty: 0.15 }, { id: "rice", qty: 0.08 }, { id: "cabbage", qty: 0.2 }, { id: "carrots", qty: 0.1 }, { id: "vegOil", qty: 0.03 }, { id: "spices", qty: 1 }],
    steps: [
      { title: "Cook", text: "Boil the rice and grill the seasoned chicken." },
      { title: "Build", text: "Layer rice, sliced chicken, shredded cabbage and carrot." },
    ],
  },
  {
    id: "fried-rice-veg", name: "Egg fried rice with vegetables", cuisine: "International", meal: "Dinner", emoji: "🍚",
    description: "Wok-style fried rice with egg and plenty of vegetables, using less oil.",
    prepMinutes: 10, cookMinutes: 20, difficulty: "Easy", servings: 4, kcal: 480, carbs: 66, protein: 16, fat: 16,
    ingredients: [
      { id: "rice", qty: 0.4 }, { id: "eggs", qty: 4 }, { id: "carrots", qty: 0.2 }, { id: "peppers", qty: 0.1 },
      { id: "onions", qty: 1 }, { id: "vegOil", qty: 0.15 }, { id: "stock", qty: 2 },
    ],
    steps: [
      { title: "Cook the rice", text: "Use rice cooked the day before, or boil and cool it first." },
      { title: "Stir-fry", text: "Scramble the eggs, add vegetables, then the rice and stock. Toss on high heat." },
    ],
  },
  {
    id: "hummus-veg", name: "Hummus, pita & carrots", cuisine: "International", meal: "Snacks", emoji: "🧆",
    description: "Chickpea hummus with half a pita and carrot sticks. Fibre and protein to keep you full.",
    prepMinutes: 10, cookMinutes: 0, difficulty: "Easy", servings: 1, kcal: 260, carbs: 30, protein: 9, fat: 11,
    ingredients: [{ id: "chickpeas", qty: 0.05 }, { id: "pita", qty: 0.5 }, { id: "carrots", qty: 0.1 }, { id: "vegOil", qty: 0.02 }],
    steps: [{ title: "Blend", text: "Blend cooked chickpeas with oil, lemon and garlic. Serve with pita and carrot sticks." }],
  },
];

export function recipeById(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

export interface GroceryLine {
  key: IngredientId;
  name: string;
  category: GroceryCategory;
  unit: string;
  qty: number;
  costNaira: number;
}

/** Round shopping quantities to something you can actually buy. */
function roundQty(qty: number, unit: string): number {
  if (["piece", "cube", "bunch", "pack"].includes(unit)) return Math.max(1, Math.ceil(qty - 1e-9));
  return Math.max(0.05, Math.ceil(qty * 20 - 1e-9) / 20); // nearest 0.05 up
}

/** A planned dish: a recipe and how many servings of it (1 when not set). */
export type PlannedDish = string | { recipeId: string; portion?: number };

/**
 * Aggregate the ingredients for a list of planned recipes. Each planned item is one meal for
 * `people` people (times its portion); recipe quantities are scaled from the recipe's own serving count.
 */
export function buildGroceryList(items: PlannedDish[], people = 1): GroceryLine[] {
  const totals = new Map<IngredientId, number>();
  for (const item of items) {
    const { recipeId, portion = 1 } = typeof item === "string" ? { recipeId: item } : item;
    const r = recipeById(recipeId);
    if (!r) continue;
    for (const ing of r.ingredients) {
      totals.set(ing.id, (totals.get(ing.id) ?? 0) + (ing.qty * people * portion) / r.servings);
    }
  }
  return [...totals.entries()]
    .map(([key, raw]) => {
      const info = INGREDIENTS[key];
      const qty = roundQty(raw, info.unit);
      return { key, name: info.name, category: info.category as GroceryCategory, unit: info.unit, qty, costNaira: qty * info.priceNaira };
    })
    .sort((a, b) => GROCERY_CATEGORIES.indexOf(a.category) - GROCERY_CATEGORIES.indexOf(b.category) || a.name.localeCompare(b.name));
}

/** Estimated ingredient cost of one serving in Naira (unrounded, so it's a fair comparison between dishes). */
export function costPerServing(r: Recipe): number {
  return r.ingredients.reduce((t, i) => t + (i.qty * INGREDIENTS[i.id].priceNaira) / r.servings, 0);
}

export type Allergen = "egg" | "dairy" | "peanut" | "fish" | "shellfish" | "gluten";
export const ALLERGENS: Array<{ id: Allergen; label: string }> = [
  { id: "peanut", label: "Groundnuts" },
  { id: "egg", label: "Eggs" },
  { id: "dairy", label: "Milk & dairy" },
  { id: "fish", label: "Fish" },
  { id: "shellfish", label: "Crayfish & shellfish" },
  { id: "gluten", label: "Wheat (gluten)" },
];

export type Diet = "any" | "pescatarian" | "vegetarian";
export const DIETS: Array<{ id: Diet; label: string }> = [
  { id: "any", label: "Everything" },
  { id: "pescatarian", label: "Fish, no meat" },
  { id: "vegetarian", label: "Vegetarian" },
];

const INGREDIENT_ALLERGENS: Partial<Record<IngredientId, Allergen[]>> = {
  eggs: ["egg"],
  milk: ["dairy"],
  yoghurt: ["dairy"],
  groundnuts: ["peanut"],
  fish: ["fish"],
  salmon: ["fish"],
  crayfish: ["shellfish"],
  bread: ["gluten"],
  pita: ["gluten"],
  spaghetti: ["gluten"],
  garlicSauce: ["egg"],
};
const MEAT: IngredientId[] = ["chicken", "beef"];
const SEAFOOD: IngredientId[] = ["fish", "salmon", "crayfish"];

export function recipeAllergens(r: Recipe): Allergen[] {
  return [...new Set(r.ingredients.flatMap((i) => INGREDIENT_ALLERGENS[i.id] ?? []))];
}

export function fitsDiet(r: Recipe, diet: Diet): boolean {
  const ids = r.ingredients.map((i) => i.id);
  if (diet === "any") return true;
  if (ids.some((id) => MEAT.includes(id))) return false;
  return diet === "pescatarian" || !ids.some((id) => SEAFOOD.includes(id));
}

/**
 * A simple balanced sample week: rotates recipes for each meal, preferring the chosen cuisines.
 * Not a personalised plan — those are set by dietitians.
 */
export function sampleWeekPlan(dates: string[], cuisines: Cuisine[]): Array<{ date: string; meal: Meal; recipeId: string }> {
  const meals: Meal[] = ["Breakfast", "Lunch", "Dinner", "Snacks"];
  const out: Array<{ date: string; meal: Meal; recipeId: string }> = [];
  for (const meal of meals) {
    const preferred = RECIPES.filter((r) => r.meal === meal && cuisines.includes(r.cuisine));
    const pool = preferred.length > 0 ? preferred : RECIPES.filter((r) => r.meal === meal);
    dates.forEach((date, i) => out.push({ date, meal, recipeId: pool[i % pool.length].id }));
  }
  return out;
}

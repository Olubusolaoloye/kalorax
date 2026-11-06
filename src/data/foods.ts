// SAMPLE DATA — placeholder values for the prototype, NOT for clinical use.
// Real values will come from the West African / Nigerian food composition tables
// and, for continental and international dishes, USDA FoodData Central.
import { recipeById, type Recipe } from "./recipes";

export interface Portion {
  label: string;
  grams: number;
}

export type Cuisine =
  | "Nigerian"
  | "Ghanaian"
  | "East African"
  | "South African"
  | "Continental"
  | "Caribbean"
  | "Russian"
  | "Indian"
  | "Chinese"
  | "International";

export const CUISINES: Array<{ id: Cuisine; label: string; emoji: string; blurb: string }> = [
  { id: "Nigerian", label: "Naija", emoji: "🇳🇬", blurb: "Swallows, soups, rice and street favourites" },
  { id: "Ghanaian", label: "Ghanaian", emoji: "🇬🇭", blurb: "Banku, kenkey, waakye and light soup" },
  { id: "East African", label: "East African", emoji: "🇰🇪", blurb: "Ugali, chapati, pilau and nyama choma" },
  { id: "South African", label: "South African", emoji: "🇿🇦", blurb: "Pap, bobotie, braai and bunny chow" },
  { id: "Continental", label: "Western", emoji: "🍽️", blurb: "European and American breakfasts, mains and sides" },
  { id: "Caribbean", label: "Caribbean", emoji: "🇯🇲", blurb: "Jerk chicken, rice and peas, patties" },
  { id: "Russian", label: "Russian", emoji: "🇷🇺", blurb: "Borscht, pelmeni, blini and kasha" },
  { id: "Indian", label: "Indian", emoji: "🇮🇳", blurb: "Dal, curries, biryani and breads" },
  { id: "Chinese", label: "Chinese", emoji: "🇨🇳", blurb: "Noodles, stir-fries and dumplings" },
  { id: "International", label: "Around the world", emoji: "🌍", blurb: "Fast food and favourites from everywhere" },
];

/** Category sections shown for each cuisine, in display order. */
export const CATEGORIES_BY_CUISINE: Record<Cuisine, string[]> = {
  Nigerian: ["Swallow", "Rice & grains", "Cereals & porridge", "Yam & plantain", "Soups", "Beans", "Protein", "Snacks & drinks", "Fruits"],
  Ghanaian: ["Staples", "Soups & stews", "Mains & sides", "Street food & drinks"],
  "East African": ["Staples", "Stews & mains", "Snacks & drinks"],
  "South African": ["Mains", "Braai & meat", "Snacks & sides"],
  Continental: ["Breakfast", "Mains", "Pasta", "Salads & soups", "Sides & bakery"],
  Caribbean: ["Mains", "Sides", "Snacks & drinks"],
  Russian: ["Soups", "Mains", "Breakfast & bakery", "Salads & sides"],
  Indian: ["Curries", "Rice & breads", "Breakfast", "Snacks & drinks"],
  Chinese: ["Rice & noodles", "Mains", "Dim sum & snacks"],
  International: ["Fast food", "Asian", "Middle Eastern", "Mexican", "Healthy bowls"],
};

export interface Food {
  id: string;
  name: string;
  cuisine: Cuisine;
  category: string;
  /** Placeholder visual until real food photography is added. */
  emoji: string;
  aliases: string[];
  /** Per 100 g. */
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  portions: Portion[];
  source: string;
}

const SAMPLE = "Sample data – not for clinical use";

const wraps: Portion[] = [
  { label: "Small wrap (fist-size)", grams: 150 },
  { label: "Medium wrap", grams: 250 },
  { label: "Large wrap", grams: 350 },
];
const riceSpoons: Portion[] = [
  { label: "1 cooking spoon", grams: 70 },
  { label: "2 cooking spoons", grams: 140 },
  { label: "1 plate", grams: 300 },
];
const soup: Portion[] = [
  { label: "Small serving", grams: 100 },
  { label: "1 serving", grams: 150 },
  { label: "Large serving", grams: 250 },
];


const plate = (grams: number): Portion[] => [
  { label: "Small plate", grams: Math.round(grams * 0.7) },
  { label: "1 plate", grams },
  { label: "Large plate", grams: Math.round(grams * 1.4) },
];
const bowl = (grams: number): Portion[] => [
  { label: "Small bowl", grams: Math.round(grams * 0.7) },
  { label: "1 bowl", grams },
];

const CONTINENTAL: Food[] = [
  { id: "english-breakfast", cuisine: "Continental", category: "Breakfast", emoji: "🍳", name: "Full English breakfast", aliases: ["fry-up", "eggs and sausage"], kcal: 200, carbs: 8, protein: 11, fat: 14, portions: [{ label: "Light plate", grams: 250 }, { label: "Full plate", grams: 400 }], source: SAMPLE },
  { id: "omelette", cuisine: "Continental", category: "Breakfast", emoji: "🍳", name: "Vegetable omelette", aliases: ["omelet", "eggs"], kcal: 155, carbs: 2, protein: 11, fat: 12, portions: [{ label: "2-egg omelette", grams: 130 }, { label: "3-egg omelette", grams: 190 }], source: SAMPLE },
  { id: "pancakes", cuisine: "Continental", category: "Breakfast", emoji: "🥞", name: "Pancakes with syrup", aliases: ["pancake", "flapjacks"], kcal: 230, carbs: 32, protein: 6, fat: 9, portions: [{ label: "2 pancakes", grams: 120 }, { label: "3 pancakes", grams: 180 }], source: SAMPLE },
  { id: "french-toast", cuisine: "Continental", category: "Breakfast", emoji: "🍞", name: "French toast", aliases: ["eggy bread"], kcal: 230, carbs: 25, protein: 8, fat: 11, portions: [{ label: "1 slice", grams: 65 }, { label: "2 slices", grams: 130 }], source: SAMPLE },
  { id: "grilled-salmon", cuisine: "Continental", category: "Mains", emoji: "🐟", name: "Grilled salmon & vegetables", aliases: ["salmon", "fish fillet"], kcal: 150, carbs: 4, protein: 16, fat: 8, portions: plate(320), source: SAMPLE },
  { id: "steak-chips", cuisine: "Continental", category: "Mains", emoji: "🥩", name: "Steak & chips", aliases: ["steak frites", "beef steak"], kcal: 220, carbs: 15, protein: 15, fat: 11, portions: plate(350), source: SAMPLE },
  { id: "roast-chicken", cuisine: "Continental", category: "Mains", emoji: "🍗", name: "Roast chicken & potatoes", aliases: ["sunday roast"], kcal: 170, carbs: 10, protein: 15, fat: 8, portions: plate(350), source: SAMPLE },
  { id: "fish-chips", cuisine: "Continental", category: "Mains", emoji: "🍟", name: "Fish & chips", aliases: ["battered fish"], kcal: 230, carbs: 20, protein: 10, fat: 12, portions: plate(350), source: SAMPLE },
  { id: "bolognese", cuisine: "Continental", category: "Pasta", emoji: "🍝", name: "Spaghetti bolognese", aliases: ["spag bol", "spaghetti", "pasta"], kcal: 150, carbs: 18, protein: 7, fat: 5, portions: plate(350), source: SAMPLE },
  { id: "lasagne", cuisine: "Continental", category: "Pasta", emoji: "🫕", name: "Beef lasagne", aliases: ["lasagna"], kcal: 165, carbs: 15, protein: 9, fat: 8, portions: [{ label: "Small slice", grams: 180 }, { label: "1 slice", grams: 250 }], source: SAMPLE },
  { id: "alfredo", cuisine: "Continental", category: "Pasta", emoji: "🍝", name: "Chicken Alfredo pasta", aliases: ["creamy pasta", "fettuccine"], kcal: 190, carbs: 18, protein: 10, fat: 9, portions: plate(330), source: SAMPLE },
  { id: "caesar", cuisine: "Continental", category: "Salads & soups", emoji: "🥗", name: "Chicken Caesar salad", aliases: ["salad"], kcal: 130, carbs: 6, protein: 9, fat: 8, portions: bowl(280), source: SAMPLE },
  { id: "greek-salad", cuisine: "Continental", category: "Salads & soups", emoji: "🥗", name: "Greek salad with feta", aliases: ["feta salad", "salad"], kcal: 110, carbs: 5, protein: 4, fat: 9, portions: bowl(250), source: SAMPLE },
  { id: "cream-soup", cuisine: "Continental", category: "Salads & soups", emoji: "🥣", name: "Cream of mushroom soup", aliases: ["mushroom soup"], kcal: 70, carbs: 6, protein: 2, fat: 4, portions: bowl(300), source: SAMPLE },
  { id: "mash", cuisine: "Continental", category: "Sides & bakery", emoji: "🥔", name: "Mashed potatoes", aliases: ["mash", "potato"], kcal: 110, carbs: 16, protein: 2, fat: 4, portions: [{ label: "1 scoop", grams: 100 }, { label: "Side portion", grams: 180 }], source: SAMPLE },
  { id: "croissant", cuisine: "Continental", category: "Sides & bakery", emoji: "🥐", name: "Butter croissant", aliases: ["pastry"], kcal: 406, carbs: 45, protein: 8, fat: 21, portions: [{ label: "1 croissant", grams: 60 }], source: SAMPLE },
];

const INTERNATIONAL: Food[] = [
  { id: "shawarma", cuisine: "International", category: "Fast food", emoji: "🌯", name: "Chicken shawarma", aliases: ["wrap", "shawama"], kcal: 210, carbs: 20, protein: 13, fat: 9, portions: [{ label: "Regular wrap", grams: 250 }, { label: "Jumbo wrap", grams: 380 }], source: SAMPLE },
  { id: "burger", cuisine: "International", category: "Fast food", emoji: "🍔", name: "Beef burger", aliases: ["cheeseburger", "hamburger"], kcal: 260, carbs: 24, protein: 13, fat: 12, portions: [{ label: "1 burger", grams: 220 }, { label: "Double burger", grams: 320 }], source: SAMPLE },
  { id: "pizza", cuisine: "International", category: "Fast food", emoji: "🍕", name: "Pepperoni pizza", aliases: ["pizza slice"], kcal: 270, carbs: 30, protein: 12, fat: 11, portions: [{ label: "1 slice", grams: 110 }, { label: "2 slices", grams: 220 }, { label: "4 slices", grams: 440 }], source: SAMPLE },
  { id: "fried-chicken", cuisine: "International", category: "Fast food", emoji: "🍗", name: "Fried chicken", aliases: ["chicken wings", "crispy chicken"], kcal: 260, carbs: 9, protein: 20, fat: 16, portions: [{ label: "1 piece", grams: 100 }, { label: "2 pieces", grams: 200 }, { label: "3 pieces", grams: 300 }], source: SAMPLE },
  { id: "fries", cuisine: "International", category: "Fast food", emoji: "🍟", name: "French fries", aliases: ["chips", "fries"], kcal: 312, carbs: 41, protein: 3.4, fat: 15, portions: [{ label: "Small", grams: 80 }, { label: "Medium", grams: 115 }, { label: "Large", grams: 150 }], source: SAMPLE },
  { id: "chinese-fried-rice", cuisine: "International", category: "Asian", emoji: "🍚", name: "Chinese fried rice", aliases: ["egg fried rice"], kcal: 170, carbs: 25, protein: 5, fat: 6, portions: plate(300), source: SAMPLE },
  { id: "chicken-curry", cuisine: "International", category: "Asian", emoji: "🍛", name: "Chicken curry", aliases: ["curry", "tikka masala"], kcal: 150, carbs: 6, protein: 13, fat: 8, portions: bowl(250), source: SAMPLE },
  { id: "sushi", cuisine: "International", category: "Asian", emoji: "🍣", name: "Sushi rolls", aliases: ["maki", "california roll"], kcal: 150, carbs: 29, protein: 5, fat: 1.5, portions: [{ label: "6 pieces", grams: 180 }, { label: "12 pieces", grams: 360 }], source: SAMPLE },
  { id: "pad-thai", cuisine: "International", category: "Asian", emoji: "🍜", name: "Pad Thai", aliases: ["thai noodles"], kcal: 160, carbs: 22, protein: 7, fat: 5, portions: plate(300), source: SAMPLE },
  { id: "ramen", cuisine: "International", category: "Asian", emoji: "🍜", name: "Chicken ramen", aliases: ["noodle soup"], kcal: 90, carbs: 11, protein: 5, fat: 3, portions: bowl(450), source: SAMPLE },
  { id: "hummus-pita", cuisine: "International", category: "Middle Eastern", emoji: "🧆", name: "Hummus & pita", aliases: ["hummus", "pita bread"], kcal: 240, carbs: 30, protein: 8, fat: 10, portions: [{ label: "Small serving", grams: 100 }, { label: "1 serving", grams: 150 }], source: SAMPLE },
  { id: "falafel", cuisine: "International", category: "Middle Eastern", emoji: "🧆", name: "Falafel wrap", aliases: ["falafel"], kcal: 230, carbs: 28, protein: 8, fat: 10, portions: [{ label: "1 wrap", grams: 250 }], source: SAMPLE },
  { id: "tacos", cuisine: "International", category: "Mexican", emoji: "🌮", name: "Beef tacos", aliases: ["taco"], kcal: 220, carbs: 20, protein: 10, fat: 11, portions: [{ label: "1 taco", grams: 100 }, { label: "2 tacos", grams: 200 }, { label: "3 tacos", grams: 300 }], source: SAMPLE },
  { id: "burrito", cuisine: "International", category: "Mexican", emoji: "🌯", name: "Chicken burrito", aliases: ["burrito bowl"], kcal: 180, carbs: 20, protein: 10, fat: 6, portions: [{ label: "1 burrito", grams: 330 }], source: SAMPLE },
  { id: "oatmeal", cuisine: "International", category: "Healthy bowls", emoji: "🥣", name: "Oatmeal with banana", aliases: ["oats", "porridge oats"], kcal: 85, carbs: 15, protein: 2.5, fat: 1.5, portions: bowl(300), source: SAMPLE },
  { id: "yoghurt-bowl", cuisine: "International", category: "Healthy bowls", emoji: "🫐", name: "Greek yoghurt & berries", aliases: ["parfait", "yogurt"], kcal: 95, carbs: 10, protein: 7, fat: 3, portions: bowl(220), source: SAMPLE },
  { id: "poke", cuisine: "International", category: "Healthy bowls", emoji: "🥙", name: "Chicken quinoa bowl", aliases: ["grain bowl", "quinoa"], kcal: 140, carbs: 15, protein: 11, fat: 4, portions: bowl(350), source: SAMPLE },
];


const piece = (label: string, grams: number, more: number[] = []): Portion[] => [
  { label: `1 ${label}`, grams },
  ...more.map((n) => ({ label: `${n} ${label}s`, grams: grams * n })),
];
const balls: Portion[] = [{ label: "Small ball", grams: 200 }, { label: "1 ball", grams: 300 }, { label: "Large ball", grams: 400 }];
const f = (cuisine: Cuisine, category: string, id: string, emoji: string, name: string, aliases: string[], kcal: number, carbs: number, protein: number, fat: number, portions: Portion[]): Food =>
  ({ id, cuisine, category, emoji, name, aliases, kcal, carbs, protein, fat, portions, source: SAMPLE });

const MORE_WESTERN: Food[] = [
  f("Continental", "Breakfast", "bagel", "🥯", "Bagel with cream cheese", ["bagel"], 280, 42, 9, 8, piece("bagel", 130)),
  f("Continental", "Mains", "mac-cheese", "🧀", "Mac and cheese", ["macaroni cheese", "mac n cheese"], 165, 17, 7, 8, bowl(250)),
  f("Continental", "Sides & bakery", "sandwich", "🥪", "Chicken sandwich", ["sandwich", "sub"], 230, 24, 13, 9, piece("sandwich", 200)),
];

const GHANAIAN: Food[] = [
  f("Ghanaian", "Staples", "banku", "🫓", "Banku", ["banku and okro"], 115, 26, 1.6, 0.4, balls),
  f("Ghanaian", "Staples", "kenkey", "🫓", "Kenkey", ["dokon", "fante kenkey", "ga kenkey"], 120, 26, 2.5, 0.8, piece("ball", 250, [2])),
  f("Ghanaian", "Staples", "gh-fufu", "🫓", "Fufu (cassava & plantain)", ["ghana fufu", "fufu"], 130, 31, 1, 0.3, balls),
  f("Ghanaian", "Staples", "waakye", "🍛", "Waakye", ["rice and beans", "waache"], 150, 27, 6, 2, plate(300)),
  f("Ghanaian", "Staples", "gh-jollof", "🍛", "Ghana jollof rice", ["jollof", "ghana jollof"], 165, 26, 3.5, 5.5, plate(300)),
  f("Ghanaian", "Soups & stews", "light-soup", "🍲", "Light soup (goat)", ["nkrakra", "goat light soup"], 60, 3, 7, 2, soup),
  f("Ghanaian", "Soups & stews", "groundnut-soup", "🍲", "Groundnut soup", ["nkate nkwan", "peanut soup"], 160, 6, 7, 12, soup),
  f("Ghanaian", "Soups & stews", "palm-nut-soup", "🍲", "Palm nut soup", ["abenkwan"], 200, 5, 6, 17, soup),
  f("Ghanaian", "Soups & stews", "kontomire", "🥬", "Kontomire stew", ["palava sauce", "cocoyam leaf stew"], 130, 6, 5, 10, soup),
  f("Ghanaian", "Mains & sides", "red-red", "🫘", "Red red (beans & plantain)", ["red red", "gobe"], 175, 24, 6, 6, plate(300)),
  f("Ghanaian", "Mains & sides", "grilled-tilapia", "🐟", "Grilled tilapia", ["tilapia", "banku and tilapia"], 130, 0, 26, 3, [{ label: "Half fish", grams: 150 }, { label: "1 fish", grams: 300 }]),
  f("Ghanaian", "Mains & sides", "shito", "🌶️", "Shito (black pepper sauce)", ["shito", "pepper sauce"], 450, 10, 8, 42, [{ label: "1 tablespoon", grams: 15 }, { label: "2 tablespoons", grams: 30 }]),
  f("Ghanaian", "Street food & drinks", "kelewele", "🍌", "Kelewele", ["spicy fried plantain"], 230, 34, 1.3, 10, [{ label: "Small pack", grams: 100 }, { label: "Large pack", grams: 200 }]),
  f("Ghanaian", "Street food & drinks", "sobolo", "🥤", "Sobolo (sweetened)", ["bissap", "hibiscus drink"], 45, 11, 0, 0, [{ label: "1 cup", grams: 250 }, { label: "1 bottle (50cl)", grams: 500 }]),
];

const EAST_AFRICAN: Food[] = [
  f("East African", "Staples", "ugali", "🫓", "Ugali", ["sima", "posho", "nsima"], 115, 25, 2.5, 0.6, [{ label: "Small piece", grams: 150 }, { label: "1 serving", grams: 250 }, { label: "Large serving", grams: 350 }]),
  f("East African", "Staples", "chapati", "🫓", "Chapati", ["chapo"], 300, 46, 7, 10, piece("chapati", 70, [2])),
  f("East African", "Staples", "pilau", "🍛", "Pilau", ["pilau rice"], 175, 27, 4, 5.5, plate(300)),
  f("East African", "Staples", "injera", "🫓", "Injera", ["enjera"], 160, 33, 5, 1, piece("piece", 125, [2])),
  f("East African", "Staples", "matoke", "🍌", "Matoke (stewed bananas)", ["matooke", "green bananas"], 110, 22, 1.5, 2.5, plate(300)),
  f("East African", "Stews & mains", "sukuma-wiki", "🥬", "Sukuma wiki", ["collard greens", "kale"], 70, 6, 3, 4, [{ label: "1 serving", grams: 150 }]),
  f("East African", "Stews & mains", "nyama-choma", "🍖", "Nyama choma", ["grilled goat", "roast meat"], 230, 0, 27, 13, [{ label: "Small plate", grams: 150 }, { label: "1 plate", grams: 250 }]),
  f("East African", "Stews & mains", "githeri", "🫘", "Githeri", ["maize and beans"], 130, 20, 6, 2.5, plate(300)),
  f("East African", "Stews & mains", "doro-wat", "🍲", "Doro wat", ["chicken stew", "doro wot"], 160, 5, 14, 9, bowl(250)),
  f("East African", "Snacks & drinks", "mandazi", "🍩", "Mandazi", ["maandazi", "swahili bun"], 390, 48, 7, 19, piece("piece", 50, [3])),
  f("East African", "Snacks & drinks", "beef-samosa", "🥟", "Beef samosa", ["sambusa", "samosa"], 260, 26, 8, 14, piece("samosa", 60, [2])),
  f("East African", "Snacks & drinks", "rolex", "🌯", "Rolex (chapati egg roll)", ["rolex"], 230, 22, 9, 12, piece("rolex", 250)),
  f("East African", "Snacks & drinks", "chai", "☕", "Chai (milk tea)", ["kenyan tea", "masala chai"], 60, 8, 2, 2, [{ label: "1 cup", grams: 250 }]),
];

const SOUTH_AFRICAN: Food[] = [
  f("South African", "Mains", "sa-pap", "🫓", "Pap (maize porridge)", ["mieliepap", "stywe pap", "phutu"], 110, 24, 2.5, 0.5, [{ label: "1 serving", grams: 250 }, { label: "Large serving", grams: 350 }]),
  f("South African", "Mains", "bobotie", "🥘", "Bobotie", ["bobotie"], 170, 8, 12, 10, plate(300)),
  f("South African", "Mains", "bunny-chow", "🍞", "Bunny chow", ["bunny", "kota"], 210, 24, 9, 9, [{ label: "Quarter loaf", grams: 450 }, { label: "Half loaf", grams: 800 }]),
  f("South African", "Mains", "samp-beans", "🫘", "Samp and beans", ["umngqusho"], 125, 23, 6, 1, plate(300)),
  f("South African", "Braai & meat", "boerewors", "🌭", "Boerewors", ["wors", "sausage"], 280, 3, 15, 23, [{ label: "1 piece (100g)", grams: 100 }, { label: "2 pieces", grams: 200 }]),
  f("South African", "Braai & meat", "braai-chicken", "🍗", "Braai chicken", ["grilled chicken"], 200, 0, 25, 11, [{ label: "1 piece", grams: 120 }, { label: "2 pieces", grams: 240 }]),
  f("South African", "Braai & meat", "biltong", "🥓", "Biltong", ["dried meat", "droewors"], 300, 2, 55, 8, [{ label: "Small pack", grams: 30 }, { label: "1 pack", grams: 60 }]),
  f("South African", "Snacks & sides", "chakalaka", "🥫", "Chakalaka", ["relish"], 70, 9, 2, 3, [{ label: "1 serving", grams: 150 }]),
  f("South African", "Snacks & sides", "vetkoek", "🍞", "Vetkoek", ["fat cake", "magwinya"], 330, 40, 7, 16, piece("vetkoek", 90)),
  f("South African", "Snacks & sides", "koeksister", "🥨", "Koeksister", ["koesister"], 420, 55, 4, 20, piece("piece", 50)),
  f("South African", "Snacks & sides", "rusk", "🍪", "Rusks", ["beskuit", "ouma rusks"], 420, 65, 9, 14, piece("rusk", 35, [2])),
  f("South African", "Snacks & sides", "malva", "🍮", "Malva pudding", ["malva"], 330, 47, 4, 15, [{ label: "1 portion", grams: 120 }]),
];

const CARIBBEAN: Food[] = [
  f("Caribbean", "Mains", "jerk-chicken", "🍗", "Jerk chicken", ["jerk"], 190, 3, 25, 9, [{ label: "1 piece", grams: 120 }, { label: "Quarter chicken", grams: 250 }]),
  f("Caribbean", "Mains", "curry-goat", "🍛", "Curry goat", ["curried goat", "curry mutton"], 160, 4, 18, 8, bowl(250)),
  f("Caribbean", "Mains", "ackee-saltfish", "🍳", "Ackee and saltfish", ["ackee"], 180, 5, 12, 13, plate(250)),
  f("Caribbean", "Mains", "oxtail", "🍲", "Oxtail stew", ["stewed oxtail"], 200, 4, 18, 13, bowl(250)),
  f("Caribbean", "Mains", "trini-roti", "🌯", "Roti wrap with curry", ["dhalpuri", "buss up shut"], 220, 25, 8, 10, piece("roti wrap", 350)),
  f("Caribbean", "Sides", "rice-peas", "🍚", "Rice and peas", ["rice & peas"], 160, 27, 4.5, 4, plate(250)),
  f("Caribbean", "Sides", "callaloo", "🥬", "Callaloo", ["callaloo greens"], 60, 5, 3, 3, [{ label: "1 serving", grams: 150 }]),
  f("Caribbean", "Sides", "festival", "🥖", "Festival (fried dumpling)", ["festival", "fried dumpling"], 330, 50, 5, 12, piece("festival", 70, [2])),
  f("Caribbean", "Sides", "bammy", "🫓", "Bammy", ["cassava flatbread"], 210, 50, 1, 0.5, piece("bammy", 100)),
  f("Caribbean", "Snacks & drinks", "patty", "🥟", "Jamaican beef patty", ["patty", "beef patty"], 290, 28, 8, 16, piece("patty", 140)),
  f("Caribbean", "Snacks & drinks", "doubles", "🌮", "Doubles", ["doubles"], 250, 32, 8, 10, [{ label: "1 doubles", grams: 120 }, { label: "2 doubles", grams: 240 }]),
  f("Caribbean", "Snacks & drinks", "sorrel", "🥤", "Sorrel drink", ["sorrel"], 45, 11, 0, 0, [{ label: "1 glass", grams: 250 }]),
];

const RUSSIAN: Food[] = [
  f("Russian", "Soups", "borscht", "🍲", "Borscht", ["borsch", "beetroot soup"], 50, 6, 2, 2, bowl(350)),
  f("Russian", "Soups", "shchi", "🍲", "Shchi (cabbage soup)", ["cabbage soup"], 40, 4, 2, 2, bowl(350)),
  f("Russian", "Soups", "solyanka", "🍲", "Solyanka", ["selyanka"], 75, 3, 5, 5, bowl(350)),
  f("Russian", "Mains", "pelmeni", "🥟", "Pelmeni", ["dumplings", "pelmeni with sour cream"], 250, 30, 11, 9, [{ label: "10 pieces", grams: 150 }, { label: "20 pieces", grams: 300 }]),
  f("Russian", "Mains", "vareniki", "🥟", "Vareniki (potato)", ["varenyky", "pierogi"], 200, 34, 5, 5, [{ label: "10 pieces", grams: 150 }, { label: "20 pieces", grams: 300 }]),
  f("Russian", "Mains", "stroganoff", "🍛", "Beef stroganoff", ["stroganov"], 170, 5, 14, 11, plate(250)),
  f("Russian", "Mains", "plov", "🍛", "Plov", ["pilaf", "osh"], 190, 25, 7, 7, plate(300)),
  f("Russian", "Breakfast & bakery", "grechka", "🥣", "Buckwheat kasha", ["grechka", "buckwheat"], 100, 20, 3.5, 1, bowl(250)),
  f("Russian", "Breakfast & bakery", "syrniki", "🥞", "Syrniki", ["cottage cheese pancakes"], 220, 20, 14, 9, [{ label: "2 pieces", grams: 120 }, { label: "3 pieces", grams: 180 }]),
  f("Russian", "Breakfast & bakery", "blini", "🥞", "Blini", ["bliny", "crepes"], 225, 28, 6, 10, [{ label: "1 blin", grams: 50 }, { label: "3 blini", grams: 150 }]),
  f("Russian", "Breakfast & bakery", "pirozhki", "🥐", "Pirozhki (meat)", ["pirozhok", "piroshki"], 260, 32, 9, 11, [{ label: "1 pirozhok", grams: 80 }, { label: "2 pirozhki", grams: 160 }]),
  f("Russian", "Breakfast & bakery", "rye-bread", "🍞", "Rye bread", ["black bread", "borodinsky"], 250, 48, 8.5, 3.3, [{ label: "1 slice", grams: 35 }, { label: "2 slices", grams: 70 }]),
  f("Russian", "Salads & sides", "olivier", "🥗", "Olivier salad", ["russian salad", "olivye"], 200, 8, 5, 16, bowl(200)),
  f("Russian", "Salads & sides", "shuba", "🥗", "Herring under a fur coat", ["shuba", "selyodka pod shuboy"], 190, 8, 6, 15, bowl(200)),
  f("Russian", "Salads & sides", "kefir", "🥛", "Kefir", ["kefir drink"], 55, 4, 3, 3, [{ label: "1 glass", grams: 250 }]),
];

const INDIAN: Food[] = [
  f("Indian", "Curries", "dal", "🍲", "Dal tadka", ["dal", "dhal", "lentil curry"], 120, 15, 6, 4, bowl(250)),
  f("Indian", "Curries", "chana-masala", "🍛", "Chana masala", ["chole", "chickpea curry"], 140, 18, 7, 5, bowl(250)),
  f("Indian", "Curries", "butter-chicken", "🍛", "Butter chicken", ["murgh makhani"], 160, 5, 13, 10, bowl(250)),
  f("Indian", "Curries", "palak-paneer", "🥬", "Palak paneer", ["saag paneer"], 150, 6, 7, 11, bowl(250)),
  f("Indian", "Curries", "rajma", "🫘", "Rajma", ["kidney bean curry"], 125, 17, 6, 3.5, bowl(250)),
  f("Indian", "Rice & breads", "biryani", "🍛", "Chicken biryani", ["biryani", "biriyani"], 180, 23, 8, 6, plate(300)),
  f("Indian", "Rice & breads", "basmati", "🍚", "Basmati rice (boiled)", ["basmati", "steamed rice"], 130, 28, 2.7, 0.3, [{ label: "1 cup", grams: 160 }, { label: "1 plate", grams: 300 }]),
  f("Indian", "Rice & breads", "roti", "🫓", "Roti", ["chapati", "phulka"], 300, 46, 9, 8, piece("roti", 40, [2, 4])),
  f("Indian", "Rice & breads", "naan", "🫓", "Naan", ["butter naan", "garlic naan"], 290, 50, 9, 6, piece("naan", 90)),
  f("Indian", "Breakfast", "masala-dosa", "🌯", "Masala dosa", ["dosa"], 165, 25, 4, 5, piece("dosa", 200)),
  f("Indian", "Breakfast", "idli", "🍘", "Idli", ["idli sambar"], 130, 26, 4, 0.5, [{ label: "2 idli", grams: 80 }, { label: "4 idli", grams: 160 }]),
  f("Indian", "Breakfast", "poha", "🥣", "Poha", ["flattened rice"], 130, 22, 3, 3.5, bowl(200)),
  f("Indian", "Snacks & drinks", "veg-samosa", "🥟", "Vegetable samosa", ["samosa", "aloo samosa"], 260, 30, 5, 13, piece("samosa", 70, [2])),
  f("Indian", "Snacks & drinks", "pakora", "🧆", "Pakora", ["bhaji", "pakoda"], 290, 25, 7, 18, [{ label: "5 pieces", grams: 100 }]),
  f("Indian", "Snacks & drinks", "masala-chai", "☕", "Masala chai", ["chai", "tea"], 50, 7, 1.6, 1.7, [{ label: "1 cup", grams: 200 }]),
];

const CHINESE: Food[] = [
  f("Chinese", "Rice & noodles", "steamed-rice", "🍚", "Steamed white rice", ["rice"], 130, 28, 2.7, 0.3, bowl(200)),
  f("Chinese", "Rice & noodles", "chow-mein", "🍜", "Chow mein", ["lo mein", "fried noodles"], 160, 22, 6, 5.5, plate(300)),
  f("Chinese", "Rice & noodles", "congee", "🥣", "Congee", ["jook", "rice porridge"], 50, 10, 1.5, 0.5, bowl(350)),
  f("Chinese", "Mains", "kung-pao", "🌶️", "Kung pao chicken", ["gong bao chicken"], 180, 8, 14, 10, plate(250)),
  f("Chinese", "Mains", "sweet-sour-pork", "🍖", "Sweet and sour pork", ["sweet and sour"], 230, 22, 10, 11, plate(250)),
  f("Chinese", "Mains", "mapo-tofu", "🍲", "Mapo tofu", ["tofu"], 120, 4, 7, 8, bowl(250)),
  f("Chinese", "Mains", "beef-broccoli", "🥦", "Beef with broccoli", ["beef and broccoli"], 115, 6, 10, 5.5, plate(250)),
  f("Chinese", "Mains", "peking-duck", "🦆", "Peking duck", ["roast duck"], 340, 3, 19, 28, [{ label: "Small portion", grams: 100 }, { label: "1 portion", grams: 200 }]),
  f("Chinese", "Dim sum & snacks", "jiaozi", "🥟", "Dumplings (jiaozi)", ["dumplings", "potstickers", "gyoza"], 220, 25, 9, 9, [{ label: "6 pieces", grams: 150 }, { label: "12 pieces", grams: 300 }]),
  f("Chinese", "Dim sum & snacks", "bao", "🥟", "Bao bun (pork)", ["baozi", "char siu bao"], 250, 35, 9, 8, piece("bun", 90, [2])),
  f("Chinese", "Dim sum & snacks", "spring-rolls", "🥢", "Spring rolls", ["egg rolls"], 250, 28, 5, 13, [{ label: "2 rolls", grams: 100 }, { label: "4 rolls", grams: 200 }]),
  f("Chinese", "Dim sum & snacks", "hot-sour-soup", "🍲", "Hot and sour soup", ["suan la tang"], 40, 4, 3, 1.5, bowl(300)),
];

const NIGERIAN: Food[] = [
  { id: "eba", cuisine: "Nigerian", category: "Swallow", emoji: "🫓", name: "Eba", aliases: ["garri", "gari"], kcal: 160, carbs: 38, protein: 0.5, fat: 0.3, portions: wraps, source: SAMPLE },
  { id: "amala", cuisine: "Nigerian", category: "Swallow", emoji: "🫓", name: "Amala", aliases: ["yam flour", "elubo"], kcal: 130, carbs: 31, protein: 1.5, fat: 0.2, portions: wraps, source: SAMPLE },
  { id: "pounded-yam", cuisine: "Nigerian", category: "Swallow", emoji: "🫓", name: "Pounded yam", aliases: ["iyan", "poundo"], kcal: 150, carbs: 35, protein: 1.5, fat: 0.2, portions: wraps, source: SAMPLE },
  { id: "jollof", cuisine: "Nigerian", category: "Rice & grains", emoji: "🍛", name: "Jollof rice", aliases: ["party rice"], kcal: 160, carbs: 26, protein: 3, fat: 5, portions: riceSpoons, source: SAMPLE },
  { id: "white-rice", cuisine: "Nigerian", category: "Rice & grains", emoji: "🍚", name: "White rice (boiled)", aliases: ["rice"], kcal: 130, carbs: 28, protein: 2.7, fat: 0.3, portions: riceSpoons, source: SAMPLE },
  { id: "ofada", cuisine: "Nigerian", category: "Rice & grains", emoji: "🍚", name: "Ofada rice (boiled)", aliases: ["local rice"], kcal: 125, carbs: 26, protein: 3, fat: 1, portions: riceSpoons, source: SAMPLE },
  { id: "beans", cuisine: "Nigerian", category: "Beans", emoji: "🫘", name: "Beans (stewed)", aliases: ["ewa", "porridge beans"], kcal: 140, carbs: 20, protein: 8, fat: 3,
    portions: [{ label: "1 cooking spoon", grams: 80 }, { label: "2 cooking spoons", grams: 160 }, { label: "1 plate", grams: 300 }], source: SAMPLE },
  { id: "moimoi", cuisine: "Nigerian", category: "Beans", emoji: "🫘", name: "Moi moi", aliases: ["moin moin", "bean pudding"], kcal: 150, carbs: 12, protein: 8, fat: 8,
    portions: [{ label: "Half wrap", grams: 75 }, { label: "1 wrap / leaf", grams: 150 }], source: SAMPLE },
  { id: "akara", cuisine: "Nigerian", category: "Beans", emoji: "🧆", name: "Akara", aliases: ["bean cake", "kosai"], kcal: 280, carbs: 18, protein: 10, fat: 18,
    portions: [{ label: "1 ball", grams: 25 }, { label: "3 balls", grams: 75 }, { label: "5 balls", grams: 125 }], source: SAMPLE },
  { id: "dodo", cuisine: "Nigerian", category: "Snacks & drinks", emoji: "🍌", name: "Fried plantain (dodo)", aliases: ["plantain", "dodo"], kcal: 230, carbs: 38, protein: 1, fat: 9,
    portions: [{ label: "5 pieces", grams: 75 }, { label: "10 pieces", grams: 150 }], source: SAMPLE },
  { id: "egusi", cuisine: "Nigerian", category: "Soups", emoji: "🍲", name: "Egusi soup", aliases: ["melon soup"], kcal: 250, carbs: 6, protein: 10, fat: 21, portions: soup, source: SAMPLE },
  { id: "efo", cuisine: "Nigerian", category: "Soups", emoji: "🥬", name: "Efo riro", aliases: ["vegetable soup", "spinach stew"], kcal: 120, carbs: 5, protein: 6, fat: 9, portions: soup, source: SAMPLE },
  { id: "okra", cuisine: "Nigerian", category: "Soups", emoji: "🍲", name: "Okra soup", aliases: ["okro", "ila"], kcal: 70, carbs: 6, protein: 4, fat: 3, portions: soup, source: SAMPLE },
  { id: "ogbono", cuisine: "Nigerian", category: "Soups", emoji: "🍲", name: "Ogbono soup", aliases: ["draw soup", "apon"], kcal: 230, carbs: 7, protein: 8, fat: 19, portions: soup, source: SAMPLE },
  { id: "beef", cuisine: "Nigerian", category: "Protein", emoji: "🥩", name: "Beef (stewed)", aliases: ["meat"], kcal: 250, carbs: 0, protein: 26, fat: 16,
    portions: [{ label: "Small piece", grams: 30 }, { label: "Medium piece", grams: 50 }, { label: "Large piece", grams: 80 }], source: SAMPLE },
  { id: "chicken", cuisine: "Nigerian", category: "Protein", emoji: "🍗", name: "Chicken (stewed)", aliases: ["fowl"], kcal: 220, carbs: 0, protein: 25, fat: 13,
    portions: [{ label: "Small piece", grams: 60 }, { label: "Medium piece", grams: 100 }, { label: "Large piece", grams: 150 }], source: SAMPLE },
  { id: "fish", cuisine: "Nigerian", category: "Protein", emoji: "🐟", name: "Fish (stewed, e.g. titus)", aliases: ["mackerel", "titus", "eja"], kcal: 200, carbs: 0, protein: 22, fat: 12,
    portions: [{ label: "Small piece", grams: 60 }, { label: "Medium piece", grams: 100 }], source: SAMPLE },
  { id: "suya", cuisine: "Nigerian", category: "Protein", emoji: "🍢", name: "Suya", aliases: ["kebab", "beef suya"], kcal: 260, carbs: 4, protein: 28, fat: 15,
    portions: [{ label: "1 stick", grams: 50 }, { label: "₦1,000 wrap", grams: 120 }], source: SAMPLE },
  { id: "bread", cuisine: "Nigerian", category: "Rice & grains", emoji: "🍞", name: "Bread (white)", aliases: ["agege bread", "loaf"], kcal: 265, carbs: 49, protein: 9, fat: 3,
    portions: [{ label: "1 slice", grams: 30 }, { label: "2 slices", grams: 60 }, { label: "4 slices", grams: 120 }], source: SAMPLE },
  { id: "pap", cuisine: "Nigerian", category: "Cereals & porridge", emoji: "🥣", name: "Pap (ogi / akamu)", aliases: ["ogi", "akamu", "koko"], kcal: 50, carbs: 11, protein: 0.5, fat: 0.3,
    portions: [{ label: "1 cup", grams: 250 }, { label: "1 bowl", grams: 400 }], source: SAMPLE },
  { id: "groundnut", cuisine: "Nigerian", category: "Snacks & drinks", emoji: "🥜", name: "Groundnuts (roasted)", aliases: ["peanuts", "epa"], kcal: 585, carbs: 21, protein: 24, fat: 50,
    portions: [{ label: "1 small pack", grams: 30 }, { label: "1 handful", grams: 40 }], source: SAMPLE },
  { id: "indomie", cuisine: "Nigerian", category: "Rice & grains", emoji: "🍜", name: "Instant noodles (cooked)", aliases: ["indomie", "noodles"], kcal: 190, carbs: 26, protein: 4, fat: 8,
    portions: [{ label: "1 pack (cooked)", grams: 200 }, { label: "2 packs (cooked)", grams: 400 }], source: SAMPLE },
  { id: "zobo", cuisine: "Nigerian", category: "Snacks & drinks", emoji: "🥤", name: "Zobo (sweetened)", aliases: ["hibiscus drink", "sobo"], kcal: 45, carbs: 11, protein: 0, fat: 0,
    portions: [{ label: "1 cup", grams: 250 }, { label: "1 bottle (35cl)", grams: 350 }], source: SAMPLE },
  { id: "tea", cuisine: "Nigerian", category: "Snacks & drinks", emoji: "☕", name: "Tea with milk & sugar", aliases: ["tea", "lipton"], kcal: 40, carbs: 6, protein: 1, fat: 1.5,
    portions: [{ label: "1 cup", grams: 250 }], source: SAMPLE },
  { id: "egg", cuisine: "Nigerian", category: "Protein", emoji: "🥚", name: "Egg (boiled)", aliases: ["eggs"], kcal: 155, carbs: 1, protein: 13, fat: 11,
    portions: [{ label: "1 egg", grams: 50 }, { label: "2 eggs", grams: 100 }], source: SAMPLE },  { id: "golden-morn", cuisine: "Nigerian", category: "Cereals & porridge", emoji: "🥣", name: "Golden Morn with milk", aliases: ["golden morn", "maize cereal"], kcal: 92, carbs: 15, protein: 3.5, fat: 2,
    portions: [{ label: "Small bowl", grams: 200 }, { label: "1 bowl", grams: 300 }], source: SAMPLE },
  { id: "cornflakes", cuisine: "Nigerian", category: "Cereals & porridge", emoji: "🥣", name: "Cornflakes with milk", aliases: ["corn flakes", "nasco cornflakes", "kellogg's"], kcal: 85, carbs: 14, protein: 3.3, fat: 1.8,
    portions: [{ label: "Small bowl", grams: 200 }, { label: "1 bowl", grams: 300 }], source: SAMPLE },
  { id: "custard", cuisine: "Nigerian", category: "Cereals & porridge", emoji: "🥣", name: "Custard with milk & sugar", aliases: ["custard pap"], kcal: 78, carbs: 13, protein: 2.5, fat: 1.8,
    portions: [{ label: "1 cup", grams: 250 }, { label: "1 bowl", grams: 400 }], source: SAMPLE },
  { id: "quaker-oats", cuisine: "Nigerian", category: "Cereals & porridge", emoji: "🥣", name: "Quaker oats with milk", aliases: ["quaker", "oat porridge"], kcal: 84, carbs: 12, protein: 3.5, fat: 2.5,
    portions: [{ label: "Small bowl", grams: 200 }, { label: "1 bowl", grams: 300 }], source: SAMPLE },
  { id: "tom-brown", cuisine: "Nigerian", category: "Cereals & porridge", emoji: "🥣", name: "Tom brown with milk & sugar", aliases: ["tombrown", "guinea corn & soy porridge"], kcal: 94, carbs: 14, protein: 4, fat: 2.5,
    portions: [{ label: "1 cup", grams: 250 }, { label: "1 bowl", grams: 400 }], source: SAMPLE },
  { id: "weetabix", cuisine: "Nigerian", category: "Cereals & porridge", emoji: "🥣", name: "Weetabix with milk", aliases: ["wheat biscuits"], kcal: 86, carbs: 13, protein: 4, fat: 2,
    portions: [{ label: "2 biscuits + milk", grams: 200 }, { label: "3 biscuits + milk", grams: 280 }], source: SAMPLE },
  { id: "choco-cereal", cuisine: "Nigerian", category: "Cereals & porridge", emoji: "🥣", name: "Chocolate cereal with milk", aliases: ["coco pops", "chocos", "chocolate flakes"], kcal: 99, carbs: 17, protein: 3.3, fat: 2,
    portions: [{ label: "Small bowl", grams: 200 }, { label: "1 bowl", grams: 300 }], source: SAMPLE },
  { id: "acha", cuisine: "Nigerian", category: "Cereals & porridge", emoji: "🥣", name: "Acha porridge (fonio)", aliases: ["fonio", "acha"], kcal: 71, carbs: 15, protein: 1.8, fat: 0.4,
    portions: [{ label: "1 cup", grams: 250 }, { label: "1 bowl", grams: 400 }], source: SAMPLE },
  { id: "millet-pap", cuisine: "Nigerian", category: "Cereals & porridge", emoji: "🥣", name: "Millet pap (koko)", aliases: ["gero", "hausa koko", "millet porridge"], kcal: 60, carbs: 12, protein: 1.6, fat: 0.6,
    portions: [{ label: "1 cup", grams: 250 }, { label: "1 bowl", grams: 400 }], source: SAMPLE },
  { id: "semo", cuisine: "Nigerian", category: "Swallow", emoji: "🫓", name: "Semo", aliases: ["semovita", "semolina"], kcal: 152, carbs: 33, protein: 4, fat: 0.5,
    portions: wraps, source: SAMPLE },
  { id: "fufu", cuisine: "Nigerian", category: "Swallow", emoji: "🫓", name: "Fufu (akpu)", aliases: ["akpu", "cassava fufu", "loi loi"], kcal: 145, carbs: 35, protein: 0.5, fat: 0.3,
    portions: wraps, source: SAMPLE },
  { id: "wheat", cuisine: "Nigerian", category: "Swallow", emoji: "🫓", name: "Wheat swallow", aliases: ["wheat meal"], kcal: 143, carbs: 30, protein: 4, fat: 0.8,
    portions: wraps, source: SAMPLE },
  { id: "tuwo", cuisine: "Nigerian", category: "Swallow", emoji: "🫓", name: "Tuwo shinkafa", aliases: ["tuwo", "rice swallow"], kcal: 125, carbs: 28, protein: 2.5, fat: 0.3,
    portions: wraps, source: SAMPLE },
  { id: "starch", cuisine: "Nigerian", category: "Swallow", emoji: "🫓", name: "Starch (usi)", aliases: ["usi", "banga starch"], kcal: 131, carbs: 32, protein: 0.3, fat: 0.2,
    portions: wraps, source: SAMPLE },
  { id: "fried-rice", cuisine: "Nigerian", category: "Rice & grains", emoji: "🍛", name: "Nigerian fried rice", aliases: ["party fried rice"], kcal: 166, carbs: 24, protein: 4, fat: 6,
    portions: riceSpoons, source: SAMPLE },
  { id: "coconut-rice", cuisine: "Nigerian", category: "Rice & grains", emoji: "🍛", name: "Coconut rice", aliases: ["coconut jollof"], kcal: 175, carbs: 25, protein: 3, fat: 7,
    portions: riceSpoons, source: SAMPLE },
  { id: "rice-beans", cuisine: "Nigerian", category: "Rice & grains", emoji: "🍛", name: "Rice & beans", aliases: ["rice and beans"], kcal: 134, carbs: 24, protein: 5, fat: 2,
    portions: riceSpoons, source: SAMPLE },
  { id: "jollof-spaghetti", cuisine: "Nigerian", category: "Rice & grains", emoji: "🍝", name: "Jollof spaghetti", aliases: ["spaghetti jollof", "jollof pasta"], kcal: 156, carbs: 25, protein: 5, fat: 4,
    portions: plate(300), source: SAMPLE },
  { id: "masa", cuisine: "Nigerian", category: "Rice & grains", emoji: "🥞", name: "Masa (waina)", aliases: ["waina", "rice cakes"], kcal: 190, carbs: 30, protein: 4, fat: 6,
    portions: [{ label: "2 pieces", grams: 100 }, { label: "4 pieces", grams: 200 }], source: SAMPLE },
  { id: "corn", cuisine: "Nigerian", category: "Rice & grains", emoji: "🌽", name: "Corn on the cob (boiled or roasted)", aliases: ["agbado", "roasted corn", "boiled corn", "maize"], kcal: 127, carbs: 25, protein: 3.3, fat: 1.5,
    portions: [{ label: "1 cob", grams: 100 }, { label: "2 cobs", grams: 200 }], source: SAMPLE },
  { id: "boiled-yam", cuisine: "Nigerian", category: "Yam & plantain", emoji: "🍠", name: "Boiled yam", aliases: ["isu", "yam"], kcal: 116, carbs: 27, protein: 1.5, fat: 0.2,
    portions: [{ label: "2 slices", grams: 150 }, { label: "3 slices", grams: 225 }, { label: "4 slices", grams: 300 }], source: SAMPLE },
  { id: "fried-yam", cuisine: "Nigerian", category: "Yam & plantain", emoji: "🍠", name: "Fried yam (dundun)", aliases: ["dundun", "yam chips"], kcal: 208, carbs: 30, protein: 1.7, fat: 9,
    portions: [{ label: "5 pieces", grams: 100 }, { label: "10 pieces", grams: 200 }], source: SAMPLE },
  { id: "yam-porridge", cuisine: "Nigerian", category: "Yam & plantain", emoji: "🍲", name: "Yam porridge (asaro)", aliases: ["asaro", "yam pottage"], kcal: 124, carbs: 20, protein: 2, fat: 4,
    portions: plate(300), source: SAMPLE },
  { id: "plantain-porridge", cuisine: "Nigerian", category: "Yam & plantain", emoji: "🍲", name: "Plantain porridge", aliases: ["plantain pottage"], kcal: 130, carbs: 22, protein: 1.5, fat: 4,
    portions: plate(300), source: SAMPLE },
  { id: "boiled-plantain", cuisine: "Nigerian", category: "Yam & plantain", emoji: "🍌", name: "Boiled plantain", aliases: ["unripe plantain"], kcal: 133, carbs: 31, protein: 1.3, fat: 0.4,
    portions: [{ label: "Half plantain", grams: 90 }, { label: "1 plantain", grams: 180 }], source: SAMPLE },
  { id: "boli", cuisine: "Nigerian", category: "Yam & plantain", emoji: "🍌", name: "Roasted plantain (boli)", aliases: ["boli", "bole"], kcal: 138, carbs: 32, protein: 1.3, fat: 0.5,
    portions: [{ label: "Half boli", grams: 90 }, { label: "1 boli", grams: 180 }], source: SAMPLE },
  { id: "gizdodo", cuisine: "Nigerian", category: "Yam & plantain", emoji: "🍌", name: "Gizdodo", aliases: ["gizzard and plantain"], kcal: 204, carbs: 15, protein: 9, fat: 12,
    portions: [{ label: "Small plate", grams: 150 }, { label: "1 plate", grams: 250 }], source: SAMPLE },
  { id: "stew", cuisine: "Nigerian", category: "Soups", emoji: "🍅", name: "Tomato stew", aliases: ["obe ata", "red stew"], kcal: 126, carbs: 7, protein: 2, fat: 10,
    portions: [{ label: "1 cooking spoon", grams: 60 }, { label: "2 cooking spoons", grams: 120 }], source: SAMPLE },
  { id: "banga", cuisine: "Nigerian", category: "Soups", emoji: "🍲", name: "Banga soup", aliases: ["ofe akwu", "palm nut soup"], kcal: 250, carbs: 6, protein: 7, fat: 22,
    portions: soup, source: SAMPLE },
  { id: "afang", cuisine: "Nigerian", category: "Soups", emoji: "🥬", name: "Afang soup", aliases: ["afang"], kcal: 164, carbs: 5, protein: 9, fat: 12,
    portions: soup, source: SAMPLE },
  { id: "edikaikong", cuisine: "Nigerian", category: "Soups", emoji: "🥬", name: "Edikaikong", aliases: ["edikang ikong", "edikaikong soup"], kcal: 177, carbs: 5, protein: 10, fat: 13,
    portions: soup, source: SAMPLE },
  { id: "oha", cuisine: "Nigerian", category: "Soups", emoji: "🥬", name: "Oha soup", aliases: ["ora soup", "ofe oha"], kcal: 182, carbs: 6, protein: 8, fat: 14,
    portions: soup, source: SAMPLE },
  { id: "bitterleaf", cuisine: "Nigerian", category: "Soups", emoji: "🥬", name: "Bitterleaf soup", aliases: ["onugbu", "ofe onugbu"], kcal: 173, carbs: 6, protein: 8, fat: 13,
    portions: soup, source: SAMPLE },
  { id: "nsala", cuisine: "Nigerian", category: "Soups", emoji: "🍲", name: "Nsala (white soup)", aliases: ["white soup", "ofe nsala"], kcal: 110, carbs: 4, protein: 10, fat: 6,
    portions: soup, source: SAMPLE },
  { id: "gbegiri", cuisine: "Nigerian", category: "Soups", emoji: "🍲", name: "Gbegiri", aliases: ["bean soup"], kcal: 109, carbs: 10, protein: 6, fat: 5,
    portions: soup, source: SAMPLE },
  { id: "ewedu", cuisine: "Nigerian", category: "Soups", emoji: "🥬", name: "Ewedu", aliases: ["jute leaf soup"], kcal: 29, carbs: 3, protein: 2, fat: 1,
    portions: soup, source: SAMPLE },
  { id: "pepper-soup", cuisine: "Nigerian", category: "Soups", emoji: "🍲", name: "Pepper soup (goat meat)", aliases: ["goat meat pepper soup", "catfish pepper soup", "point and kill"], kcal: 101, carbs: 2, protein: 12, fat: 5,
    portions: bowl(350), source: SAMPLE },
  { id: "ewa-agoyin", cuisine: "Nigerian", category: "Beans", emoji: "🫘", name: "Ewa agoyin", aliases: ["agoyin", "beans and sauce"], kcal: 173, carbs: 16, protein: 7, fat: 9,
    portions: [{ label: "1 cooking spoon", grams: 80 }, { label: "2 cooking spoons", grams: 160 }, { label: "1 plate", grams: 300 }], source: SAMPLE },
  { id: "goat-meat", cuisine: "Nigerian", category: "Protein", emoji: "🥩", name: "Goat meat", aliases: ["ewure", "mutton"], kcal: 144, carbs: 0, protein: 27, fat: 4,
    portions: [{ label: "Small piece", grams: 40 }, { label: "Medium piece", grams: 70 }, { label: "Large piece", grams: 100 }], source: SAMPLE },
  { id: "turkey", cuisine: "Nigerian", category: "Protein", emoji: "🍗", name: "Turkey (fried or stewed)", aliases: ["turkey wing"], kcal: 184, carbs: 0, protein: 28, fat: 8,
    portions: [{ label: "Small piece", grams: 80 }, { label: "Medium piece", grams: 120 }, { label: "Large piece", grams: 200 }], source: SAMPLE },
  { id: "fried-fish", cuisine: "Nigerian", category: "Protein", emoji: "🐟", name: "Fried fish (e.g. croaker)", aliases: ["croaker", "fried titus"], kcal: 190, carbs: 3, protein: 22, fat: 10,
    portions: [{ label: "Small piece", grams: 80 }, { label: "Medium piece", grams: 120 }], source: SAMPLE },
  { id: "ponmo", cuisine: "Nigerian", category: "Protein", emoji: "🥩", name: "Ponmo (cow skin)", aliases: ["kpomo", "cow skin"], kcal: 98, carbs: 0, protein: 20, fat: 2,
    portions: [{ label: "Small piece", grams: 30 }, { label: "Medium piece", grams: 50 }], source: SAMPLE },
  { id: "snail", cuisine: "Nigerian", category: "Protein", emoji: "🐌", name: "Snail (peppered)", aliases: ["igbin", "peppered snail"], kcal: 85, carbs: 2, protein: 16, fat: 1.4,
    portions: [{ label: "1 snail", grams: 40 }, { label: "3 snails", grams: 120 }], source: SAMPLE },
  { id: "asun", cuisine: "Nigerian", category: "Protein", emoji: "🍖", name: "Asun", aliases: ["spicy goat meat", "peppered goat meat"], kcal: 243, carbs: 2, protein: 25, fat: 15,
    portions: [{ label: "Small plate", grams: 100 }, { label: "1 plate", grams: 200 }], source: SAMPLE },
  { id: "nkwobi", cuisine: "Nigerian", category: "Protein", emoji: "🍲", name: "Nkwobi", aliases: ["cow foot", "isi ewu"], kcal: 246, carbs: 3, protein: 18, fat: 18,
    portions: bowl(250), source: SAMPLE },
  { id: "kilishi", cuisine: "Nigerian", category: "Protein", emoji: "🥓", name: "Kilishi", aliases: ["dried meat", "beef jerky"], kcal: 350, carbs: 10, protein: 55, fat: 10,
    portions: [{ label: "1 piece", grams: 20 }, { label: "1 pack", grams: 50 }], source: SAMPLE },
  { id: "puff-puff", cuisine: "Nigerian", category: "Snacks & drinks", emoji: "🍩", name: "Puff-puff", aliases: ["puff puff", "bofrot"], kcal: 339, carbs: 45, protein: 6, fat: 15,
    portions: [{ label: "1 ball", grams: 30 }, { label: "3 balls", grams: 90 }, { label: "5 balls", grams: 150 }], source: SAMPLE },
  { id: "chin-chin", cuisine: "Nigerian", category: "Snacks & drinks", emoji: "🍪", name: "Chin chin", aliases: ["chinchin"], kcal: 466, carbs: 60, protein: 7, fat: 22,
    portions: [{ label: "1 handful", grams: 30 }, { label: "Small pack", grams: 50 }], source: SAMPLE },
  { id: "meat-pie", cuisine: "Nigerian", category: "Snacks & drinks", emoji: "🥟", name: "Meat pie", aliases: ["meatpie"], kcal: 312, carbs: 35, protein: 7, fat: 16,
    portions: [{ label: "1 pie", grams: 150 }], source: SAMPLE },
  { id: "sausage-roll", cuisine: "Nigerian", category: "Snacks & drinks", emoji: "🥐", name: "Sausage roll", aliases: ["gala"], kcal: 340, carbs: 32, protein: 8, fat: 20,
    portions: [{ label: "1 roll", grams: 75 }], source: SAMPLE },
  { id: "doughnut", cuisine: "Nigerian", category: "Snacks & drinks", emoji: "🍩", name: "Doughnut", aliases: ["donut"], kcal: 384, carbs: 45, protein: 6, fat: 20,
    portions: [{ label: "1 doughnut", grams: 70 }], source: SAMPLE },
  { id: "buns", cuisine: "Nigerian", category: "Snacks & drinks", emoji: "🍞", name: "Buns", aliases: ["nigerian buns"], kcal: 390, carbs: 50, protein: 7, fat: 18,
    portions: [{ label: "1 bun", grams: 60 }, { label: "3 buns", grams: 180 }], source: SAMPLE },
  { id: "plantain-chips", cuisine: "Nigerian", category: "Snacks & drinks", emoji: "🍌", name: "Plantain chips", aliases: ["ipekere", "plantain crisps"], kcal: 500, carbs: 60, protein: 2, fat: 28,
    portions: [{ label: "Small pack", grams: 40 }, { label: "Large pack", grams: 80 }], source: SAMPLE },
  { id: "abacha", cuisine: "Nigerian", category: "Snacks & drinks", emoji: "🥗", name: "Abacha (African salad)", aliases: ["african salad", "abacha ncha"], kcal: 206, carbs: 25, protein: 4, fat: 10,
    portions: plate(250), source: SAMPLE },
  { id: "tiger-nuts", cuisine: "Nigerian", category: "Snacks & drinks", emoji: "🥜", name: "Tiger nuts", aliases: ["aya", "ofio"], kcal: 416, carbs: 45, protein: 5, fat: 24,
    portions: [{ label: "1 handful", grams: 30 }], source: SAMPLE },
  { id: "coconut", cuisine: "Nigerian", category: "Snacks & drinks", emoji: "🥥", name: "Coconut (fresh)", aliases: ["agbon"], kcal: 370, carbs: 15, protein: 3.3, fat: 33,
    portions: [{ label: "1 piece", grams: 40 }], source: SAMPLE },
  { id: "kunu", cuisine: "Nigerian", category: "Snacks & drinks", emoji: "🥤", name: "Kunu", aliases: ["kunun zaki", "kunu aya"], kcal: 52, carbs: 11, protein: 1, fat: 0.5,
    portions: [{ label: "1 cup", grams: 250 }, { label: "1 bottle (50cl)", grams: 500 }], source: SAMPLE },
  { id: "fura", cuisine: "Nigerian", category: "Snacks & drinks", emoji: "🥛", name: "Fura da nono", aliases: ["fura", "nono"], kcal: 80, carbs: 12, protein: 3.5, fat: 2,
    portions: [{ label: "1 cup", grams: 250 }, { label: "1 bowl", grams: 400 }], source: SAMPLE },
  { id: "malt-drink", cuisine: "Nigerian", category: "Snacks & drinks", emoji: "🍺", name: "Malt drink (e.g. Maltina)", aliases: ["maltina", "amstel malta", "malta guinness"], kcal: 50, carbs: 12, protein: 0.5, fat: 0,
    portions: [{ label: "1 can / bottle (33cl)", grams: 330 }], source: SAMPLE },
  { id: "soft-drink", cuisine: "Nigerian", category: "Snacks & drinks", emoji: "🥤", name: "Soft drink (e.g. Coke, Fanta)", aliases: ["coke", "fanta", "sprite", "pepsi", "soda"], kcal: 42, carbs: 10.6, protein: 0, fat: 0,
    portions: [{ label: "35cl bottle", grams: 350 }, { label: "50cl bottle", grams: 500 }], source: SAMPLE },
  { id: "chapman", cuisine: "Nigerian", category: "Snacks & drinks", emoji: "🍹", name: "Chapman", aliases: ["chapman drink"], kcal: 56, carbs: 14, protein: 0, fat: 0,
    portions: [{ label: "1 glass", grams: 300 }], source: SAMPLE },
  { id: "malt-cocoa", cuisine: "Nigerian", category: "Snacks & drinks", emoji: "☕", name: "Milo / Bournvita with milk", aliases: ["milo", "bournvita", "chocolate drink"], kcal: 76, carbs: 10, protein: 3.4, fat: 2.5,
    portions: [{ label: "1 cup", grams: 250 }], source: SAMPLE },
  { id: "banana", cuisine: "Nigerian", category: "Fruits", emoji: "🍌", name: "Banana", aliases: ["ogede"], kcal: 99, carbs: 23, protein: 1.1, fat: 0.3,
    portions: [{ label: "1 medium", grams: 120 }, { label: "2 medium", grams: 240 }], source: SAMPLE },
  { id: "orange", cuisine: "Nigerian", category: "Fruits", emoji: "🍊", name: "Orange", aliases: ["osan"], kcal: 52, carbs: 12, protein: 0.9, fat: 0.1,
    portions: [{ label: "1 orange", grams: 150 }], source: SAMPLE },
  { id: "pawpaw", cuisine: "Nigerian", category: "Fruits", emoji: "🍈", name: "Pawpaw", aliases: ["papaya"], kcal: 49, carbs: 11, protein: 0.5, fat: 0.3,
    portions: [{ label: "1 slice", grams: 150 }, { label: "2 slices", grams: 300 }], source: SAMPLE },
  { id: "watermelon", cuisine: "Nigerian", category: "Fruits", emoji: "🍉", name: "Watermelon", aliases: ["water melon"], kcal: 36, carbs: 8, protein: 0.6, fat: 0.2,
    portions: [{ label: "1 slice", grams: 280 }], source: SAMPLE },
  { id: "pineapple", cuisine: "Nigerian", category: "Fruits", emoji: "🍍", name: "Pineapple", aliases: ["ope oyinbo"], kcal: 55, carbs: 13, protein: 0.5, fat: 0.1,
    portions: [{ label: "1 slice", grams: 100 }, { label: "2 slices", grams: 200 }], source: SAMPLE },
  { id: "mango", cuisine: "Nigerian", category: "Fruits", emoji: "🥭", name: "Mango", aliases: ["mangoro"], kcal: 67, carbs: 15, protein: 0.8, fat: 0.4,
    portions: [{ label: "1 mango", grams: 200 }], source: SAMPLE },
  { id: "agbalumo", cuisine: "Nigerian", category: "Fruits", emoji: "🍊", name: "Agbalumo", aliases: ["udara", "african star apple"], kcal: 64, carbs: 14, protein: 1, fat: 0.5,
    portions: [{ label: "1 fruit", grams: 60 }, { label: "3 fruits", grams: 180 }], source: SAMPLE },
  { id: "garden-egg", cuisine: "Nigerian", category: "Fruits", emoji: "🍆", name: "Garden egg", aliases: ["anara", "igba"], kcal: 30, carbs: 6, protein: 1, fat: 0.2,
    portions: [{ label: "1 garden egg", grams: 60 }, { label: "3 garden eggs", grams: 180 }], source: SAMPLE },
];

export const FOODS: Food[] = [
  ...NIGERIAN, ...GHANAIAN, ...EAST_AFRICAN, ...SOUTH_AFRICAN, ...CONTINENTAL, ...MORE_WESTERN,
  ...CARIBBEAN, ...RUSSIAN, ...INDIAN, ...CHINESE, ...INTERNATIONAL,
];

/** Every cuisine, with the member's region's cuisines first. */
export function cuisineOrder(regionCuisines: Cuisine[]): Cuisine[] {
  return [...regionCuisines, ...CUISINES.map((c) => c.id).filter((c) => !regionCuisines.includes(c))];
}

/** Foods matching the query. With `preferred` cuisines, those come first (in that order). */
export function searchFoods(query: string, preferred: Cuisine[] = []): Food[] {
  const q = query.trim().toLowerCase();
  const found = q
    ? FOODS.filter((f) => f.name.toLowerCase().includes(q) || f.aliases.some((a) => a.toLowerCase().includes(q)))
    : FOODS;
  if (!preferred.length) return found;
  const rank = (c: Cuisine) => { const i = preferred.indexOf(c); return i < 0 ? preferred.length : i; };
  return [...found].sort((a, b) => rank(a.cuisine) - rank(b.cuisine));
}

export const RECIPE_PREFIX = "recipe:";

/** A recipe as a loggable food: 100 "g" = 1 serving, so the diary maths works unchanged. */
function recipeAsFood(r: Recipe): Food {
  return {
    id: RECIPE_PREFIX + r.id,
    name: r.name,
    cuisine: r.cuisine,
    category: "Recipe",
    emoji: r.emoji,
    aliases: ["recipe"],
    kcal: r.kcal,
    carbs: r.carbs,
    protein: r.protein,
    fat: r.fat,
    portions: [
      { label: "½ serving", grams: 50 },
      { label: "1 serving", grams: 100 },
      { label: "2 servings", grams: 200 },
    ],
    source: "Sample recipe – not for clinical use",
  };
}

/** A meal estimated from a photo: "custom:<kcal>:<carbs>:<protein>:<fat>:<name>", for one serving (100 "g" = 1 serving). */
export const CUSTOM_PREFIX = "custom:";
export interface CustomMeal { name: string; kcal: number; carbs: number; protein: number; fat: number }
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Problems with an estimated meal, or null if it can be logged. */
export function customMealProblem(m: CustomMeal): string | null {
  const name = m.name.trim();
  if (!name || name.length > 80) return "name must be 1-80 characters";
  if (!(m.kcal >= 1 && m.kcal <= 5000)) return "kcal must be between 1 and 5000";
  for (const [k, v] of [["carbs", m.carbs], ["protein", m.protein], ["fat", m.fat]] as const) if (!(v >= 0 && v <= 600)) return `${k} must be between 0 and 600 g`;
  return null;
}

export function customFoodId(m: CustomMeal): string {
  return `${CUSTOM_PREFIX}${Math.round(m.kcal)}:${round1(m.carbs)}:${round1(m.protein)}:${round1(m.fat)}:${encodeURIComponent(m.name.trim().slice(0, 80))}`;
}

function customFood(id: string): Food | undefined {
  const [kcal, carbs, protein, fat, ...rest] = id.slice(CUSTOM_PREFIX.length).split(":");
  let name: string;
  try { name = decodeURIComponent(rest.join(":")); } catch { return undefined; }
  const m = { name, kcal: Number(kcal), carbs: Number(carbs), protein: Number(protein), fat: Number(fat) };
  if (customMealProblem(m)) return undefined;
  return {
    id, name: m.name, cuisine: "International", category: "From a photo", emoji: "📷", aliases: [],
    kcal: m.kcal, carbs: m.carbs, protein: m.protein, fat: m.fat,
    portions: [{ label: "½ serving", grams: 50 }, { label: "1 serving", grams: 100 }],
    source: "Estimated from a photo by the AI coach",
  };
}

export function foodById(id: string): Food | undefined {
  if (id.startsWith(CUSTOM_PREFIX)) return customFood(id);
  if (id.startsWith(RECIPE_PREFIX)) {
    const r = recipeById(id.slice(RECIPE_PREFIX.length));
    return r ? recipeAsFood(r) : undefined;
  }
  return FOODS.find((f) => f.id === id);
}

export function nutrientsFor(food: Food, grams: number) {
  const k = grams / 100;
  return { kcal: food.kcal * k, carbs: food.carbs * k, protein: food.protein * k, fat: food.fat * k };
}

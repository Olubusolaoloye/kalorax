// Food photography from Wikimedia Commons (public domain or Creative Commons licences).
// Each entry is credited on the Photo credits page (/credits), as the licences require.
// Keys: food id, "recipe:<id>" or "article:<id>". Missing or broken photos fall back to the emoji.

export interface Photo {
  /** Wikimedia Commons file name (without the "File:" prefix). */
  file: string;
  author?: string;
  license?: string;
}

import { md5 } from "../lib/md5";

const P = (file: string, author?: string, license?: string): Photo => ({ file, author, license });

export const PHOTOS: Record<string, Photo> = {
  // Naija
  eba: P("Garri_(Eba)_and_Vegetable_soup.jpg", "Major Lyte", "CC BY-SA 4.0"),
  amala: P("Amala_ati_Ewedu_and_Ogunfe.png", undefined, "CC BY-SA 4.0"),
  "pounded-yam": P("Pounded_yam_and_melon_soup.jpg", "Bukky658", "CC BY-SA 4.0"),
  jollof: P("Jollof_rice_with_lettuce_salad.jpg", "Halima Waziri", "CC BY-SA 4.0"),
  "white-rice": P("White_rice_and_fried_plantain_with_boiled_egg_stew.png", "Bukky658", "CC BY-SA 4.0"),
  ofada: P("Ofada_Rice.jpg", "Ijeoma", "CC BY-SA 4.0"),
  beans: P("Brown_beans_and_yam_porridge.jpg", "Bukky658"),
  moimoi: P("Moi_moi_with_fresh_fish_and_boiled_egg.jpg", "Bukky658"),
  akara: P("Akara_balls.jpg", "Tesleemah"),
  dodo: P("Fried_plantains.jpg"),
  egusi: P("Egusi_soup_with_ponmo_and_beef.jpg", "Bukky658", "CC BY-SA 4.0"),
  efo: P("Efo_riro.jpg", "Bukky658", "CC BY-SA 4.0"),
  okra: P("Okro_soup_with_beef_and_Seafoods.jpg", "Bukky658", "CC BY-SA 4.0"),
  ogbono: P("Ogbono_Soup_served_with_eba.jpg", "Aderiqueza", "CC BY-SA 4.0"),
  beef: P("Beef_stew_(15707525894).jpg", undefined, "CC BY 2.0"),
  chicken: P("African_Chicken_Peanut_Stew_(37673757141).jpg", undefined, "CC BY-SA 2.0"),
  fish: P("Fried_Mackerel_-_by_Hafees_(2205793869).jpg", "Hafees"),
  suya: P("Nigerian_home_made_suya_and_sliced_onions.png", undefined, "CC BY-SA 4.0"),
  bread: P("Agege_Bread.jpg"),
  pap: P("Akamu_(Pap)_(Ogi)_(cropped).jpg"),
  groundnut: P("Roasted_groundnuts.jpg"),
  indomie: P("Indomie_jollof_with_fried_egg.jpg", "Salma kyari", "CC BY-SA 4.0"),
  zobo: P("Chilled_Zobo_drink.jpg", undefined, "CC BY-SA 4.0"),
  tea: P("Tea_and_Milk.jpeg", undefined, "CC BY-SA 3.0"),
  egg: P("Hard_boiled_egg.jpg"),

  // Continental
  "english-breakfast": P("Full_English_breakfast.jpg", "Joadl", "CC BY-SA 3.0 AT"),
  omelette: P("Omelette_de_verduras.jpg", undefined, "CC BY-SA 4.0"),
  pancakes: P("PancakesWithSyrup.jpg", "Renee Comet (National Cancer Institute)", "Public domain"),
  "french-toast": P("FrenchToast.JPG", "Jonathunder", "CC BY-SA 3.0"),
  "grilled-salmon": P("Grilled_plated_salmon_fillet.jpg", undefined, "CC0"),
  "steak-chips": P("Steak_frites.jpg", "LWY", "CC BY 2.0"),
  "roast-chicken": P("Roasted_chicken_and_potatoes.JPG", "Biso", "CC BY 3.0"),
  "fish-chips": P("Fish_and_chips.jpg", "Andrew Dunn", "CC BY-SA 2.0"),
  bolognese: P("Spaghetti_Bolognese_Lokal_K.jpg", "Superbass", "CC BY-SA 4.0"),
  lasagne: P("Lasagne_-_stonesoup.jpg", undefined, "CC BY 2.0"),
  alfredo: P("Chicken-alfredo.jpg", "Darubrub", "CC BY-SA 4.0"),
  caesar: P("Chicken_Caesar_salad_at_the_office.jpg", "JIP"),
  "greek-salad": P("Feta_salad.jpg", "Santeri Viinamäki", "CC BY-SA 4.0"),
  "cream-soup": P("Cream_of_wild_mushroom_soup.jpg", undefined, "CC BY 2.0"),
  mash: P("MashedPotatoes.jpg", "Renee Comet (National Cancer Institute)", "Public domain"),
  croissant: P("Croissant,_whole.jpg", "SKopp"),

  // International
  shawarma: P("Shawarma.png", undefined, "CC BY-SA 4.0"),
  burger: P("NCI_Visuals_Food_Hamburger.jpg", "National Cancer Institute", "Public domain"),
  pizza: P("Pepperoni_pizza.jpg", "Jon Sullivan", "Public domain"),
  "fried-chicken": P("Fried-Chicken-Set.jpg", "Evan-Amos"),
  fries: P("Fries_2.jpg", "Popo le Chien"),
  "chinese-fried-rice": P("Egg_Fried_rice.jpg", "Anna Ekambaram", "CC BY-SA 4.0"),
  "chicken-curry": P("Chicken_Curry_Rice.jpg", "Nilanjan Sasmal", "CC BY-SA 4.0"),
  sushi: P("Maki_Sushi_on_green_leaf_plate.jpg", undefined, "CC BY 2.0"),
  "pad-thai": P("Pad_Thai_en_Bangkok,_Tailandia_(23790424338).jpg", undefined, "CC BY 2.0"),
  ramen: P("Bowl_of_ramen.jpg", undefined, "CC BY 4.0"),
  "hummus-pita": P("Homemade_hummus_and_pita_01.jpg", undefined, "CC BY-SA 4.0"),
  falafel: P("Falafel_&_Hummus_Wrap_-_Lavash_2024-08-19.jpg", "Andy Li"),
  tacos: P("Tacos_de_bistec_adobado.jpg", undefined, "CC BY-SA 4.0"),
  burrito: P("Baja_Chicken_Burrito_with_chips_and_salsa,_Willy's_Mexicana_Grill,_Brookhaven.JPG"),
  oatmeal: P("Cooked_oatmeal_in_bowl_(low_angle).jpg", "Bodhi Peace"),
  "yoghurt-bowl": P("Yogurt_fruit_bowl.jpg", "Jumbocombo0811", "CC BY-SA 4.0"),
  poke: P("Our_favorite_quinoa_bowl_with_beef_and_lamb_plus_a_spicy_chicken_wrap!_SO_GOOD!_-TasteVERTS_(29322059930).jpg", "TasteVERTS", "CC BY 2.0"),

  // Recipes (reuse the closest dish photo where it's the same dish)
  "recipe:jollof-chicken": P("Jollof_rice_with_dodo.jpg"),
  "recipe:egusi-eba": P("Original_Nigerian_Egusi_soup_and_yellow_garri_(Eba).jpg", "PrincewillJohn25", "CC BY-SA 4.0"),
  "recipe:akara-pap": P("Fried_beans_cake_with_pap_and_milk.jpg", "Bukky658"),
  "recipe:beans-dodo": P("Beans_and_plantain.jpg", "Gani Ray"),
  "recipe:fruit-salad": P("Fruit_salad_(1).jpg", "National Cancer Institute", "Public domain"),

  // Articles
  "article:swallow-portions": P("Iyan_&_Efo-Riro_(7370530836).jpg", "Shardayyy"),
  "article:water-sachets": P("Sachet_Water_Seller.jpg", undefined, "CC BY-SA 4.0"),
  "article:salt-bp": P("Table_salt_with_salt_shaker_V1.jpg", "Poyraz 72", "CC BY-SA 4.0"),
  "article:fruit-veg": P("Mile_12_market_Lagos_Nigeria.jpg"),
  "article:iron-foods": P("Eba_and_Efo_riro_(Vegetable_Soup)_with_Fish.jpg", "Jide Charles", "CC BY-SA 4.0"),
  "article:eating-out": P("Shawarma_seller.jpg", "Jaderox7", "CC BY-SA 4.0"),
  "article:breakfast-ideas": P("Akara_na_Akamu_(Fried_Bean_cakes_and_Pap).jpg", "FOODIEAFRICAN", "CC BY-SA 4.0"),
  "article:food-labels": P("Nutrition-label.jpg", undefined, "Public domain"),
};

/** Recipes that are the same dish as a food reuse that food's photo. */
const RECIPE_TO_FOOD: Record<string, string> = {
  moimoi: "moimoi",
  "groundnut-banana": "groundnut",
  omelette: "omelette",
  "salmon-veg": "grilled-salmon",
  bolognese: "bolognese",
  shawarma: "shawarma",
  "curry-rice": "chicken-curry",
  oatmeal: "oatmeal",
  "yoghurt-berries": "yoghurt-bowl",
  "white-rice-stew": "white-rice",
  "ofada-stew": "ofada",
  "okra-eba": "okra",
  "efo-amala": "efo",
  "suya-salad": "suya",
  "bread-egg-tea": "bread",
  "french-toast-fruit": "french-toast",
  "chicken-salad": "caesar",
  "roast-chicken-veg": "roast-chicken",
  "chicken-bowl": "poke",
  "fried-rice-veg": "chinese-fried-rice",
  "hummus-veg": "hummus-pita",
};

/** No suitable openly licensed photo found yet: these show their emoji. */
export const EMOJI_ONLY = new Set([
  "recipe:pepper-soup", "recipe:yam-egg",
  // Nigerian dishes, cereals and fruits added without photos yet.
  "golden-morn", "cornflakes", "custard", "quaker-oats", "tom-brown", "weetabix", "choco-cereal", "acha",
  "millet-pap", "semo", "fufu", "wheat", "tuwo", "starch", "fried-rice", "coconut-rice",
  "rice-beans", "jollof-spaghetti", "masa", "corn", "boiled-yam", "fried-yam", "yam-porridge", "plantain-porridge",
  "boiled-plantain", "boli", "gizdodo", "stew", "banga", "afang", "edikaikong", "oha",
  "bitterleaf", "nsala", "gbegiri", "ewedu", "pepper-soup", "ewa-agoyin", "goat-meat", "turkey",
  "fried-fish", "ponmo", "snail", "asun", "nkwobi", "kilishi", "puff-puff", "chin-chin",
  "meat-pie", "sausage-roll", "doughnut", "buns", "plantain-chips", "abacha", "tiger-nuts", "coconut",
  "kunu", "fura", "malt-drink", "soft-drink", "chapman", "malt-cocoa", "banana", "orange",
  "pawpaw", "watermelon", "pineapple", "mango", "agbalumo", "garden-egg",
  // Dishes from other regions, added without photos yet.
  "bagel", "mac-cheese", "sandwich", "banku", "kenkey", "gh-fufu", "waakye", "gh-jollof", "light-soup", "groundnut-soup", "palm-nut-soup", "kontomire", "red-red", "grilled-tilapia", "shito", "kelewele", "sobolo", "ugali", "chapati", "pilau", "injera", "matoke", "sukuma-wiki", "nyama-choma", "githeri", "doro-wat", "mandazi", "beef-samosa", "rolex", "chai", "sa-pap", "bobotie", "bunny-chow", "samp-beans", "boerewors", "braai-chicken", "biltong", "chakalaka", "vetkoek", "koeksister", "rusk", "malva", "jerk-chicken", "curry-goat", "ackee-saltfish", "oxtail", "trini-roti", "rice-peas", "callaloo", "festival", "bammy", "patty", "doubles", "sorrel", "borscht", "shchi", "solyanka", "pelmeni", "vareniki", "stroganoff", "plov", "grechka", "syrniki", "blini", "pirozhki", "rye-bread", "olivier", "shuba", "kefir", "dal", "chana-masala", "butter-chicken", "palak-paneer", "rajma", "biryani", "basmati", "roti", "naan", "masala-dosa", "idli", "poha", "veg-samosa", "pakora", "masala-chai", "steamed-rice", "chow-mein", "congee", "kung-pao", "sweet-sour-pork", "mapo-tofu", "beef-broccoli", "peking-duck", "jiaozi", "bao", "spring-rolls", "hot-sour-soup",
]);

export function photoFor(key: string): Photo | undefined {
  if (PHOTOS[key]) return PHOTOS[key];
  if (key.startsWith("recipe:")) {
    const food = RECIPE_TO_FOOD[key.slice("recipe:".length)];
    return food ? PHOTOS[food] : undefined;
  }
  return undefined;
}

/** Wikimedia serves a resized thumbnail for this URL (it redirects to upload.wikimedia.org). */
export function photoUrl(p: Photo, width: number): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(p.file)}?width=${width}`;
}

/** Where Wikimedia stores the original file (no redirect): the path comes from the MD5 of its name. */
export function photoOriginalUrl(p: Photo): string {
  const h = md5(p.file);
  return `https://upload.wikimedia.org/wikipedia/commons/${h[0]}/${h.slice(0, 2)}/${encodeURIComponent(p.file)}`;
}

/**
 * The same photo through Netlify's Image CDN: resized, converted to AVIF or WebP (whichever the
 * browser supports) and cached near the visitor. Allowed sources are listed in netlify.toml.
 */
export function photoCdnUrl(p: Photo, width: number): string {
  return `/.netlify/images?url=${encodeURIComponent(photoOriginalUrl(p))}&w=${width}&q=70`;
}

/** Image URLs to try in order. The Image CDN only exists on Netlify, so local dev goes straight to Wikimedia. */
export function photoSources(p: Photo, width: number, onNetlify = import.meta.env.PROD): string[] {
  return onNetlify ? [photoCdnUrl(p, width), photoUrl(p, width)] : [photoUrl(p, width)];
}

export function photoPage(p: Photo): string {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(p.file)}`;
}

export function photoTitle(p: Photo): string {
  return p.file.replace(/_/g, " ").replace(/\.(jpe?g|png)$/i, "");
}

// Where a member eats: sets which cuisines come first in the food list, recipes and meal plans.
// Chosen at sign-up (pre-selected from the device's time zone) and changeable on the Me page.
import type { Cuisine } from "./foods";

export interface Region {
  id: string;
  label: string;
  flag: string;
  /** Cuisines shown first, in order. The rest follow. */
  cuisines: Cuisine[];
}

export const REGIONS: Region[] = [
  { id: "nigeria", label: "Nigeria", flag: "🇳🇬", cuisines: ["Nigerian", "Ghanaian", "International", "Continental"] },
  { id: "ghana", label: "Ghana", flag: "🇬🇭", cuisines: ["Ghanaian", "Nigerian", "International", "Continental"] },
  { id: "east-africa", label: "Kenya & East Africa", flag: "🇰🇪", cuisines: ["East African", "Indian", "International", "Continental"] },
  { id: "south-africa", label: "South Africa", flag: "🇿🇦", cuisines: ["South African", "Continental", "International", "Indian"] },
  { id: "uk-europe", label: "UK & Europe", flag: "🇪🇺", cuisines: ["Continental", "International", "Indian", "Chinese"] },
  { id: "north-america", label: "USA & Canada", flag: "🇺🇸", cuisines: ["Continental", "International", "Chinese", "Caribbean"] },
  { id: "caribbean", label: "Caribbean", flag: "🇯🇲", cuisines: ["Caribbean", "Continental", "International"] },
  { id: "russia", label: "Russia & Central Asia", flag: "🇷🇺", cuisines: ["Russian", "Continental", "International"] },
  { id: "india", label: "India & South Asia", flag: "🇮🇳", cuisines: ["Indian", "International", "Continental"] },
  { id: "east-asia", label: "China & East Asia", flag: "🇨🇳", cuisines: ["Chinese", "International", "Continental"] },
  { id: "middle-east", label: "Middle East", flag: "🇦🇪", cuisines: ["International", "Indian", "Continental"] },
  { id: "other", label: "Somewhere else", flag: "🌍", cuisines: ["International", "Continental"] },
];

/** Profiles made before regions existed were all in Nigeria. */
export const DEFAULT_REGION = "nigeria";

export const isRegion = (id: string) => REGIONS.some((r) => r.id === id);
export const regionById = (id: string | undefined): Region => REGIONS.find((r) => r.id === id) ?? REGIONS.find((r) => r.id === DEFAULT_REGION)!;

const TZ: Array<[RegExp, string]> = [
  [/^Africa\/Lagos$/, "nigeria"],
  [/^Africa\/Accra$/, "ghana"],
  [/^Africa\/(Nairobi|Kampala|Dar_es_Salaam|Addis_Ababa|Kigali|Mogadishu|Djibouti|Asmara|Juba)$/, "east-africa"],
  [/^Africa\/(Johannesburg|Maseru|Mbabane|Gaborone|Windhoek|Harare|Maputo)$/, "south-africa"],
  [/^America\/(Jamaica|Port_of_Spain|Barbados|Nassau|Santo_Domingo|Port-au-Prince|Puerto_Rico|St_Lucia|Grenada|Antigua|Dominica|St_Kitts|St_Vincent|Guyana)$/, "caribbean"],
  [/^(Europe\/(Moscow|Minsk|Samara|Volgograd|Kirov|Ulyanovsk|Astrakhan|Saratov)|Asia\/(Almaty|Tashkent|Bishkek|Dushanbe|Ashgabat|Yekaterinburg|Novosibirsk|Omsk|Krasnoyarsk|Irkutsk|Vladivostok|Yakutsk|Baku|Tbilisi|Yerevan))$/, "russia"],
  [/^Asia\/(Kolkata|Calcutta|Karachi|Dhaka|Colombo|Kathmandu|Thimphu)$/, "india"],
  [/^Asia\/(Shanghai|Hong_Kong|Taipei|Tokyo|Seoul|Singapore|Macau|Manila|Bangkok|Ho_Chi_Minh|Jakarta|Kuala_Lumpur)$/, "east-asia"],
  [/^Asia\/(Dubai|Riyadh|Qatar|Kuwait|Bahrain|Muscat|Amman|Beirut|Baghdad|Damascus|Jerusalem|Tehran)$/, "middle-east"],
  [/^Africa\/(Cairo|Casablanca|Tunis|Algiers|Tripoli)$/, "middle-east"],
  [/^Africa\//, "nigeria"],
  [/^America\//, "north-america"],
  [/^Europe\//, "uk-europe"],
];

/** A best guess from the device's time zone; the member confirms or changes it. */
export function guessRegion(timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ""): string {
  for (const [re, id] of TZ) if (re.test(timeZone)) return id;
  return "other";
}

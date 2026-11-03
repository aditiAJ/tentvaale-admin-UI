/**
 * The 28 states and 8 union territories of India: the one list of states in this app. Nothing else defines one.
 *
 * The backend registry (`com.tentvaale.shared.IndianState`) is the source of truth: it decides what is valid and what
 * counts as the same state for GST. This is a static copy so a form can offer the list without a request (the
 * storefront sign-up page is signed out) and in mock mode; `indian-states.test.mjs` pins the 36 names, and when the
 * backend source is in the workspace it also checks this list against it. The storefront keeps an identical copy.
 *
 * The stored value is always the canonical `name`. The abbreviation and GST code are for matching and display.
 * GST codes were cross-checked between two published lists, not the GST portal itself.
 */
export interface IndianStateEntry {
  name: string;
  /** ISO 3166-2:IN. */
  abbreviation: string;
  /** The 2-digit GST state code. */
  gstCode: string;
  unionTerritory: boolean;
}

export const INDIAN_STATES: readonly IndianStateEntry[] = [
  { name: "Andhra Pradesh", abbreviation: "AP", gstCode: "37", unionTerritory: false },
  { name: "Arunachal Pradesh", abbreviation: "AR", gstCode: "12", unionTerritory: false },
  { name: "Assam", abbreviation: "AS", gstCode: "18", unionTerritory: false },
  { name: "Bihar", abbreviation: "BR", gstCode: "10", unionTerritory: false },
  { name: "Chhattisgarh", abbreviation: "CG", gstCode: "22", unionTerritory: false },
  { name: "Goa", abbreviation: "GA", gstCode: "30", unionTerritory: false },
  { name: "Gujarat", abbreviation: "GJ", gstCode: "24", unionTerritory: false },
  { name: "Haryana", abbreviation: "HR", gstCode: "06", unionTerritory: false },
  { name: "Himachal Pradesh", abbreviation: "HP", gstCode: "02", unionTerritory: false },
  { name: "Jharkhand", abbreviation: "JH", gstCode: "20", unionTerritory: false },
  { name: "Karnataka", abbreviation: "KA", gstCode: "29", unionTerritory: false },
  { name: "Kerala", abbreviation: "KL", gstCode: "32", unionTerritory: false },
  { name: "Madhya Pradesh", abbreviation: "MP", gstCode: "23", unionTerritory: false },
  { name: "Maharashtra", abbreviation: "MH", gstCode: "27", unionTerritory: false },
  { name: "Manipur", abbreviation: "MN", gstCode: "14", unionTerritory: false },
  { name: "Meghalaya", abbreviation: "ML", gstCode: "17", unionTerritory: false },
  { name: "Mizoram", abbreviation: "MZ", gstCode: "15", unionTerritory: false },
  { name: "Nagaland", abbreviation: "NL", gstCode: "13", unionTerritory: false },
  { name: "Odisha", abbreviation: "OD", gstCode: "21", unionTerritory: false },
  { name: "Punjab", abbreviation: "PB", gstCode: "03", unionTerritory: false },
  { name: "Rajasthan", abbreviation: "RJ", gstCode: "08", unionTerritory: false },
  { name: "Sikkim", abbreviation: "SK", gstCode: "11", unionTerritory: false },
  { name: "Tamil Nadu", abbreviation: "TN", gstCode: "33", unionTerritory: false },
  { name: "Telangana", abbreviation: "TG", gstCode: "36", unionTerritory: false },
  { name: "Tripura", abbreviation: "TR", gstCode: "16", unionTerritory: false },
  { name: "Uttar Pradesh", abbreviation: "UP", gstCode: "09", unionTerritory: false },
  { name: "Uttarakhand", abbreviation: "UT", gstCode: "05", unionTerritory: false },
  { name: "West Bengal", abbreviation: "WB", gstCode: "19", unionTerritory: false },
  { name: "Andaman and Nicobar Islands", abbreviation: "AN", gstCode: "35", unionTerritory: true },
  { name: "Chandigarh", abbreviation: "CH", gstCode: "04", unionTerritory: true },
  { name: "Dadra and Nagar Haveli and Daman and Diu", abbreviation: "DH", gstCode: "26", unionTerritory: true },
  { name: "Delhi", abbreviation: "DL", gstCode: "07", unionTerritory: true },
  { name: "Jammu and Kashmir", abbreviation: "JK", gstCode: "01", unionTerritory: true },
  { name: "Ladakh", abbreviation: "LA", gstCode: "38", unionTerritory: true },
  { name: "Lakshadweep", abbreviation: "LD", gstCode: "31", unionTerritory: true },
  { name: "Puducherry", abbreviation: "PY", gstCode: "34", unionTerritory: true },
];

/** The same small reviewed alias table as the backend: old names, other forms and the common non-ISO abbreviations. */
const ALIASES: readonly (readonly [string, string])[] = [
  ["Orissa", "Odisha"],
  ["Uttaranchal", "Uttarakhand"],
  ["Pondicherry", "Puducherry"],
  ["Dadra and Nagar Haveli", "Dadra and Nagar Haveli and Daman and Diu"],
  ["Daman and Diu", "Dadra and Nagar Haveli and Daman and Diu"],
  ["25", "Dadra and Nagar Haveli and Daman and Diu"], // the former Daman and Diu code
  ["NCT of Delhi", "Delhi"],
  ["National Capital Territory of Delhi", "Delhi"],
  ["AD", "Andhra Pradesh"],
  ["TS", "Telangana"],
  ["UK", "Uttarakhand"],
  ["DN", "Dadra and Nagar Haveli and Daman and Diu"],
  ["DD", "Dadra and Nagar Haveli and Daman and Diu"],
  ["OR", "Odisha"],
];

/** Trims, collapses whitespace, reads "&" as "and", ignores case: the backend's normalisation. */
function key(text: string): string {
  return text.trim().replace(/&/g, " and ").replace(/\s+/g, " ").trim().toLowerCase();
}

const LOOKUP = new Map<string, IndianStateEntry>();
for (const entry of INDIAN_STATES) {
  LOOKUP.set(key(entry.name), entry);
  LOOKUP.set(key(entry.abbreviation), entry);
  LOOKUP.set(key(entry.gstCode), entry);
}
for (const [alias, name] of ALIASES) {
  const entry = INDIAN_STATES.find((s) => s.name === name);
  if (entry) LOOKUP.set(key(alias), entry);
}

/** The entry a saved value stands for, or null when it is blank or not recognised. Never a guess: whole-value matches only. */
export function matchState(raw: string | null | undefined): IndianStateEntry | null {
  if (!raw || !raw.trim()) return null;
  return LOOKUP.get(key(raw)) ?? null;
}

/** True for exactly the canonical names: what a form may submit. */
export function isStateName(value: string): boolean {
  return INDIAN_STATES.some((s) => s.name === value);
}

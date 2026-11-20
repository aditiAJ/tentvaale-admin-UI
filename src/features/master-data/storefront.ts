/**
 * The storefront's catalogue vocabulary, so what the admin enters here is what
 * the storefront filters and displays by.
 *
 * These are only what each list STARTS with. The lists themselves (mood, theme fit, indoor / outdoor, colours, materials,
 * fabrics) live in the backend and are managed in Settings → General settings; the product form reads them from there.
 * The demo data (no backend) still uses these. Moods and themes are closed lists (the storefront filters on them);
 * colours, materials and fabrics are open: a new one typed on a product is added to its list.
 */

/** How a rate is counted: per piece, per running foot, or per square foot. */
export const RATE_TYPES = ["Qty", "RFt", "SqFt"] as const;
export type RateType = (typeof RATE_TYPES)[number];

export const RATE_TYPE_LABEL: Record<RateType, string> = {
  Qty: "per unit",
  RFt: "per running ft",
  SqFt: "per sq ft",
};

/** A quantity with what it counts: "4 pcs", "120 sq ft", "30 rft". Without a rate type it is just the number. */
export function quantityLabel(quantity: number, rateType?: RateType | null): string {
  if (!rateType) return String(quantity);
  if (rateType === "Qty" && quantity === 1) return "1 pc";
  return `${quantity} ${unitLabel(rateType)}`;
}

/** What a quantity of this product counts. */
export function unitLabel(rateType?: RateType | null): string {
  return rateType === "SqFt" ? "sq ft" : rateType === "RFt" ? "rft" : "pcs";
}

/** The unit a per-day rate is quoted in: "/ day", "/ ft / day" or "/ sq ft / day". */
export function ratePerDayLabel(rateType?: RateType | null): string {
  return rateType === "SqFt" ? "/ sq ft / day" : rateType === "RFt" ? "/ ft / day" : "/ day";
}

/** Where a product can be used, as the storefront's Indoor / outdoor spec. */
export const PRODUCT_SETTINGS = ["Indoor", "Outdoor", "Indoor & outdoor"] as const;
/** One of the Indoor / outdoor list in Settings, which a business can change; PRODUCT_SETTINGS is only what the list starts with. */
export type ProductSetting = string;

export const MOODS = [
  "Classic",
  "Regal",
  "Romantic",
  "Festive",
  "Boho",
  "Rustic",
  "Glam",
  "Traditional",
  "Minimal",
] as const;

export const THEMES = [
  "Royal heritage",
  "Modern luxe",
  "Floral garden",
  "Haldi & mehendi",
  "Boho",
  "Corporate",
  "Beach",
  "Festive & puja",
] as const;

/** A bundle's occasion and a collection's "best for", as the storefront names them. */
export const OCCASIONS = [
  "Wedding",
  "Reception",
  "Engagement",
  "Anniversary",
  "Haldi",
  "Mehendi",
  "Sangeet",
  "Cocktail",
  "Sufi night",
  "Puja",
  "Ganesh Chaturthi",
  "Griha pravesh",
  "Navratri",
  "Diwali",
  "Baby shower",
  "Birthday",
  "Pool party",
  "Sundowner",
  "Corporate",
  "Corporate gala",
  "Award night",
] as const;

export const COLOUR_SUGGESTIONS = [
  "Gold",
  "Ivory",
  "White",
  "Black",
  "Natural",
  "Red",
  "Maroon",
  "Emerald",
  "Mustard",
  "Blush",
  "Beige",
  "Brass",
  "Silver",
  "Rose gold",
  "Warm white",
  "Multicolour",
];

export const MATERIAL_SUGGESTIONS = [
  "Wood",
  "Teak",
  "Sheesham wood",
  "Brass",
  "Resin",
  "Polypropylene",
  "Metal",
  "Steel",
  "Aluminium",
  "Acrylic",
  "Rattan",
  "MDF",
  "Marble",
  "Glass",
  "Fibreglass",
  "Canvas",
  "PVC fabric",
  "Faux florals",
  "Fresh florals",
];

/** Upholstery and drape fabrics a product can be offered in. */
export const FABRIC_SUGGESTIONS = [
  "Velvet",
  "Satin",
  "Silk",
  "Tissue",
  "Cotton",
  "Linen",
  "Boucle",
  "Suede",
  "Leatherette",
  "Jute",
  "Chiffon",
  "Organza",
  "Net",
  "Sequin",
];

/**
 * Specification names the storefront shows under a product. Which apply depends
 * on what the product is, so the form offers these alongside whatever other
 * products in the same category already use.
 */
export const ATTRIBUTE_SUGGESTIONS = [
  "Seating capacity",
  "Frame material",
  "Shape",
  "Height",
  "Finish",
  "Mounting type",
  "Power source",
  "Colour temperature",
  "Dimmable",
  "Coverage",
  "Load rating",
  "Panel size",
  "Install time",
  "Width",
  "Drop length",
];

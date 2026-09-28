/**
 * The storefront's catalogue vocabulary, so what the admin enters here is what
 * the storefront filters and displays by.
 *
 * Moods and themes are closed lists: the storefront filters on them, and a
 * value outside the list would be a filter nobody can reach, so the admin picks
 * from these and the mock refuses anything else. Occasions, colours, materials
 * and fabrics are open — the lists here are suggestions taken from the
 * storefront's own catalogue, and anything else typed is kept.
 */

/** How a rate is counted: per piece, per running foot, or per square foot. */
export const RATE_TYPES = ["Qty", "RFt", "SqFt"] as const;
export type RateType = (typeof RATE_TYPES)[number];

export const RATE_TYPE_LABEL: Record<RateType, string> = {
  Qty: "per unit",
  RFt: "per running ft",
  SqFt: "per sq ft",
};

/** Where a product can be used, as the storefront's Indoor / outdoor spec. */
export const PRODUCT_SETTINGS = ["Indoor", "Outdoor", "Indoor & outdoor"] as const;
export type ProductSetting = (typeof PRODUCT_SETTINGS)[number];

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

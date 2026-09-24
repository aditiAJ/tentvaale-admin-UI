import type {
  BundleView,
  CategoryView,
  CustomerView,
  FeaturedCollectionView,
  ProductVariantView,
  ProductView,
  SubCategoryView,
  TruckView,
  WarehouseView,
} from "@/features/master-data/types";
import type { AdminUserView } from "@/features/users/types";
import type { NotificationLogView } from "@/features/notifications/types";
import type { DepositLedgerView } from "@/features/deposits/types";
import type { QuotationView } from "@/features/quotations/types";
import type { OrderView } from "@/features/orders/types";
import type { StockMovementView } from "@/features/inventory/types";
import type { CreditNoteView } from "@/features/credit-notes/types";
import type { Role } from "@/services/permissions";

/**
 * Seed data for the mock build.
 *
 * Shapes match the backend's view records exactly, so when the real API is
 * switched on nothing downstream changes — the same types flow through the same
 * components. Values are picked to exercise the awkward cases the happy path
 * hides: a product with no category, a failed and a skipped
 * notification, a deposit already settled, an inactive user.
 */

export const COMPANY_ID = "22222222-2222-2222-2222-222222222222";

/** One password for every seeded account. This build has no real security. */
export const DEMO_PASSWORD = "tentvaale";

interface SeedUser extends AdminUserView {
  password: string;
}

export const SEED_USERS: SeedUser[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    companyId: COMPANY_ID,
    username: "asha.k",
    email: "asha@tentvaale.example",
    role: "ADMIN",
    active: true,
    password: DEMO_PASSWORD,
  },
  {
    id: "11111111-1111-1111-1111-111111111112",
    companyId: COMPANY_ID,
    username: "rohit.m",
    email: "rohit@tentvaale.example",
    role: "SALES",
    active: true,
    password: DEMO_PASSWORD,
  },
  {
    id: "11111111-1111-1111-1111-111111111113",
    companyId: COMPANY_ID,
    username: "vikram.s",
    email: "vikram@tentvaale.example",
    role: "WAREHOUSE",
    active: true,
    password: DEMO_PASSWORD,
  },
  {
    id: "11111111-1111-1111-1111-111111111114",
    companyId: COMPANY_ID,
    username: "priya.n",
    email: "priya@tentvaale.example",
    role: "ACCOUNTS",
    active: true,
    password: DEMO_PASSWORD,
  },
  {
    id: "11111111-1111-1111-1111-111111111115",
    companyId: COMPANY_ID,
    username: "old.account",
    email: "former@tentvaale.example",
    role: "SALES",
    active: false,
    password: DEMO_PASSWORD,
  },
];

/** Which role a visitor can sign in as, for the login screen's shortcuts. */
export const DEMO_LOGINS: { username: string; role: Role; blurb: string }[] = [
  { username: "asha.k", role: "ADMIN", blurb: "Everything, including users" },
  { username: "rohit.m", role: "SALES", blurb: "Catalogue and reporting; no user admin" },
  { username: "vikram.s", role: "WAREHOUSE", blurb: "Stock only — the sparsest menu" },
  { username: "priya.n", role: "ACCOUNTS", blurb: "Deposits, reporting, notifications" },
];

const inr = (amount: number) => ({ amount, currency: "INR" });

/**
 * Retail rates are the old single rental rate carried over unchanged, so the
 * seeded quotations and orders below keep the totals they were built with.
 * Wholesale sits at roughly 80% of retail. Every product but the stage deck
 * is filed under a category and one of its sub-categories; the stage deck is
 * left without, as legacy data can be, so the table's "Uncategorised" case is
 * on screen.
 *
 * hasVariants is set where the item plausibly comes in versions — the gold
 * chair in other finishes, the sofa in other fabrics, the light curtain in
 * warm or cool white. No media is seeded: there are no images in the repo to
 * seed it with, and a product with none is the case the table has to handle.
 *
 * Tentvaale owns almost everything; the stage deck and the generator are
 * sub-hired from partners, so an SKU owner other than the company shows up.
 */
export const SEED_PRODUCTS: ProductRecord[] = [
  { id: "p-01", companyId: COMPANY_ID, sku: "TENT-20X40", skuOwner: "Tentvaale", name: "20x40 Frame Tent", genericName: "Frame Tent", description: "Heavy-duty frame tent, seats 80 banquet style", categoryId: "cat-01", subCategoryId: "sub-13", tag: "Tents", wholesaleRate: inr(10000), retailRate: inr(12500), hasVariants: false, media: [], active: true },
  { id: "p-02", companyId: COMPANY_ID, sku: "TENT-30X60", skuOwner: "Tentvaale", name: "30x60 Pole Tent", genericName: "Pole Tent", description: "Large pole tent for open ground", categoryId: "cat-01", subCategoryId: "sub-14", tag: "Tents", wholesaleRate: inr(19500), retailRate: inr(24000), hasVariants: false, media: [], active: true },
  { id: "p-03", companyId: COMPANY_ID, sku: "TENT-10X10", skuOwner: "Tentvaale", name: "10x10 Canopy", genericName: "Canopy", description: null, categoryId: "cat-01", subCategoryId: "sub-15", tag: "Tents", wholesaleRate: inr(1400), retailRate: inr(1800), hasVariants: false, media: [], active: true },
  { id: "p-04", companyId: COMPANY_ID, sku: "CHR-GOLD", skuOwner: "Tentvaale", name: "Gold Chiavari Chair", genericName: "Chair", description: "Banquet seating, stackable", categoryId: "cat-06", subCategoryId: "sub-02", tag: "Furniture", wholesaleRate: inr(95), retailRate: inr(120.5), hasVariants: true, media: [], active: true },
  { id: "p-05", companyId: COMPANY_ID, sku: "CHR-WHITE", skuOwner: "Tentvaale", name: "White Folding Chair", genericName: "Chair", description: null, categoryId: "cat-06", subCategoryId: "sub-04", tag: "Furniture", wholesaleRate: inr(35), retailRate: inr(45), hasVariants: false, media: [], active: true },
  { id: "p-06", companyId: COMPANY_ID, sku: "SOFA-VELVET", skuOwner: "Tentvaale", name: "Velvet Lounge Sofa", genericName: "Sofa", description: "Three-seater, ivory velvet", categoryId: "cat-06", subCategoryId: "sub-03", tag: "Furniture", wholesaleRate: inr(2600), retailRate: inr(3200), hasVariants: true, media: [], active: true },
  { id: "p-07", companyId: COMPANY_ID, sku: "TBL-ROUND-6", skuOwner: "Tentvaale", name: "6ft Round Table", genericName: "Table", description: "Seats 10", categoryId: "cat-03", subCategoryId: "sub-16", tag: "Tables", wholesaleRate: inr(320), retailRate: inr(400), hasVariants: false, media: [], active: true },
  { id: "p-08", companyId: COMPANY_ID, sku: "TBL-COCKTAIL", skuOwner: "Tentvaale", name: "Cocktail Table", genericName: "Table", description: null, categoryId: "cat-03", subCategoryId: "sub-17", tag: "Tables", wholesaleRate: inr(200), retailRate: inr(250), hasVariants: false, media: [], active: true },
  // Deliberately uncategorised: md_product.category_id is not a foreign key, so
  // orphans are normal and the UI must render them without complaint. It still
  // has a tag, which is required.
  { id: "p-09", companyId: COMPANY_ID, sku: "STAGE-8X12", skuOwner: "StageCraft Rentals", name: "8x12 Stage Deck", genericName: "Stage Deck", description: "Modular decking, 600mm rise", categoryId: null, subCategoryId: null, tag: "Staging", wholesaleRate: inr(6000), retailRate: inr(7500), hasVariants: false, media: [], active: true },
  { id: "p-10", companyId: COMPANY_ID, sku: "LIGHT-FAIRY", skuOwner: "Tentvaale", name: "Fairy Light Curtain", genericName: "Light Curtain", description: "4m x 3m warm white", categoryId: "cat-04", subCategoryId: "sub-12", tag: "Lighting", wholesaleRate: inr(700), retailRate: inr(900), hasVariants: true, media: [], active: true },
  { id: "p-11", companyId: COMPANY_ID, sku: "LIGHT-UPLIGHT", skuOwner: "Tentvaale", name: "LED Uplight", genericName: "Uplight", description: "Battery, colour selectable", categoryId: "cat-04", subCategoryId: "sub-11", tag: "Lighting", wholesaleRate: inr(280), retailRate: inr(350), hasVariants: false, media: [], active: true },
  { id: "p-12", companyId: COMPANY_ID, sku: "GEN-15KVA", skuOwner: "Shakti Power Hire", name: "15 kVA Silent Generator", genericName: "Generator", description: "Diesel, includes 40m cabling", categoryId: "cat-05", subCategoryId: "sub-18", tag: "Power", wholesaleRate: inr(5200), retailRate: inr(6500), hasVariants: false, media: [], active: true },
  // Inactive, so it should NOT appear in the list: the real endpoint is
  // findByCompanyIdAndActiveTrue.
  { id: "p-13", companyId: COMPANY_ID, sku: "TENT-RETIRED", skuOwner: "Tentvaale", name: "15x30 Frame Tent (retired)", genericName: "Frame Tent", description: "Withdrawn after storm damage", categoryId: "cat-01", subCategoryId: "sub-13", tag: "Tents", wholesaleRate: inr(7200), retailRate: inr(9000), hasVariants: false, media: [], active: false },
];

/**
 * Products point at these by id (see SEED_PRODUCTS). Seating is kept with no
 * sub-categories and no products, so a category that cannot yet take a
 * product shows up in the product form's picker.
 */
export const SEED_CATEGORIES: CategoryRecord[] = [
  { id: "cat-01", companyId: COMPANY_ID, name: "Tents", active: true },
  { id: "cat-02", companyId: COMPANY_ID, name: "Seating", active: true },
  { id: "cat-03", companyId: COMPANY_ID, name: "Tables", active: true },
  { id: "cat-04", companyId: COMPANY_ID, name: "Lighting", active: true },
  { id: "cat-05", companyId: COMPANY_ID, name: "Power", active: true },
  { id: "cat-06", companyId: COMPANY_ID, name: "Furniture", active: true },
  { id: "cat-07", companyId: COMPANY_ID, name: "Carpets and rugs", active: true },
];

/**
 * A product as stored: category and sub-category by id only. Their names are
 * resolved into ProductView when products are listed.
 */
export type ProductRecord = Omit<ProductView, "categoryName" | "subCategoryName" | "variants">;

/** A variant as stored; its stock is summed from the warehouses on read. */
export type ProductVariantRecord = Omit<ProductVariantView, "stock">;

const variant = (
  id: number,
  productId: string,
  name: string,
  wholesale: number,
  retail: number,
): ProductVariantRecord => ({
  id: `var-${String(id).padStart(2, "0")}`,
  companyId: COMPANY_ID,
  productId,
  name,
  wholesaleRate: inr(wholesale),
  retailRate: inr(retail),
});

/**
 * The three products marked hasVariants, each with two versions. The red
 * cushion and the emerald sofa are priced above the plain ones, so it shows
 * that a variant's rates are its own and not the product's.
 */
export const SEED_PRODUCT_VARIANTS: ProductVariantRecord[] = [
  variant(1, "p-04", "Ivory cushion", 95, 120.5),
  variant(2, "p-04", "Red cushion", 105, 135),
  variant(3, "p-06", "Ivory velvet", 2600, 3200),
  variant(4, "p-06", "Emerald velvet", 2900, 3600),
  variant(5, "p-10", "Warm white", 700, 900),
  variant(6, "p-10", "Cool white", 700, 900),
];

/**
 * A category as stored: everything but its sub-categories, which live in
 * SEED_SUB_CATEGORIES and are gathered into CategoryView when listed.
 */
export type CategoryRecord = Omit<CategoryView, "subCategories">;

const subCategory = (id: number, categoryId: string, name: string): SubCategoryView => ({
  id: `sub-${String(id).padStart(2, "0")}`,
  companyId: COMPANY_ID,
  categoryId,
  name,
});

/**
 * Every category that holds products has sub-categories, since a product is
 * filed under both. Seating has none, so a category without them still shows.
 */
export const SEED_SUB_CATEGORIES: SubCategoryView[] = [
  subCategory(1, "cat-06", "Thrones"),
  subCategory(2, "cat-06", "Banquet seating"),
  subCategory(3, "cat-06", "Couches"),
  subCategory(4, "cat-06", "Chairs"),
  subCategory(5, "cat-07", "Persian and traditional"),
  subCategory(6, "cat-07", "Printed"),
  subCategory(7, "cat-07", "Plain and solid"),
  subCategory(8, "cat-07", "Aisle runners"),
  subCategory(9, "cat-04", "Chandeliers"),
  subCategory(10, "cat-04", "Pendants and suspended"),
  subCategory(11, "cat-04", "Uplighters and spots"),
  subCategory(12, "cat-04", "String and fairy lights"),
  subCategory(13, "cat-01", "Frame tents"),
  subCategory(14, "cat-01", "Pole tents"),
  subCategory(15, "cat-01", "Canopies"),
  subCategory(16, "cat-03", "Round tables"),
  subCategory(17, "cat-03", "Cocktail tables"),
  subCategory(18, "cat-05", "Generators"),
];

export interface SeedQuotation {
  id: string;
  number: string;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "CONVERTED" | "EXPIRED";
}

/** UUID-shaped for the same reason order ids are: the quotation screen looks
 *  one up by id, and nothing else in the app would accept `q-d0`. */
const quotationId = (group: number, index: number) =>
  `66666666-6666-6666-6666-6666${String(group).padStart(2, "0")}${String(index).padStart(6, "0")}`;

/**
 * The dashboard counts are derived from these rather than hardcoded, so the
 * figures stay consistent with anything added later. Rejected and expired are
 * present on purpose: the real endpoint does not return them, and the dashboard
 * says so rather than quietly folding them into a win rate.
 */
export const SEED_QUOTATIONS: SeedQuotation[] = [
  ...Array.from({ length: 14 }, (_, i) => ({ id: quotationId(1, i), number: `QT-2026-${300 + i}`, status: "DRAFT" as const })),
  ...Array.from({ length: 23 }, (_, i) => ({ id: quotationId(2, i), number: `QT-2026-${200 + i}`, status: "SENT" as const })),
  ...Array.from({ length: 9 }, (_, i) => ({ id: quotationId(3, i), number: `QT-2026-${150 + i}`, status: "ACCEPTED" as const })),
  ...Array.from({ length: 31 }, (_, i) => ({ id: quotationId(4, i), number: `QT-2026-${100 + i}`, status: "CONVERTED" as const })),
  ...Array.from({ length: 6 }, (_, i) => ({ id: quotationId(5, i), number: `QT-2026-${80 + i}`, status: "REJECTED" as const })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: quotationId(6, i), number: `QT-2026-${70 + i}`, status: "EXPIRED" as const })),
];

/**
 * Customers are StorefrontAccounts, which have no companyId — they are not
 * owned by a tenant, so these are deliberately not stamped with COMPANY_ID
 * the way every other seed here is. One EVENT_PLANNER is included because the
 * account type is the only thing that distinguishes the two.
 */
export const SEED_CUSTOMERS: CustomerView[] = [
  { id: "44444444-4444-4444-4444-444444444401", email: "amit.shah@example.com", fullName: "Amit Shah", phone: "+91 98200 11223", accountType: "CUSTOMER" },
  { id: "44444444-4444-4444-4444-444444444402", email: "neha.r@example.com", fullName: "Neha Raghavan", phone: "+91 99300 44556", accountType: "CUSTOMER" },
  { id: "44444444-4444-4444-4444-444444444403", email: "events@grandpalace.example", fullName: "Grand Palace Banquets", phone: "+91 22 4455 6677", accountType: "EVENT_PLANNER" },
  { id: "44444444-4444-4444-4444-444444444404", email: "rhea.kapoor@example.com", fullName: "Rhea Kapoor", phone: null, accountType: "CUSTOMER" },
  { id: "44444444-4444-4444-4444-444444444405", email: "vendor.desk@example.com", fullName: "Mehta Event Co.", phone: "+91 98110 77889", accountType: "EVENT_PLANNER" },
];

/**
 * A featured collection as stored: product ids in display order rather than
 * the resolved products, which are looked up from the catalogue on read.
 */
export type FeaturedCollectionRecord = Omit<FeaturedCollectionView, "products"> & {
  productIds: string[];
};

/**
 * Invented outright, like bundles. The gold chair, the fairy lights and the
 * uplight each sit in more than one collection, and the corporate gala set is
 * inactive, so both of those cases are on screen from the start.
 */
export const SEED_FEATURED_COLLECTIONS: FeaturedCollectionRecord[] = [
  {
    id: "fc-01",
    companyId: COMPANY_ID,
    name: "Royal Wedding Collection",
    description: "Gilded seating, velvet lounges and a grand frame tent for a palace-style wedding.",
    active: true,
    productIds: ["p-04", "p-06", "p-01", "p-07", "p-10"],
  },
  {
    id: "fc-02",
    companyId: COMPANY_ID,
    name: "Luxury Garden Collection",
    description: "Canopies, cocktail tables and warm lighting for an evening on the lawn.",
    active: true,
    productIds: ["p-03", "p-08", "p-10", "p-11"],
  },
  {
    id: "fc-03",
    companyId: COMPANY_ID,
    name: "Sangeet Night Collection",
    description: "A stage, uplighting and banquet chairs for a night of performances.",
    active: true,
    productIds: ["p-09", "p-11", "p-04"],
  },
  {
    id: "fc-04",
    companyId: COMPANY_ID,
    name: "Corporate Gala Collection",
    description: null,
    active: false,
    productIds: ["p-02", "p-05", "p-12"],
  },
];

/**
 * A bundle as stored: product ids and quantities, resolved into
 * BundleComponentView (name, SKU, active) when bundles are listed.
 */
export type BundleRecord = Omit<BundleView, "components"> & {
  components: { productId: string; quantity: number }[];
};

/**
 * Invented outright — no bundle table or endpoint exists to be faithful to.
 * The same products the bundles always named, now by id with a quantity each.
 * The fairy light curtain is in two of them, so a product shared between
 * bundles is on screen from the start. Rates are the bundles' own, unchanged.
 */
export const SEED_BUNDLES: BundleRecord[] = [
  {
    id: "b-01",
    companyId: COMPANY_ID,
    name: "Wedding Mandap Set",
    components: [
      { productId: "p-01", quantity: 1 },
      { productId: "p-04", quantity: 80 },
      { productId: "p-07", quantity: 8 },
      { productId: "p-10", quantity: 4 },
    ],
    rentalRate: inr(28000),
  },
  {
    id: "b-02",
    companyId: COMPANY_ID,
    name: "Corporate Conference Kit",
    components: [
      { productId: "p-02", quantity: 1 },
      { productId: "p-05", quantity: 150 },
      { productId: "p-09", quantity: 2 },
    ],
    rentalRate: inr(41000),
  },
  {
    id: "b-03",
    companyId: COMPANY_ID,
    name: "Garden Party Package",
    components: [
      { productId: "p-03", quantity: 4 },
      { productId: "p-08", quantity: 10 },
      { productId: "p-10", quantity: 6 },
    ],
    rentalRate: inr(6400),
  },
];

/** Invented outright — warehouses are an opaque UUID on StockMovement only. */
export const SEED_WAREHOUSES: WarehouseView[] = [
  {
    id: "55555555-5555-5555-5555-555555555501",
    companyId: COMPANY_ID,
    name: "Andheri Main Store",
    // Deliberately the longest of the three, so the table's truncation and the
    // dialog's 250-character ceiling are both exercised by the seed itself.
    address: "Unit 7, Sundar Industrial Estate, Andheri Kurla Road, near Marol Naka Metro, Andheri East 400059",
    city: "Mumbai",
  },
  {
    id: "55555555-5555-5555-5555-555555555502",
    companyId: COMPANY_ID,
    name: "Pune Satellite Depot",
    address: "Gala 12, Bhosari MIDC Phase 2, Pune 411026",
    city: "Pune",
  },
  {
    id: "55555555-5555-5555-5555-555555555503",
    companyId: COMPANY_ID,
    name: "Nashik Overflow Yard",
    address: "Plot 31, Satpur MIDC, Trimbak Road, Nashik 422007",
    city: "Nashik",
  },
];

/**
 * The stored warehouse ↔ product relationship: ids and a count, nothing
 * copied from either side. The view the UI reads (WarehouseProductView) adds
 * the product's name and SKU when it is listed.
 */
export interface WarehouseProduct {
  warehouseId: string;
  productId: string;
  /** Which variant, for a product with variants; otherwise null. */
  variantId: string | null;
  quantity: number;
}

/**
 * Invented outright, like the warehouses themselves. The gold chair and the
 * LED uplight each appear in two warehouses at different counts, so it is
 * visible that the same product keeps a separate quantity per warehouse. The
 * chair and the sofa have variants, so their stock is held per variant — the
 * chair's two cushions in both of the first two warehouses.
 *
 * `quantity` is what is on the shelf now, after the seeded movements below:
 * ORD-2026-0090's tent, stage decks and twelve uplights are out of Pune, so
 * those rows read what was left behind. Every seeded dispatch was possible from
 * the warehouse it names, and ORD-2026-0092 can still be dispatched in full
 * from Nashik.
 */
export const SEED_WAREHOUSE_PRODUCTS: WarehouseProduct[] = [
  { warehouseId: SEED_WAREHOUSES[0].id, productId: "p-04", variantId: "var-01", quantity: 72 },
  { warehouseId: SEED_WAREHOUSES[0].id, productId: "p-04", variantId: "var-02", quantity: 8 },
  { warehouseId: SEED_WAREHOUSES[0].id, productId: "p-07", variantId: null, quantity: 10 },
  { warehouseId: SEED_WAREHOUSES[0].id, productId: "p-06", variantId: "var-03", quantity: 5 },
  { warehouseId: SEED_WAREHOUSES[0].id, productId: "p-01", variantId: null, quantity: 2 },
  { warehouseId: SEED_WAREHOUSES[0].id, productId: "p-10", variantId: "var-05", quantity: 10 },
  { warehouseId: SEED_WAREHOUSES[1].id, productId: "p-04", variantId: "var-01", quantity: 30 },
  { warehouseId: SEED_WAREHOUSES[1].id, productId: "p-04", variantId: "var-02", quantity: 20 },
  { warehouseId: SEED_WAREHOUSES[1].id, productId: "p-01", variantId: null, quantity: 10 },
  { warehouseId: SEED_WAREHOUSES[1].id, productId: "p-11", variantId: null, quantity: 15 },
  { warehouseId: SEED_WAREHOUSES[1].id, productId: "p-02", variantId: null, quantity: 1 },
  { warehouseId: SEED_WAREHOUSES[1].id, productId: "p-09", variantId: null, quantity: 2 },
  { warehouseId: SEED_WAREHOUSES[2].id, productId: "p-11", variantId: null, quantity: 40 },
  { warehouseId: SEED_WAREHOUSES[2].id, productId: "p-05", variantId: null, quantity: 200 },
  { warehouseId: SEED_WAREHOUSES[2].id, productId: "p-12", variantId: null, quantity: 1 },
];

/** Invented outright — no truck table, and volume attributes for load
 *  calculation are not modelled on products either. */
export const SEED_TRUCKS: TruckView[] = [
  { id: "t-01", companyId: COMPANY_ID, registration: "MH 01 AB 4471", capacityKg: 3500 },
  { id: "t-02", companyId: COMPANY_ID, registration: "MH 12 CD 9920", capacityKg: 7500 },
  { id: "t-03", companyId: COMPANY_ID, registration: "MH 04 EF 1183", capacityKg: 1200 },
];

export interface SeedOrder {
  id: string;
  number: string;
  total: number;
}

/** Order ids are real UUIDs because the deposits screen is looked up by one. */
export const SEED_ORDERS: SeedOrder[] = [
  { id: "33333333-3333-3333-3333-333333333301", number: "ORD-2026-0088", total: 186400 },
  { id: "33333333-3333-3333-3333-333333333302", number: "ORD-2026-0089", total: 94250 },
  { id: "33333333-3333-3333-3333-333333333303", number: "ORD-2026-0090", total: 312000 },
  { id: "33333333-3333-3333-3333-333333333304", number: "ORD-2026-0091", total: 58700 },
  { id: "33333333-3333-3333-3333-333333333305", number: "ORD-2026-0092", total: 141900 },
  ...Array.from({ length: 26 }, (_, i) => ({
    id: `33333333-3333-3333-3333-3333333334${String(i).padStart(2, "0")}`,
    number: `ORD-2026-${String(50 + i).padStart(4, "0")}`,
    total: 45000 + i * 11500,
  })),
];

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const daysFromNow = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const productBySku = (sku: string): ProductRecord => {
  const found = SEED_PRODUCTS.find((product) => product.sku === sku);
  if (!found) throw new Error(`Seed error: no product with SKU ${sku}`);
  return found;
};

interface SeedLine {
  sku: string;
  quantity: number;
  rentalDays: number;
}

/**
 * Full quotation and order records for the screens that look one up by id.
 *
 * These are built FROM the count seeds above rather than written out beside
 * them: the id, number and status all come from the SeedQuotation entry, so
 * a quotation the dashboard counts as SENT can never open as something else.
 * Line totals are computed from the real product rates for the same reason —
 * the backend stores totals at creation time, so they are materialised here
 * too rather than derived on read. Line rates are retail, as a new quotation
 * is priced. The deposit is passed in, because it is set per booking now that
 * products carry none; each is the figure the old per-product deposits added
 * up to, so the seeded orders and ledger are unchanged.
 */
function quotationDetail(
  source: SeedQuotation,
  customer: CustomerView,
  eventInDays: number,
  lines: SeedLine[],
  sourceReference: string | null,
  securityDeposit: number,
): QuotationView {
  const built = lines.map((line, index) => {
    const product = productBySku(line.sku);
    const rate = Number(product.retailRate.amount);
    return {
      id: `${source.id}-L${index + 1}`,
      productId: product.id,
      productName: product.name,
      quantity: line.quantity,
      rentalDays: line.rentalDays,
      unitRatePerDay: inr(rate),
      lineTotal: inr(rate * line.quantity * line.rentalDays),
    };
  });

  return {
    id: source.id,
    companyId: COMPANY_ID,
    quotationNumber: source.number,
    customerId: customer.id,
    customerName: customer.fullName,
    customerEmail: customer.email,
    eventDate: daysFromNow(eventInDays),
    status: source.status,
    totalAmount: inr(built.reduce((sum, line) => sum + Number(line.lineTotal.amount), 0)),
    totalSecurityDeposit: inr(securityDeposit),
    sourceReference,
    lines: built,
  };
}

const quotationByNumber = (number: string): SeedQuotation => {
  const found = SEED_QUOTATIONS.find((quotation) => quotation.number === number);
  if (!found) throw new Error(`Seed error: no quotation numbered ${number}`);
  return found;
};

export const SEED_QUOTATION_DETAILS: QuotationView[] = [
  quotationDetail(
    quotationByNumber("QT-2026-100"),
    SEED_CUSTOMERS[0],
    -4,
    [
      { sku: "TENT-20X40", quantity: 1, rentalDays: 2 },
      { sku: "CHR-GOLD", quantity: 80, rentalDays: 2 },
      { sku: "TBL-ROUND-6", quantity: 8, rentalDays: 2 },
    ],
    "admin-ui",
    5000,
  ),
  quotationDetail(
    quotationByNumber("QT-2026-200"),
    SEED_CUSTOMERS[2],
    26,
    [
      { sku: "TENT-30X60", quantity: 1, rentalDays: 3 },
      { sku: "STAGE-8X12", quantity: 2, rentalDays: 3 },
      { sku: "LIGHT-UPLIGHT", quantity: 12, rentalDays: 3 },
    ],
    "storefront-plan:99999999-9999-9999-9999-999999999901",
    19800,
  ),
  quotationDetail(
    quotationByNumber("QT-2026-300"),
    SEED_CUSTOMERS[3],
    40,
    [{ sku: "LIGHT-FAIRY", quantity: 6, rentalDays: 1 }],
    "admin-ui",
    1500,
  ),
  quotationDetail(
    quotationByNumber("QT-2026-150"),
    SEED_CUSTOMERS[4],
    19,
    [
      { sku: "GEN-15KVA", quantity: 1, rentalDays: 2 },
      { sku: "CHR-WHITE", quantity: 150, rentalDays: 2 },
    ],
    "admin-ui",
    10000,
  ),
  // The four below exist to be the sources of seeded orders, so each is one of
  // the CONVERTED numbers: an order converted from a quotation that still read
  // SENT or ACCEPTED would offer "Convert to order" for a quotation that already
  // has one. 101 and 102 carry the lines of 200 and 150 above, which stay
  // unconverted so there is something to convert.
  quotationDetail(
    quotationByNumber("QT-2026-101"),
    SEED_CUSTOMERS[2],
    1,
    [
      { sku: "TENT-30X60", quantity: 1, rentalDays: 3 },
      { sku: "STAGE-8X12", quantity: 2, rentalDays: 3 },
      { sku: "LIGHT-UPLIGHT", quantity: 12, rentalDays: 3 },
    ],
    "storefront-plan:99999999-9999-9999-9999-999999999901",
    19800,
  ),
  quotationDetail(
    quotationByNumber("QT-2026-102"),
    SEED_CUSTOMERS[4],
    19,
    [
      { sku: "GEN-15KVA", quantity: 1, rentalDays: 2 },
      { sku: "CHR-WHITE", quantity: 150, rentalDays: 2 },
    ],
    "admin-ui",
    10000,
  ),
  quotationDetail(
    quotationByNumber("QT-2026-103"),
    SEED_CUSTOMERS[1],
    -24,
    [
      { sku: "STAGE-8X12", quantity: 2, rentalDays: 1 },
      { sku: "LIGHT-UPLIGHT", quantity: 6, rentalDays: 1 },
    ],
    "admin-ui",
    9000,
  ),
  quotationDetail(
    quotationByNumber("QT-2026-104"),
    SEED_CUSTOMERS[3],
    -36,
    [
      { sku: "LIGHT-FAIRY", quantity: 6, rentalDays: 2 },
      { sku: "TBL-ROUND-6", quantity: 4, rentalDays: 2 },
    ],
    "admin-ui",
    5000,
  ),
];

/**
 * Orders are converted quotations, so each detail here is built from one of
 * the quotation details above: lines, customer and totals are copied across
 * exactly as OrderMgmtService copies them, rather than being invented a
 * second time. Status is passed in, and each one agrees with the movements and
 * the deposit seeded for that order below.
 */
function orderFromQuotation(
  source: SeedOrder,
  quotation: QuotationView,
  status: OrderView["status"],
): OrderView {
  return {
    id: source.id,
    companyId: COMPANY_ID,
    orderNumber: source.number,
    quotationId: quotation.id,
    customerId: quotation.customerId,
    customerName: quotation.customerName,
    customerEmail: quotation.customerEmail,
    eventDate: quotation.eventDate,
    status,
    totalAmount: quotation.totalAmount,
    securityDeposit: quotation.totalSecurityDeposit,
    sourceReference: quotation.sourceReference,
    lines: quotation.lines.map((line) => ({
      id: `${source.id}-${line.id}`,
      productId: line.productId,
      productName: line.productName,
      quantity: line.quantity,
      rentalDays: line.rentalDays,
      lineTotal: line.lineTotal,
    })),
  };
}

const quotationDetailByNumber = (number: string): QuotationView => {
  const found = SEED_QUOTATION_DETAILS.find((quotation) => quotation.quotationNumber === number);
  if (!found) throw new Error(`Seed error: no quotation detail numbered ${number}`);
  return found;
};

/**
 * One order at each point in the flow, so every action has something to act
 * on: 0092 can be dispatched or cancelled, 0090 is out and can be returned,
 * 0088 is back and waiting on its deposit, and 0089 and 0091 are done — one
 * with its deposit refunded, one with part of it forfeited.
 */
export const SEED_ORDER_DETAILS: OrderView[] = [
  orderFromQuotation(SEED_ORDERS[0], quotationDetailByNumber("QT-2026-100"), "RETURNED"),
  orderFromQuotation(SEED_ORDERS[1], quotationDetailByNumber("QT-2026-103"), "COMPLETED"),
  orderFromQuotation(SEED_ORDERS[2], quotationDetailByNumber("QT-2026-101"), "DISPATCHED"),
  orderFromQuotation(SEED_ORDERS[3], quotationDetailByNumber("QT-2026-104"), "COMPLETED"),
  orderFromQuotation(SEED_ORDERS[4], quotationDetailByNumber("QT-2026-102"), "CONFIRMED"),
];

const daysAgo = (days: number) =>
  new Date(Date.now() - 86_400_000 * days).toISOString().slice(0, 10);

/** A seeded movement; its lines name the variant wherever the product has them. */
function seedMovement(
  id: string,
  movementNumber: string,
  order: SeedOrder,
  direction: StockMovementView["direction"],
  movedDaysAgo: number,
  warehouse: WarehouseView,
  remarks: string | null,
  lines: { productId: string; variantId?: string; quantity: number }[],
): StockMovementView {
  return {
    id,
    companyId: COMPANY_ID,
    orderId: order.id,
    movementNumber,
    direction,
    movedOn: daysAgo(movedDaysAgo),
    warehouseId: warehouse.id,
    remarks,
    lines: lines.map((line, index) => ({
      id: `${id}-L${index + 1}`,
      productId: line.productId,
      variantId: line.variantId ?? null,
      quantity: line.quantity,
    })),
  };
}

/**
 * Movements are recorded against a whole order, from and back to one
 * warehouse each. Every returned order came back in full to the warehouse it
 * left; 0090 has only gone out, so its goods read as on rent.
 */
export const SEED_STOCK_MOVEMENTS: StockMovementView[] = [
  seedMovement("sm-06", "SM-2026-0020", SEED_ORDERS[3], "OUTWARD", 37, SEED_WAREHOUSES[0], null, [
    { productId: "p-10", variantId: "var-05", quantity: 6 },
    { productId: "p-07", quantity: 4 },
  ]),
  seedMovement("sm-07", "SM-2026-0024", SEED_ORDERS[3], "INWARD", 33, SEED_WAREHOUSES[0], null, [
    { productId: "p-10", variantId: "var-05", quantity: 6 },
    { productId: "p-07", quantity: 4 },
  ]),
  seedMovement("sm-04", "SM-2026-0030", SEED_ORDERS[1], "OUTWARD", 25, SEED_WAREHOUSES[1], null, [
    { productId: "p-09", quantity: 2 },
    { productId: "p-11", quantity: 6 },
  ]),
  seedMovement("sm-05", "SM-2026-0033", SEED_ORDERS[1], "INWARD", 22, SEED_WAREHOUSES[1], "Two stage decks water-damaged", [
    { productId: "p-09", quantity: 2 },
    { productId: "p-11", quantity: 6 },
  ]),
  seedMovement("sm-01", "SM-2026-0041", SEED_ORDERS[0], "OUTWARD", 6, SEED_WAREHOUSES[0], "Loaded 06:30, two trips", [
    { productId: "p-01", quantity: 1 },
    { productId: "p-04", variantId: "var-01", quantity: 72 },
    { productId: "p-04", variantId: "var-02", quantity: 8 },
    { productId: "p-07", quantity: 8 },
  ]),
  seedMovement("sm-02", "SM-2026-0048", SEED_ORDERS[0], "INWARD", 3, SEED_WAREHOUSES[0], "All returned, two chairs scuffed", [
    { productId: "p-01", quantity: 1 },
    { productId: "p-04", variantId: "var-01", quantity: 72 },
    { productId: "p-04", variantId: "var-02", quantity: 8 },
    { productId: "p-07", quantity: 8 },
  ]),
  seedMovement("sm-03", "SM-2026-0052", SEED_ORDERS[2], "OUTWARD", 1, SEED_WAREHOUSES[1], null, [
    { productId: "p-02", quantity: 1 },
    { productId: "p-09", quantity: 2 },
    { productId: "p-11", quantity: 12 },
  ]),
];

/**
 * Credit notes are read per customer, never company-wide. appliedAmount is
 * zero on every one of them because nothing in the rebuild applies a credit —
 * the apply/cancel/reverse transitions live in stored procedures that have
 * not been read, so ISSUED is the only status any of these can be in.
 */
export const SEED_CREDIT_NOTES: CreditNoteView[] = [
  {
    id: "cn-01",
    companyId: COMPANY_ID,
    creditNoteNumber: "CN-2026-0012",
    customerId: SEED_CUSTOMERS[0].id,
    againstOrderId: SEED_ORDERS[0].id,
    amount: inr(4500),
    appliedAmount: inr(0),
    status: "ISSUED",
    issuedOn: new Date(Date.now() - 86_400_000 * 11).toISOString().slice(0, 10),
    reason: "Two uplights failed on the night; partial credit agreed",
  },
  {
    id: "cn-02",
    companyId: COMPANY_ID,
    creditNoteNumber: "CN-2026-0015",
    customerId: SEED_CUSTOMERS[0].id,
    againstOrderId: null,
    amount: inr(2000),
    appliedAmount: inr(0),
    status: "ISSUED",
    issuedOn: new Date(Date.now() - 86_400_000 * 4).toISOString().slice(0, 10),
    reason: "Goodwill credit after late dispatch",
  },
  {
    id: "cn-03",
    companyId: COMPANY_ID,
    creditNoteNumber: "CN-2026-0009",
    customerId: SEED_CUSTOMERS[2].id,
    againstOrderId: SEED_ORDERS[2].id,
    amount: inr(11750),
    appliedAmount: inr(0),
    status: "ISSUED",
    issuedOn: new Date(Date.now() - 86_400_000 * 22).toISOString().slice(0, 10),
    reason: "Stage deck shortfall, one section never delivered",
  },
];

export const SEED_NOTIFICATIONS: NotificationLogView[] = [
  { id: "n-01", companyId: COMPANY_ID, channel: "EMAIL", templateKey: "quotation.sent", recipient: "rhea.kapoor@example.com", subjectReference: "QT-2026-0184", status: "SENT", attemptedAt: minutesAgo(8) },
  { id: "n-02", companyId: COMPANY_ID, channel: "EMAIL", templateKey: "deposit.refunded", recipient: "amit.shah@example.com", subjectReference: "ORD-2026-0088", status: "PENDING", attemptedAt: minutesAgo(21) },
  { id: "n-03", companyId: COMPANY_ID, channel: "WHATSAPP", templateKey: "order.confirmed", recipient: "+91 98200 11223", subjectReference: "ORD-2026-0091", status: "SKIPPED", attemptedAt: minutesAgo(54) },
  { id: "n-04", companyId: COMPANY_ID, channel: "EMAIL", templateKey: "quotation.reminder", recipient: "no-such-host@invalid.example", subjectReference: "QT-2026-0177", status: "FAILED", failureReason: "550 5.1.2 Domain not found", attemptedAt: minutesAgo(96) },
  { id: "n-05", companyId: COMPANY_ID, channel: "EMAIL", templateKey: "order.dispatched", recipient: "events@grandpalace.example", subjectReference: "ORD-2026-0090", status: "SENT", attemptedAt: minutesAgo(140) },
  { id: "n-06", companyId: COMPANY_ID, channel: "WHATSAPP", templateKey: "order.dispatched", recipient: "+91 99300 44556", subjectReference: "ORD-2026-0090", status: "SKIPPED", attemptedAt: minutesAgo(141) },
  { id: "n-07", companyId: COMPANY_ID, channel: "EMAIL", templateKey: "quotation.sent", recipient: "rhea.kapoor@example.com", subjectReference: "QT-2026-0184", status: "FAILED", failureReason: "Connection timed out after 30s", attemptedAt: minutesAgo(260) },
  { id: "n-08", companyId: COMPANY_ID, channel: "EMAIL", templateKey: "quotation.accepted", recipient: "sales@tentvaale.example", subjectReference: "QT-2026-0169", status: "SENT", attemptedAt: minutesAgo(430) },
  { id: "n-09", companyId: COMPANY_ID, channel: "EMAIL", templateKey: "deposit.forfeited", recipient: "neha.r@example.com", subjectReference: "ORD-2026-0089", status: "SENT", attemptedAt: minutesAgo(900) },
  { id: "n-10", companyId: COMPANY_ID, channel: "WHATSAPP", templateKey: "quotation.sent", recipient: "+91 98110 77889", subjectReference: "QT-2026-0180", status: "FAILED", failureReason: "Recipient has not opted in to WhatsApp messages", attemptedAt: minutesAgo(1320) },
  { id: "n-11", companyId: COMPANY_ID, channel: "EMAIL", templateKey: "order.confirmed", recipient: "amit.shah@example.com", subjectReference: "ORD-2026-0088", status: "SENT", attemptedAt: minutesAgo(1800) },
  { id: "n-12", companyId: COMPANY_ID, channel: "EMAIL", templateKey: "quotation.expired", recipient: "vendor.desk@example.com", subjectReference: "QT-2026-0071", status: "SENT", attemptedAt: minutesAgo(2600) },
];

/**
 * One per seeded order, each holding exactly that order's security deposit and
 * at a status its order agrees with: still held while goods are out or not yet
 * sent, settled on the two completed orders.
 */
export const SEED_DEPOSITS: DepositLedgerView[] = [
  {
    id: "dep-01", companyId: COMPANY_ID,
    orderId: "33333333-3333-3333-3333-333333333301",
    accountId: SEED_CUSTOMERS[0].id,
    amountHeld: inr(5000), amountRefunded: inr(0), amountForfeited: inr(0),
    status: "HELD",
    heldAt: minutesAgo(60 * 24 * 9),
  },
  {
    id: "dep-02", companyId: COMPANY_ID,
    orderId: "33333333-3333-3333-3333-333333333302",
    accountId: SEED_CUSTOMERS[1].id,
    amountHeld: inr(9000), amountRefunded: inr(0), amountForfeited: inr(3500),
    status: "FORFEITED",
    reason: "Two stage decks returned water-damaged",
    heldAt: minutesAgo(60 * 24 * 26), settledAt: minutesAgo(60 * 24 * 2),
  },
  {
    id: "dep-03", companyId: COMPANY_ID,
    orderId: "33333333-3333-3333-3333-333333333303",
    accountId: SEED_CUSTOMERS[2].id,
    amountHeld: inr(19800), amountRefunded: inr(0), amountForfeited: inr(0),
    status: "HELD",
    heldAt: minutesAgo(60 * 24 * 14),
  },
  {
    id: "dep-04", companyId: COMPANY_ID,
    orderId: "33333333-3333-3333-3333-333333333304",
    accountId: SEED_CUSTOMERS[3].id,
    amountHeld: inr(5000), amountRefunded: inr(5000), amountForfeited: inr(0),
    status: "REFUNDED",
    heldAt: minutesAgo(60 * 24 * 40), settledAt: minutesAgo(60 * 24 * 31),
  },
  {
    id: "dep-05", companyId: COMPANY_ID,
    orderId: "33333333-3333-3333-3333-333333333305",
    accountId: SEED_CUSTOMERS[4].id,
    amountHeld: inr(10000), amountRefunded: inr(0), amountForfeited: inr(0),
    status: "HELD",
    heldAt: minutesAgo(60 * 24 * 3),
  },
];

/**
 * Deposit lookups take an order id, and nobody can type a UUID from memory, so
 * the screen offers these as one-click examples in the mock build.
 *
 * Built from the seed rather than from live state on purpose: it is static, so
 * it renders identically on the server and the client. The live status is shown
 * by the page itself once a deposit is loaded.
 */
export const DEMO_DEPOSIT_EXAMPLES = SEED_DEPOSITS.map((deposit) => ({
  orderId: deposit.orderId,
  orderNumber:
    SEED_ORDERS.find((order) => order.id === deposit.orderId)?.number ??
    deposit.orderId.slice(0, 8),
}));

/** The same one-click affordance for every other screen that looks up by id:
 *  only the records the mock actually holds in full are offered. */
export const DEMO_QUOTATION_EXAMPLES = SEED_QUOTATION_DETAILS.map((quotation) => ({
  id: quotation.id,
  label: `${quotation.quotationNumber} · ${quotation.status}`,
}));

export const DEMO_ORDER_EXAMPLES = SEED_ORDER_DETAILS.map((order) => ({
  id: order.id,
  label: order.orderNumber,
}));

export const DEMO_MOVEMENT_ORDER_EXAMPLES = [
  ...new Set(SEED_STOCK_MOVEMENTS.map((movement) => movement.orderId)),
].map((orderId) => ({
  id: orderId,
  label: SEED_ORDERS.find((order) => order.id === orderId)?.number ?? orderId.slice(0, 8),
}));

export const DEMO_CREDIT_CUSTOMER_EXAMPLES = [
  ...new Set(SEED_CREDIT_NOTES.map((note) => note.customerId)),
].map((customerId) => ({
  id: customerId,
  label: SEED_CUSTOMERS.find((customer) => customer.id === customerId)?.fullName ?? customerId,
}));

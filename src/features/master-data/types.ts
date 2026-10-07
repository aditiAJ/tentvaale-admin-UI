import type { Money } from "@/lib/money";
import type { ProductSetting, RateType } from "@/features/master-data/storefront";

/**
 * One image or video attached to a catalogue record — a product, a category,
 * a bundle or a featured collection. Nothing transactional carries media.
 *
 * Shaped like what an upload endpoint would hand back — an id and a URL to
 * render, plus the file's own name, type and size — so a real upload API can
 * replace features/master-data/media without the models changing.
 *
 * There is no upload endpoint yet, so in the mock `url` is one of two things:
 * a seeded image under /mock-media (see mock-data/media), or one the admin
 * picked, which is local to the browser — an image downscaled into a data URL
 * saved with the product, or a video as an object URL that lasts only as long
 * as the page. `url` is null for a video whose preview did not survive a
 * reload; its name, type and size still did.
 */
export interface MediaAsset {
  id: string;
  kind: "IMAGE" | "VIDEO";
  fileName: string;
  contentType: string;
  sizeBytes: number;
  url: string | null;
  /** Set for images uploaded to storage; shown wherever a small picture is enough. */
  thumbnailUrl?: string | null;
  width?: number | null;
  height?: number | null;
}

/** Shown wherever a record has no image — including every product in api mode. */
export const FALLBACK_IMAGE = "/mock-media/placeholder.svg";

/** The most a product can carry, enforced by the form and the mock alike. */
export const PRODUCT_MEDIA_LIMITS = { images: 5, videos: 1 } as const;

/** A category, bundle or featured collection: one representative image, no video. */
export const CATALOGUE_MEDIA_LIMITS = { images: 1, videos: 0 } as const;

export interface MediaLimits {
  images: number;
  videos: number;
}

/**
 * What the storefront shows about a product beyond its name, price and images:
 * the spec table on a product page and the facets its catalogue filters by.
 * The names are the storefront's own, so one can be passed to the other as is.
 */
/** Feet and inches only. Older rows in centimetres or metres are converted when they are read. */
export const DIMENSION_UNITS = ["ft", "in"] as const;
export type DimensionUnit = (typeof DIMENSION_UNITS)[number];

/** A product's real size: length, width, height. Any side may be absent (a rug has no height); one unit covers all three. */
export interface ProductDimensions {
  length: number | null;
  width: number | null;
  height: number | null;
  unit: DimensionUnit;
}

export interface ProductStorefrontDetails {
  /** What the retail rate is counted in: per unit, per running foot or per square foot. */
  rateType: RateType;
  /**
   * An older free-text size note ("40 × 45 × 92 cm"). The product form no longer edits it
   * (it edits `dimensions`), and sends it back unchanged so saving never drops it.
   */
  size: string | null;
  /** Length, width and height with their unit. Absent in mock mode. */
  dimensions?: ProductDimensions | null;
  /** How much floor a roll or runner covers. Not edited in the form; sent back so a save keeps it. */
  maxCoverageSqft?: number | null;
  setting: ProductSetting | null;
  colours: string[];
  materials: string[];
  /** Upholstery or drape fabrics it can be ordered in. Empty for most products. */
  fabrics: string[];
  /** From MOODS; the storefront filters on these. */
  moods: string[];
  /** From THEMES; the storefront filters on these. */
  themes: string[];
  /**
   * The rest of the spec table, which differs by kind of product — "Seating
   * capacity" for a chair, "Power source" for a light. Keys are shown as
   * labels, in the order they were entered.
   */
  attributes: Record<string, string>;
}

/**
 * Started as a mirror of com.tentvaale.masterdata.api.ProductView, and has
 * since moved ahead of it: `genericName` and the wholesale/retail pair
 * are this UI's proposal, and the backend's single rentalRate and per-product
 * securityDeposit were dropped. A security deposit is taken per booking, on
 * the quotation, not per product.
 *
 * A product is filed under one category and one of that category's
 * sub-categories, stored as ids. The names are resolved when products are
 * listed, so renaming a category or sub-category reaches every product in it.
 * All four are nullable for legacy data: md_product.category_id is
 * deliberately not a foreign key ("keeping it loose here matches how products
 * reference categories in the legacy data, which has orphans"), so a product
 * with no category must still render. Saving one requires choosing both.
 */
export interface ProductView extends Partial<ProductStorefrontDetails> {
  id: string;
  companyId: string;
  sku: string;
  /** Who owns the stock behind this SKU: "Tentvaale", or a partner it sub-hires from. */
  skuOwner: string;
  name: string;
  /** What the product is, without its size or finish: "Canopy" for "10x10 Canopy". */
  genericName: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  subCategoryId: string | null;
  subCategoryName: string | null;
  /** Per day. Not used in pricing yet: every quotation line is priced at retail. */
  wholesaleRate: Money;
  /** Per day, and the rate a quotation line is priced at. */
  retailRate: Money;
  /**
   * Whether the product comes in selectable variations (colour, size,
   * finish). Only a product with this set can have variants. It cannot be
   * unset while any exist, nor set while any of the product is held in a
   * warehouse or out on rent without a variant.
   */
  hasVariants: boolean;
  /** Every product has at least one variant (the default, hidden while it is the only one). */
  variants: ProductVariantView[];
  /** The facets this product's variants vary on, in display order. Empty until the admin picks (the demo data has none). */
  axes?: VariantAxis[];
  /**
   * Images first, in the order they were added, then the video if any.
   * Optional because the real ProductView has no media: in api mode it is
   * always absent, so every reader must fall back rather than assume it.
   */
  media?: MediaAsset[];
  active: boolean;
}

/**
 * One version of a product — "Red", "6ft", "Large" — priced and stocked on its
 * own. Belongs to exactly one product; its name is unique within that product,
 * case-insensitively.
 *
 * Stock is not a field to edit here: it lives in the warehouse–product
 * relationship, which carries the variant, so a variant's stock is what its
 * warehouses hold. `stock` is that total, resolved when products are listed.
 */
export interface ProductVariantView {
  id: string;
  companyId: string;
  productId: string;
  name: string;
  /** Per day, like the product's own rates. */
  wholesaleRate: Money;
  retailRate: Money;
  /** Units across every warehouse. Read-only; written in the Stock grid. */
  stock: number;
  /** Generated as `<product SKU>-V01`, `-V02`. */
  sku?: string;
  isDefault?: boolean;
  active?: boolean;
  /** True when the variant sits on the product's axes (so the axes can no longer change). */
  hasAttributes?: boolean;
}

export interface VariantAxis {
  facetId: string;
  code: string;
  label: string;
}

/** A shared facet (colour, fabric, size ...) and its values: what an axis is picked from. */
export interface FacetOption {
  id: string;
  code: string;
  label: string;
  values: { id: string; value: string; active: boolean }[];
}

/** One cell of the combination grid: a value per axis, and the variant already holding it. */
export interface VariantCombination {
  valueIds: string[];
  label: string;
  existingVariantId: string | null;
}

export interface StockGrid {
  variants: { id: string; name: string; sku: string; active: boolean }[];
  warehouses: { id: string; name: string }[];
  cells: { variantId: string; warehouseId: string; quantity: number }[];
  /** What customers are shown: the sum of the active variants' cells. */
  shownToCustomers: number;
}

export interface CreateProductVariantRequest {
  name: string;
  wholesaleRate: number;
  retailRate: number;
}

export type UpdateProductVariantRequest = CreateProductVariantRequest;

/** Every storefront detail is sent in full: on update, a list left empty is cleared. */
export interface CreateProductRequest extends ProductStorefrontDetails {
  /** An existing category. Must be active, unless the product is already in it. */
  categoryId: string;
  /** One of that category's sub-categories. */
  subCategoryId: string;
  /** Not sent by the form: a new product is numbered by the system (FUR-001), and a SKU never changes once given. */
  sku?: string;
  /** Who owns the stock behind the SKU; Tentvaale unless it is sub-hired from a partner. */
  skuOwner: string;
  name: string;
  genericName: string;
  description?: string;
  wholesaleRate: number;
  retailRate: number;
  hasVariants: boolean;
  /** The full set to keep: on update, anything left out is removed. */
  media: MediaAsset[];
}

/** The same fields as a create; every one is replaced. */
export type UpdateProductRequest = CreateProductRequest;

/**
 * Mirrors com.tentvaale.masterdata.internal.Category — there is no
 * CategoryView on the backend yet because MasterDataApi exposes no category
 * endpoint at all (CategoryRepository is only used internally to resolve a
 * product's categoryName). This shape is this UI's best guess at what a future
 * endpoint would return, kept close to the entity so nothing has to change
 * when the backend catches up.
 */
export interface CategoryView {
  id: string;
  companyId: string;
  name: string;
  active: boolean;
  /** One representative image, or none. Sub-categories carry no media. */
  media: MediaAsset[];
  /**
   * Its sub-categories, sorted by name. Stored apart from the category, each
   * pointing back by categoryId, and gathered here when categories are
   * listed. One level only: a sub-category has no sub-categories of its own.
   */
  subCategories: SubCategoryView[];
  /** What new products in this category have their SKU start with: FUR gives FUR-001. Absent in mock mode. */
  skuPrefix?: string | null;
}

/**
 * A finer grouping inside exactly one category — "Chandeliers" under
 * "Lighting". Every product is filed under one, alongside its category.
 */
export interface SubCategoryView {
  id: string;
  companyId: string;
  categoryId: string;
  name: string;
}

export interface CreateCategoryRequest {
  name: string;
  /** Names of sub-categories to create with it. Optional; none is valid. */
  subCategories?: string[];
  /** At most one image. On update, the full set to keep: an empty list removes it. */
  media: MediaAsset[];
  /** 2 to 6 letters or digits. Left out, the backend takes it from the name. */
  skuPrefix?: string;
}

export type CustomerType = "CUSTOMER" | "EVENT_PLANNER";

export type PlannerStatus = "PENDING" | "APPROVED" | "REJECTED";

/** An event planner's trade-pricing application and where it stands. */
export interface PlannerProfileView {
  customerId: string;
  customerName: string | null;
  businessName: string;
  yearsInBusiness: string | null;
  about: string | null;
  status: PlannerStatus;
  /** Set only while the status is REJECTED. */
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

/**
 * A back-office customer record (masterdata's md_customer). A storefront account is a separate
 * record linked 1:1 through `storefrontAccountId`; staff-created customers have none.
 *
 * The backend omits null fields, so everything but the first five is optional.
 */
export interface CustomerView {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  accountType: CustomerType;
  gstin?: string | null;
  /** Place of supply: decides CGST + SGST (the company's state) or IGST. Needed before a quotation is sent. */
  state?: string | null;
  active?: boolean;
  storefrontAccountId?: string | null;
  /** Present once the customer, an event planner, has applied for trade pricing. */
  plannerProfile?: PlannerProfileView | null;
  /** The price list this planner is on. Managed with price lists (a later module). */
  priceListId?: string | null;
}

/**
 * Bundles, warehouses and trucks have no entity, no table and no endpoint —
 * masterdata's package-info names them as intended scope, and the V300
 * migration creates only md_category and md_product. These shapes are this
 * UI's own invention, kept minimal so there is little to unpick when the
 * backend defines the real ones.
 */
export interface BundleView extends BundleStorefrontDetails {
  id: string;
  companyId: string;
  name: string;
  /**
   * The existing products the bundle packages, each with how many of it, in
   * the order they were added. Stored as product ids and quantities only, so a
   * product edit reaches every bundle it is in, and a product can sit in any
   * number of bundles. At most one component per product.
   */
  components: BundleComponentView[];
  /**
   * The bundle's own price, set by hand. Deliberately not derived from its
   * components' rates: a bundle is a package deal, and what it sells for is a
   * pricing decision rather than a sum.
   */
  rentalRate: Money;
  /** Percent off the one-day sum, set by the admin (0 to 90). Real backend only. */
  discountPercent?: number;
  /** The one-day sum after the discount. Real backend only. */
  discountedPrice?: Money;
  /** The bundle's own representative image, not a composite of its products'. */
  media: MediaAsset[];
  /**
   * The occasions it is styled for, in the occasions' own display order.
   * Stored as ids, so renaming an occasion renames it on every bundle.
   */
  occasions: BundleOccasionRef[];
  /** Inactive bundles stay on record but are not on the storefront. */
  active?: boolean;
}

/**
 * An occasion a bundle can be filed under — Haldi, Reception, Diwali. The
 * storefront's bundles page shows the active ones as its filter row, in
 * `sortOrder`. Switched off rather than deleted, like a category: bundles keep
 * an inactive occasion, it just stops being offered as a filter.
 *
 * This UI's own invention, like bundles: there is no backend for it.
 */
export interface BundleOccasionView {
  id: string;
  companyId: string;
  name: string;
  active: boolean;
  /** Position in the storefront's filter row, from 1. */
  sortOrder: number;
  /** How many bundles are filed under it. */
  bundleCount: number;
}

/** An occasion as a bundle shows it. */
export interface BundleOccasionRef {
  id: string;
  name: string;
  active: boolean;
}

export interface CreateBundleOccasionRequest {
  name: string;
}

export type UpdateBundleOccasionRequest = CreateBundleOccasionRequest;

/** How many occasions one bundle can be filed under. */
export const BUNDLE_OCCASION_LIMIT = 6;

/**
 * A bundle's storefront page: a one-line tagline under the name, a paragraph,
 * the guest range and setup time shown as facts, and a few highlight bullets.
 * The piece count the page also shows is the number of products in the
 * bundle, so it is not stored.
 */
export interface BundleStorefrontDetails {
  tagline: string | null;
  description: string | null;
  /** Free text, since the storefront says "200–500" as readily as "Home · up to 40". */
  guests: string | null;
  /** Free text: "10 hours". */
  setupTime: string | null;
  /** At most BUNDLE_HIGHLIGHT_LIMIT short lines, in display order. */
  highlights: string[];
  /** The real backend keeps the guest range and setup time as numbers; `guests` and `setupTime` are built from them. */
  guestMin?: number | null;
  guestMax?: number | null;
  setupHours?: number | null;
}

export const BUNDLE_HIGHLIGHT_LIMIT = 6;

/** One product in a bundle, resolved from the catalogue for display. */
export interface BundleComponentView {
  productId: string;
  productName: string;
  sku: string;
  /** A whole number of at least one. */
  quantity: number;
  /** False once the product itself is deactivated; it stays in the bundle. */
  active: boolean;
  /** Set for a product that has variants: the one this line is. */
  variantId?: string | null;
  variantName?: string | null;
  /** The only alternatives a customer may swap this line for (curated by staff). */
  swapOptions?: BundleSwapView[];
}

/** One curated alternative for a bundle line. */
export interface BundleSwapView {
  productId: string;
  productName: string;
  variantId?: string | null;
  variantName?: string | null;
}

/**
 * A curated, storefront-facing selection of existing products around a theme —
 * "Royal Wedding Collection". Unlike a bundle it has no price and is not quoted
 * as a package: it is presentation, and its products stay independent.
 *
 * Stored as an ordered list of product ids, so nothing is copied from a
 * product, a product can sit in any number of collections, and taking one out
 * of a collection touches only that list. `products` is resolved from the live
 * catalogue when collections are listed, in the collection's own order.
 *
 * This UI's own invention, like bundles: there is no backend for it.
 */
export interface FeaturedCollectionView {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  /** Inactive collections stay listed here, so they can be switched back on. */
  active: boolean;
  /** The collection's hero image, separate from its products' own. */
  media: MediaAsset[];
  /** The occasions the storefront recommends it for — "Wedding", "Sangeet". */
  bestFor: string[];
  /** The same occasions by id, for editing (real backend). */
  occasionIds?: string[];
  /** Its colour story, as one line: "Crimson · Antique gold · Ivory". */
  palette: string | null;
  products: FeaturedCollectionProduct[];
}

/** A product as a collection shows it: enough to render a chip, nothing more. */
export interface FeaturedCollectionProduct {
  productId: string;
  name: string;
  sku: string;
  /** The product's first image, if it has one. */
  imageUrl: string | null;
  /** False once the product itself is deactivated; it stays in the collection. */
  active: boolean;
}

export interface WarehouseView {
  id: string;
  companyId: string;
  name: string;
  /**
   * Street address the depot is actually at, as one free-text block.
   *
   * Kept as a single string rather than split into line1/line2/pincode because
   * nothing here consumes the parts: there is no geocoding, no route planning
   * and no printed label. `city` stays alongside it rather than being folded
   * in, because it is the field the table scans by and an address is not
   * reliably parseable back into one.
   */
  address: string;
  city: string;
  /** An inactive warehouse takes no new stock. */
  active?: boolean;
}

/**
 * One product held at one warehouse, and how many of it.
 *
 * A relationship rather than a list on WarehouseView, so the same product can
 * sit in several warehouses with independent counts and a product is never
 * copied into a warehouse. There is at most one of these per warehouse +
 * product + variant: adding one the warehouse already holds raises `quantity`,
 * and two variants of a product never share a count.
 * `productName` and `sku` are resolved for display, the way ProductView
 * resolves `categoryName`, and are not part of the relationship itself.
 */
export interface WarehouseProductView {
  warehouseId: string;
  productId: string;
  /**
   * The variant this stock is of, for a product that has variants. Null for a
   * product without them. A product cannot gain variants while it has stock
   * like this, so it is never left stranded under a product that demands one.
   */
  variantId: string | null;
  productName: string;
  variantName: string | null;
  quantity: number;
}

/** A rental supplier. Admin-only: supplier identity is never shown on the storefront. */
export interface SupplierView {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  addressLine: string | null;
  gstin: string | null;
  active: boolean;
}

/** How many of a product (or variant) a supplier can provide. Set, not added to. */
export type SupplierStockView = WarehouseProductView;

export interface TruckView {
  id: string;
  companyId: string;
  registration: string;
  /** Legacy computes load from product volume against this; neither is modelled. */
  capacityKg: number;
  /** An inactive truck is kept on record but not offered. */
  active?: boolean;
}

// ---------------------------------------------------------------------------
// Write shapes for the modules the backend has not defined yet.
//
// Everything below this line describes an endpoint that does not exist. Four of
// these modules — categories, bundles, warehouses and trucks — have no
// controller at all, and customers have an entity but nothing admin-facing that
// reaches it, so there is no contract to mirror and these are this UI's
// proposal for one. They are kept deliberately dull: a create that takes the
// fields the view shows, an update that takes the same fields, and a delete
// that takes nothing. When the backend defines the real ones, the argument
// should be about field names, not about shape.
//
// The rules the mock enforces against them (unique names, a warehouse that is
// referenced refusing to be deleted, a category deactivating rather than
// vanishing) are likewise invented rather than mirrored — see mock-data/store.
// ---------------------------------------------------------------------------

/**
 * The category's name and the complete set of sub-categories it should have
 * afterwards. An entry with an id renames that sub-category, one without adds
 * a new one, and any current sub-category left out is removed — refused while
 * a product is still filed under it.
 */
export interface UpdateCategoryRequest {
  name: string;
  subCategories: { id?: string; name: string }[];
  media: MediaAsset[];
  /** Left out or blank keeps the current code; a new one only affects products created afterwards. */
  skuPrefix?: string;
}

export interface CreateWarehouseRequest {
  name: string;
  /** Sent on edit; leaving it out on the real backend means active. */
  active?: boolean;
  /** Required, like every other field a warehouse carries — see WarehouseView. */
  address: string;
  city: string;
}

export type UpdateWarehouseRequest = CreateWarehouseRequest;

/**
 * Adds `quantity` of a product to the warehouse in the path. The same call
 * both creates the relationship and tops it up, so there is no separate
 * "set quantity" and no way to remove a product from a warehouse.
 */
export interface AddWarehouseProductRequest {
  productId: string;
  /** Required when the product has variants; refused when it does not. */
  variantId?: string;
  /** A whole number of at least one. */
  quantity: number;
}

export interface CreateTruckRequest {
  registration: string;
  capacityKg: number;
  active?: boolean;
}

export interface SupplierRequest {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  addressLine?: string;
  gstin?: string;
  active?: boolean;
}

export interface SetSupplierStockRequest {
  productId: string;
  variantId?: string;
  /** Zero is allowed: the supplier has none right now. */
  quantity: number;
}

export type UpdateTruckRequest = CreateTruckRequest;

/** The storefront details are replaced in full, like the component list. */
export interface CreateBundleRequest extends BundleStorefrontDetails {
  name: string;
  /**
   * The complete component list. At least one; each product at most once —
   * adding more of a product means raising its quantity, not a second entry.
   * On update, a product left out is removed from the bundle only. A product with variants
   * must name one; each line may list curated swap options.
   */
  components: {
    productId: string;
    variantId?: string;
    quantity: number;
    swapOptions?: { productId: string; variantId?: string }[];
  }[];
  /**
   * Ignored by the real backend: a bundle's price is derived from its items (ADR-005), so it is
   * never typed in. Only the demo data still reads it.
   */
  rentalRate?: number;
  /** Percent off the one-day sum, 0 to 90. */
  discountPercent?: number;
  /** At most one image. On update, the full set to keep: an empty list removes it. */
  media: MediaAsset[];
  /**
   * Existing occasion ids, at most BUNDLE_OCCASION_LIMIT, none twice. An
   * occasion must be active to be added; one already on the bundle may stay.
   */
  occasionIds: string[];
}

export type UpdateBundleRequest = CreateBundleRequest;

export interface CreateFeaturedCollectionRequest {
  name: string;
  description?: string;
  /** Existing product ids, in display order. At least one; no repeats. */
  productIds: string[];
  /** The hero: at most one image. On update, an empty list removes it. */
  media: MediaAsset[];
  bestFor: string[];
  /** Occasion ids (real backend). When given, `bestFor` is ignored. */
  occasionIds?: string[];
  palette?: string;
}

/** The full product list to keep: a product left out is removed from the collection only. */
export type UpdateFeaturedCollectionRequest = CreateFeaturedCollectionRequest;

export interface CreateCustomerRequest {
  email: string;
  fullName: string;
  phone?: string;
  accountType: CustomerType;
  gstin?: string;
  state?: string;
}

export interface PlannerApplicationRequest {
  businessName: string;
  yearsInBusiness?: string;
  about?: string;
}

export type UpdateCustomerRequest = CreateCustomerRequest;

// ---------------------------------------------------------------------------
// Price lists and payment setup (real backend only).
// ---------------------------------------------------------------------------

/** One explicit trade rate on a price list: a product, or one variant of it. */
export interface PriceListItemView {
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  dailyRate: number;
}

/**
 * Trade pricing for verified event planners. An explicit rate here wins; otherwise the default
 * discount comes off the standard rate. Only an approved planner on an active list gets it.
 */
export interface PriceListView {
  id: string;
  name: string;
  /** Percentage off the standard rate for products with no explicit rate, 0 to 100. */
  defaultDiscountPercent: number;
  active: boolean;
  items: PriceListItemView[];
}

export interface PriceListRequest {
  name: string;
  defaultDiscountPercent: number;
  active?: boolean;
  /** The complete set of explicit rates; one per product (or variant). */
  items: { productId: string; variantId?: string; dailyRate: number }[];
}

/** A way a customer can pay: Cash, UPI, Bank transfer. Switched off rather than deleted. */
export interface PaymentModeView {
  id: string;
  name: string;
  active: boolean;
}

export interface PaymentModeRequest {
  name: string;
  active?: boolean;
}

/** One instalment of a payment-terms template, as a share of the total. */
export interface PaymentTermsLine {
  description: string;
  percentage: number;
}

/** A reusable payment schedule, such as "50% on booking, 50% before the event". Lines add up to 100%. */
export interface PaymentTermsView {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  details: PaymentTermsLine[];
}

export interface PaymentTermsRequest {
  name: string;
  description?: string;
  active?: boolean;
  details: PaymentTermsLine[];
}

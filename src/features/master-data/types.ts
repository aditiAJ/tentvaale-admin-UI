import type { Money } from "@/lib/money";

/**
 * One image or video attached to a product.
 *
 * Shaped like what an upload endpoint would hand back — an id and a URL to
 * render, plus the file's own name, type and size — so a real upload API can
 * replace features/master-data/media without the product model changing.
 *
 * There is no upload endpoint yet, so in the mock `url` is local to the
 * browser: an image is downscaled into a data URL that is saved with the
 * product, and a video is an object URL that lasts only as long as the page.
 * `url` is null for a video whose preview did not survive a reload; its
 * name, type and size still did.
 */
export interface ProductMedia {
  id: string;
  kind: "IMAGE" | "VIDEO";
  fileName: string;
  contentType: string;
  sizeBytes: number;
  url: string | null;
}

/** The most a product can carry, enforced by the form and the mock alike. */
export const PRODUCT_MEDIA_LIMITS = { images: 6, videos: 1 } as const;

/**
 * Started as a mirror of com.tentvaale.masterdata.api.ProductView, and has
 * since moved ahead of it: `genericName`, `tag` and the wholesale/retail pair
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
export interface ProductView {
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
  /**
   * The broad group the product is filed under for filtering — "Furniture",
   * "Lighting". Free text, and separate from Category: categories are
   * company-managed records a product points at loosely by id, while a tag is
   * whatever the admin types. Stored trimmed, so "Lighting " and "Lighting"
   * are the same tag.
   */
  tag: string;
  /** Per day. Not used in pricing yet: every quotation line is priced at retail. */
  wholesaleRate: Money;
  /** Per day, and the rate a quotation line is priced at. */
  retailRate: Money;
  /**
   * Whether the product comes in selectable variations (colour, size,
   * finish). Only a product with this set can have variants, and it cannot be
   * unset while any exist.
   */
  hasVariants: boolean;
  /** Its variants, sorted by name. Always empty when hasVariants is false. */
  variants: ProductVariantView[];
  /** Images first, in the order they were added, then the video if any. */
  media: ProductMedia[];
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
  /** Units across every warehouse. Read-only; added through a warehouse. */
  stock: number;
}

export interface CreateProductVariantRequest {
  name: string;
  wholesaleRate: number;
  retailRate: number;
}

export type UpdateProductVariantRequest = CreateProductVariantRequest;

export interface CreateProductRequest {
  /** An existing category. Must be active, unless the product is already in it. */
  categoryId: string;
  /** One of that category's sub-categories. */
  subCategoryId: string;
  sku: string;
  skuOwner: string;
  name: string;
  genericName: string;
  description?: string;
  tag: string;
  wholesaleRate: number;
  retailRate: number;
  hasVariants: boolean;
  /** The full set to keep: on update, anything left out is removed. */
  media: ProductMedia[];
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
  /**
   * Its sub-categories, sorted by name. Stored apart from the category, each
   * pointing back by categoryId, and gathered here when categories are
   * listed. One level only: a sub-category has no sub-categories of its own.
   */
  subCategories: SubCategoryView[];
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
}

/**
 * Mirrors com.tentvaale.identity.api.StorefrontAccountView.
 *
 * Customers live in the identity module, not master data, and the shape here
 * is the real one — but no admin-facing endpoint exposes it. Only the
 * storefront's own signup/login touch StorefrontAccount today.
 *
 * Note the missing companyId: a storefront account is deliberately NOT owned
 * by a tenant. It becomes associated with a company only through the
 * quotations and orders it creates, so "customers for my company" is a
 * transitive question the backend cannot answer directly yet.
 */
export interface CustomerView {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  accountType: "CUSTOMER" | "EVENT_PLANNER";
}

/**
 * Bundles, warehouses and trucks have no entity, no table and no endpoint —
 * masterdata's package-info names them as intended scope, and the V300
 * migration creates only md_category and md_product. These shapes are this
 * UI's own invention, kept minimal so there is little to unpick when the
 * backend defines the real ones.
 */
export interface BundleView {
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
}

/** One product in a bundle, resolved from the catalogue for display. */
export interface BundleComponentView {
  productId: string;
  productName: string;
  sku: string;
  /** A whole number of at least one. */
  quantity: number;
  /** False once the product itself is deactivated; it stays in the bundle. */
  active: boolean;
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
   * product without them — and for stock recorded before its product gained
   * variants, which stays as it was rather than being guessed into one.
   */
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string;
  quantity: number;
}

export interface TruckView {
  id: string;
  companyId: string;
  registration: string;
  /** Legacy computes load from product volume against this; neither is modelled. */
  capacityKg: number;
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
}

export interface CreateWarehouseRequest {
  name: string;
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
}

export type UpdateTruckRequest = CreateTruckRequest;

export interface CreateBundleRequest {
  name: string;
  /**
   * The complete component list. At least one; each product at most once —
   * adding more of a product means raising its quantity, not a second entry.
   * On update, a product left out is removed from the bundle only.
   */
  components: { productId: string; quantity: number }[];
  rentalRate: number;
}

export type UpdateBundleRequest = CreateBundleRequest;

export interface CreateFeaturedCollectionRequest {
  name: string;
  description?: string;
  /** Existing product ids, in display order. At least one; no repeats. */
  productIds: string[];
}

/** The full product list to keep: a product left out is removed from the collection only. */
export type UpdateFeaturedCollectionRequest = CreateFeaturedCollectionRequest;

export interface CreateCustomerRequest {
  email: string;
  fullName: string;
  phone?: string;
  accountType: CustomerView["accountType"];
}

export type UpdateCustomerRequest = CreateCustomerRequest;

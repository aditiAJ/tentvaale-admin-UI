import type { Money } from "@/lib/money";

/**
 * Mirrors com.tentvaale.masterdata.api.ProductView.
 *
 * `categoryName` rather than a category id, and it is nullable twice over: the
 * product may have no category, or may point at one that no longer exists.
 * md_product.category_id is deliberately not a foreign key ("keeping it loose
 * here matches how products reference categories in the legacy data, which has
 * orphans"), so the UI has to render a missing category as normal, not as an
 * error.
 */
export interface ProductView {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  description: string | null;
  categoryName: string | null;
  rentalRate: Money;
  securityDeposit: Money;
  active: boolean;
}

export interface CreateProductRequest {
  /** Optional, and not checked against md_category by the backend. */
  categoryId?: string;
  sku: string;
  name: string;
  description?: string;
  rentalRate: number;
  securityDeposit: number;
}

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
}

export interface CreateCategoryRequest {
  name: string;
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
  /** What the bundle contains, as product names — there is no line entity. */
  contents: string[];
  rentalRate: Money;
}

export interface WarehouseView {
  id: string;
  companyId: string;
  name: string;
  city: string;
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

export interface UpdateCategoryRequest {
  name: string;
}

export interface CreateWarehouseRequest {
  name: string;
  city: string;
}

export type UpdateWarehouseRequest = CreateWarehouseRequest;

export interface CreateTruckRequest {
  registration: string;
  capacityKg: number;
}

export type UpdateTruckRequest = CreateTruckRequest;

export interface CreateBundleRequest {
  name: string;
  /** Product names, because a bundle has no line entity to hold ids. */
  contents: string[];
  rentalRate: number;
}

export type UpdateBundleRequest = CreateBundleRequest;

export interface CreateCustomerRequest {
  email: string;
  fullName: string;
  phone?: string;
  accountType: CustomerView["accountType"];
}

export type UpdateCustomerRequest = CreateCustomerRequest;

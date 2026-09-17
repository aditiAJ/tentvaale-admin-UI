import { apiFetch } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";
import {
  mockCreateBundle,
  mockCreateCategory,
  mockCreateCustomer,
  mockCreateProduct,
  mockCreateTruck,
  mockCreateWarehouse,
  mockDeactivateCategory,
  mockDeleteBundle,
  mockDeleteTruck,
  mockDeleteWarehouse,
  mockListBundles,
  mockListCategories,
  mockListCustomers,
  mockListProducts,
  mockListTrucks,
  mockListWarehouses,
  mockUpdateBundle,
  mockUpdateCategory,
  mockUpdateCustomer,
  mockUpdateTruck,
  mockUpdateWarehouse,
} from "@/mock-data/store";
import type {
  BundleView,
  CategoryView,
  CreateBundleRequest,
  CreateCategoryRequest,
  CreateCustomerRequest,
  CreateProductRequest,
  CreateTruckRequest,
  CreateWarehouseRequest,
  CustomerView,
  ProductView,
  TruckView,
  UpdateBundleRequest,
  UpdateCategoryRequest,
  UpdateCustomerRequest,
  UpdateTruckRequest,
  UpdateWarehouseRequest,
  WarehouseView,
} from "@/features/master-data/types";

/**
 * Returns ACTIVE products only — the backend query is
 * findByCompanyIdAndActiveTrueOrderByNameAsc, already sorted by name. There is
 * no paging, no filter and no way to list inactive products yet, so the table
 * sorts and filters client-side over the full set.
 */
export function listProducts(signal?: AbortSignal): Promise<ProductView[]> {
  if (IS_MOCK) return mockListProducts();
  return apiFetch<ProductView[]>("/admin/master-data/products", { signal });
}

/** 422 if the SKU already exists for this company (case-insensitive). */
export function createProduct(request: CreateProductRequest): Promise<ProductView> {
  if (IS_MOCK) return mockCreateProduct(request);
  return apiFetch<ProductView>("/admin/master-data/products", {
    method: "POST",
    body: request,
  });
}

/**
 * MasterDataApi has no category endpoint yet — CategoryRepository is only used
 * internally to resolve a product's categoryName. This path is this UI's guess
 * at where the backend would expose it, following the same
 * /admin/master-data/{resource} shape as products; it will 404 in api mode
 * until the backend adds it.
 */
export function listCategories(signal?: AbortSignal): Promise<CategoryView[]> {
  if (IS_MOCK) return mockListCategories();
  return apiFetch<CategoryView[]>("/admin/master-data/categories", { signal });
}

export function createCategory(request: CreateCategoryRequest): Promise<CategoryView> {
  if (IS_MOCK) return mockCreateCategory(request);
  return apiFetch<CategoryView>("/admin/master-data/categories", {
    method: "POST",
    body: request,
  });
}

/**
 * Customers, bundles, warehouses and trucks have no backend at all.
 *
 * Customers at least have a real entity — identity's StorefrontAccount — but
 * only the storefront's signup/login touch it; nothing under /admin exposes
 * it. Bundles, warehouses and trucks have no entity and no table either:
 * masterdata's package-info names them as intended scope, and the schema
 * creates only md_category and md_product.
 *
 * These paths are therefore guesses at where each would land, following the
 * same shape as products. All four will 404 in api mode.
 */
export function listCustomers(signal?: AbortSignal): Promise<CustomerView[]> {
  if (IS_MOCK) return mockListCustomers();
  return apiFetch<CustomerView[]>("/admin/customers", { signal });
}

export function listBundles(signal?: AbortSignal): Promise<BundleView[]> {
  if (IS_MOCK) return mockListBundles();
  return apiFetch<BundleView[]>("/admin/master-data/bundles", { signal });
}

export function listWarehouses(signal?: AbortSignal): Promise<WarehouseView[]> {
  if (IS_MOCK) return mockListWarehouses();
  return apiFetch<WarehouseView[]>("/admin/master-data/warehouses", { signal });
}

export function listTrucks(signal?: AbortSignal): Promise<TruckView[]> {
  if (IS_MOCK) return mockListTrucks();
  return apiFetch<TruckView[]>("/admin/master-data/trucks", { signal });
}

// ---------------------------------------------------------------------------
// Writes against endpoints that do not exist yet.
//
// Every call below follows the REST shape products already uses —
// POST /{resource}, PUT /{resource}/{id}, DELETE /{resource}/{id} — so that
// when the backend defines these modules the client is already pointing at the
// obvious place. All of them 404 in api mode today. The rules they can fail on
// are enforced in mock-data/store and described there.
// ---------------------------------------------------------------------------

export function updateCategory(
  categoryId: string,
  request: UpdateCategoryRequest,
): Promise<CategoryView> {
  if (IS_MOCK) return mockUpdateCategory(categoryId, request);
  return apiFetch<CategoryView>(`/admin/master-data/categories/${categoryId}`, {
    method: "PUT",
    body: request,
  });
}

/**
 * Deactivates rather than deletes. md_category is a real table that products
 * point at loosely — category_id is deliberately not a foreign key, because the
 * legacy data has orphans — so removing a row would silently re-orphan every
 * product using it. CategoryView already carries `active`, and the list returns
 * active categories only, so deactivating is both the smaller change and the
 * one the existing shape was built for.
 */
export function deactivateCategory(categoryId: string): Promise<CategoryView> {
  if (IS_MOCK) return mockDeactivateCategory(categoryId);
  return apiFetch<CategoryView>(`/admin/master-data/categories/${categoryId}/deactivate`, {
    method: "POST",
  });
}

export function createWarehouse(request: CreateWarehouseRequest): Promise<WarehouseView> {
  if (IS_MOCK) return mockCreateWarehouse(request);
  return apiFetch<WarehouseView>("/admin/master-data/warehouses", {
    method: "POST",
    body: request,
  });
}

export function updateWarehouse(
  warehouseId: string,
  request: UpdateWarehouseRequest,
): Promise<WarehouseView> {
  if (IS_MOCK) return mockUpdateWarehouse(warehouseId, request);
  return apiFetch<WarehouseView>(`/admin/master-data/warehouses/${warehouseId}`, {
    method: "PUT",
    body: request,
  });
}

/** 422 when a stock movement still points at it — see the mock for why. */
export function deleteWarehouse(warehouseId: string): Promise<void> {
  if (IS_MOCK) return mockDeleteWarehouse(warehouseId);
  return apiFetch<void>(`/admin/master-data/warehouses/${warehouseId}`, { method: "DELETE" });
}

export function createTruck(request: CreateTruckRequest): Promise<TruckView> {
  if (IS_MOCK) return mockCreateTruck(request);
  return apiFetch<TruckView>("/admin/master-data/trucks", { method: "POST", body: request });
}

export function updateTruck(truckId: string, request: UpdateTruckRequest): Promise<TruckView> {
  if (IS_MOCK) return mockUpdateTruck(truckId, request);
  return apiFetch<TruckView>(`/admin/master-data/trucks/${truckId}`, {
    method: "PUT",
    body: request,
  });
}

export function deleteTruck(truckId: string): Promise<void> {
  if (IS_MOCK) return mockDeleteTruck(truckId);
  return apiFetch<void>(`/admin/master-data/trucks/${truckId}`, { method: "DELETE" });
}

export function createBundle(request: CreateBundleRequest): Promise<BundleView> {
  if (IS_MOCK) return mockCreateBundle(request);
  return apiFetch<BundleView>("/admin/master-data/bundles", { method: "POST", body: request });
}

export function updateBundle(bundleId: string, request: UpdateBundleRequest): Promise<BundleView> {
  if (IS_MOCK) return mockUpdateBundle(bundleId, request);
  return apiFetch<BundleView>(`/admin/master-data/bundles/${bundleId}`, {
    method: "PUT",
    body: request,
  });
}

export function deleteBundle(bundleId: string): Promise<void> {
  if (IS_MOCK) return mockDeleteBundle(bundleId);
  return apiFetch<void>(`/admin/master-data/bundles/${bundleId}`, { method: "DELETE" });
}

/**
 * A storefront account raised from the back office, for the customer who books
 * over the phone. The real StorefrontAccount is created by storefront signup
 * and carries a password; what an admin-created one would do about that is a
 * question for whoever builds the endpoint, and is why this shape asks for no
 * credential.
 */
export function createCustomer(request: CreateCustomerRequest): Promise<CustomerView> {
  if (IS_MOCK) return mockCreateCustomer(request);
  return apiFetch<CustomerView>("/admin/customers", { method: "POST", body: request });
}

export function updateCustomer(
  customerId: string,
  request: UpdateCustomerRequest,
): Promise<CustomerView> {
  if (IS_MOCK) return mockUpdateCustomer(customerId, request);
  return apiFetch<CustomerView>(`/admin/customers/${customerId}`, {
    method: "PUT",
    body: request,
  });
}

/** Query keys kept beside the calls they invalidate, so the two cannot drift. */
export const masterDataKeys = {
  products: ["master-data", "products"] as const,
  categories: ["master-data", "categories"] as const,
  customers: ["master-data", "customers"] as const,
  bundles: ["master-data", "bundles"] as const,
  warehouses: ["master-data", "warehouses"] as const,
  trucks: ["master-data", "trucks"] as const,
};

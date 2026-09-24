import { apiFetch } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";
import {
  mockAddProductToWarehouse,
  mockCreateBundle,
  mockCreateCategory,
  mockCreateCustomer,
  mockCreateFeaturedCollection,
  mockCreateProduct,
  mockCreateProductVariant,
  mockCreateTruck,
  mockCreateWarehouse,
  mockDeactivateCategory,
  mockDeleteBundle,
  mockDeleteProductVariant,
  mockDeleteTruck,
  mockDeleteWarehouse,
  mockGetCustomer,
  mockListBundles,
  mockListCategories,
  mockListCustomers,
  mockListFeaturedCollections,
  mockListProducts,
  mockListTrucks,
  mockListWarehouseProducts,
  mockListWarehouses,
  mockUpdateBundle,
  mockUpdateCategory,
  mockSetFeaturedCollectionActive,
  mockUpdateCustomer,
  mockUpdateFeaturedCollection,
  mockUpdateProduct,
  mockUpdateProductVariant,
  mockUpdateTruck,
  mockUpdateWarehouse,
} from "@/mock-data/store";
import type {
  AddWarehouseProductRequest,
  BundleView,
  CategoryView,
  CreateBundleRequest,
  CreateCategoryRequest,
  CreateCustomerRequest,
  CreateFeaturedCollectionRequest,
  CreateProductRequest,
  CreateProductVariantRequest,
  CreateTruckRequest,
  CreateWarehouseRequest,
  CustomerView,
  FeaturedCollectionView,
  ProductVariantView,
  ProductView,
  TruckView,
  UpdateBundleRequest,
  UpdateCategoryRequest,
  UpdateCustomerRequest,
  UpdateFeaturedCollectionRequest,
  UpdateProductRequest,
  UpdateProductVariantRequest,
  UpdateTruckRequest,
  UpdateWarehouseRequest,
  WarehouseProductView,
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
 * MasterDataApi has no product update endpoint yet, so this path is a guess
 * following the same PUT /{resource}/{id} shape as the other master-data
 * writes; it will 404 in api mode until the backend adds it. 422 if the new SKU
 * belongs to another product, or for a sub-category outside the chosen category.
 */
export function updateProduct(
  productId: string,
  request: UpdateProductRequest,
): Promise<ProductView> {
  if (IS_MOCK) return mockUpdateProduct(productId, request);
  return apiFetch<ProductView>(`/admin/master-data/products/${productId}`, {
    method: "PUT",
    body: request,
  });
}

/**
 * Variants have no backend either. They sit under their product, as
 * /products/{id}/variants, and 404 in api mode. Every write is refused with a
 * 422 unless the product has hasVariants set, and the name must be unique
 * within the product. A variant's stock is not written here: it is added per
 * warehouse, through addProductToWarehouse.
 */
export function createProductVariant(
  productId: string,
  request: CreateProductVariantRequest,
): Promise<ProductVariantView> {
  if (IS_MOCK) return mockCreateProductVariant(productId, request);
  return apiFetch<ProductVariantView>(`/admin/master-data/products/${productId}/variants`, {
    method: "POST",
    body: request,
  });
}

export function updateProductVariant(
  productId: string,
  variantId: string,
  request: UpdateProductVariantRequest,
): Promise<ProductVariantView> {
  if (IS_MOCK) return mockUpdateProductVariant(productId, variantId, request);
  return apiFetch<ProductVariantView>(
    `/admin/master-data/products/${productId}/variants/${variantId}`,
    { method: "PUT", body: request },
  );
}

/** Leaves the product alone. 422 while a warehouse still holds stock of the variant. */
export function deleteProductVariant(productId: string, variantId: string): Promise<void> {
  if (IS_MOCK) return mockDeleteProductVariant(productId, variantId);
  return apiFetch<void>(`/admin/master-data/products/${productId}/variants/${variantId}`, {
    method: "DELETE",
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

/**
 * One customer by its id — the stable reference quotations, orders, deposits
 * and credit notes store. Customers are never deleted, so an id issued once
 * resolves for good; 404 means it was never issued.
 */
export function getCustomer(customerId: string, signal?: AbortSignal): Promise<CustomerView> {
  if (IS_MOCK) return mockGetCustomer(customerId);
  return apiFetch<CustomerView>(`/admin/customers/${encodeURIComponent(customerId)}`, { signal });
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

/** Sorted by product name. 404 if the warehouse does not exist. */
export function listWarehouseProducts(
  warehouseId: string,
  signal?: AbortSignal,
): Promise<WarehouseProductView[]> {
  if (IS_MOCK) return mockListWarehouseProducts(warehouseId);
  return apiFetch<WarehouseProductView[]>(
    `/admin/master-data/warehouses/${warehouseId}/products`,
    { signal },
  );
}

/**
 * Adds stock of a product to a warehouse, creating the warehouse–product
 * relationship or raising its quantity if the warehouse already holds that
 * product. 422 for a quantity below 1 or an inactive product.
 */
export function addProductToWarehouse(
  warehouseId: string,
  request: AddWarehouseProductRequest,
): Promise<WarehouseProductView> {
  if (IS_MOCK) return mockAddProductToWarehouse(warehouseId, request);
  return apiFetch<WarehouseProductView>(`/admin/master-data/warehouses/${warehouseId}/products`, {
    method: "POST",
    body: request,
  });
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
 * Featured collections have no backend either; these paths follow the same
 * /admin/master-data/{resource} shape and 404 in api mode. Every collection is
 * returned, active or not, sorted by name.
 */
export function listFeaturedCollections(signal?: AbortSignal): Promise<FeaturedCollectionView[]> {
  if (IS_MOCK) return mockListFeaturedCollections();
  return apiFetch<FeaturedCollectionView[]>("/admin/master-data/featured-collections", { signal });
}

/** 422 for a taken name, no products, a repeated product or an inactive one. */
export function createFeaturedCollection(
  request: CreateFeaturedCollectionRequest,
): Promise<FeaturedCollectionView> {
  if (IS_MOCK) return mockCreateFeaturedCollection(request);
  return apiFetch<FeaturedCollectionView>("/admin/master-data/featured-collections", {
    method: "POST",
    body: request,
  });
}

/** Replaces the product list; a product left out leaves the collection, nothing more. */
export function updateFeaturedCollection(
  collectionId: string,
  request: UpdateFeaturedCollectionRequest,
): Promise<FeaturedCollectionView> {
  if (IS_MOCK) return mockUpdateFeaturedCollection(collectionId, request);
  return apiFetch<FeaturedCollectionView>(
    `/admin/master-data/featured-collections/${collectionId}`,
    { method: "PUT", body: request },
  );
}

/** Same activate/deactivate shape as categories, which also switch off rather than delete. */
export function setFeaturedCollectionActive(
  collectionId: string,
  active: boolean,
): Promise<FeaturedCollectionView> {
  if (IS_MOCK) return mockSetFeaturedCollectionActive(collectionId, active);
  return apiFetch<FeaturedCollectionView>(
    `/admin/master-data/featured-collections/${collectionId}/${active ? "activate" : "deactivate"}`,
    { method: "POST" },
  );
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
  // Nested under `customers`, so refreshing the list refreshes every lookup too.
  customer: (customerId: string) => ["master-data", "customers", customerId] as const,
  bundles: ["master-data", "bundles"] as const,
  featuredCollections: ["master-data", "featured-collections"] as const,
  warehouses: ["master-data", "warehouses"] as const,
  // Nested under `warehouses`, so invalidating the warehouse list refreshes
  // every warehouse's products too.
  warehouseProducts: (warehouseId: string) =>
    ["master-data", "warehouses", warehouseId, "products"] as const,
  trucks: ["master-data", "trucks"] as const,
};

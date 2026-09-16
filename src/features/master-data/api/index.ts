import { apiFetch } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";
import {
  mockCreateCategory,
  mockCreateProduct,
  mockListBundles,
  mockListCategories,
  mockListCustomers,
  mockListProducts,
  mockListTrucks,
  mockListWarehouses,
} from "@/mock-data/store";
import type {
  BundleView,
  CategoryView,
  CreateCategoryRequest,
  CreateProductRequest,
  CustomerView,
  ProductView,
  TruckView,
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

/** Query keys kept beside the calls they invalidate, so the two cannot drift. */
export const masterDataKeys = {
  products: ["master-data", "products"] as const,
  categories: ["master-data", "categories"] as const,
  customers: ["master-data", "customers"] as const,
  bundles: ["master-data", "bundles"] as const,
  warehouses: ["master-data", "warehouses"] as const,
  trucks: ["master-data", "trucks"] as const,
};

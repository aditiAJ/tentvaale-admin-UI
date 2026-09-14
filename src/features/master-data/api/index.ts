import { apiFetch } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";
import { mockCreateProduct, mockListProducts } from "@/mock-data/store";
import type { CreateProductRequest, ProductView } from "@/features/master-data/types";

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

/** Query keys kept beside the calls they invalidate, so the two cannot drift. */
export const masterDataKeys = {
  products: ["master-data", "products"] as const,
};

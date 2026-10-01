import { ApiError } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";
import * as backend from "@/features/master-data/api/backend";
import {
  mockAddProductToWarehouse,
  mockCreateBundle,
  mockCreateBundleOccasion,
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
  mockListBundleOccasions,
  mockListBundles,
  mockListCategories,
  mockListCustomers,
  mockListFeaturedCollections,
  mockListProducts,
  mockListTrucks,
  mockListWarehouseProducts,
  mockListWarehouses,
  mockReorderBundleOccasions,
  mockSetBundleOccasionActive,
  mockUpdateBundle,
  mockUpdateBundleOccasion,
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
  BundleOccasionView,
  BundleView,
  CategoryView,
  CreateBundleOccasionRequest,
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
  PaymentModeRequest,
  PaymentModeView,
  PaymentTermsRequest,
  PaymentTermsView,
  PlannerApplicationRequest,
  PlannerProfileView,
  PriceListRequest,
  PriceListView,
  SetSupplierStockRequest,
  SupplierRequest,
  SupplierStockView,
  SupplierView,
  ProductVariantView,
  ProductView,
  TruckView,
  UpdateBundleOccasionRequest,
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
export function listProducts(
  signal?: AbortSignal,
  options?: { includeInactive?: boolean },
): Promise<ProductView[]> {
  if (IS_MOCK) return mockListProducts();
  return backend.listProducts(signal, options?.includeInactive);
}

/** Inactive products stay on record but leave pickers and the storefront. Real backend only. */
export function setProductActive(productId: string, active: boolean): Promise<void> {
  if (IS_MOCK) return Promise.reject(new ApiError("This needs the real backend. Set NEXT_PUBLIC_DATA_SOURCE=api.", 422));
  return backend.setProductActive(productId, active);
}

/** 422 if the SKU already exists for this company (case-insensitive). */
export function createProduct(request: CreateProductRequest): Promise<ProductView> {
  if (IS_MOCK) return mockCreateProduct(request);
  return backend.createProduct(request);
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
  return backend.updateProduct(productId, request);
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
  return backend.createProductVariant(productId, request);
}

export function updateProductVariant(
  productId: string,
  variantId: string,
  request: UpdateProductVariantRequest,
): Promise<ProductVariantView> {
  if (IS_MOCK) return mockUpdateProductVariant(productId, variantId, request);
  return backend.updateProductVariant(productId, variantId, request);
}

/** Leaves the product alone. 422 while a warehouse still holds stock of the variant. */
export function deleteProductVariant(productId: string, variantId: string): Promise<void> {
  if (IS_MOCK) return mockDeleteProductVariant(productId, variantId);
  return backend.deleteProductVariant(productId, variantId);
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
  return backend.listCategories(signal);
}

export function createCategory(request: CreateCategoryRequest): Promise<CategoryView> {
  if (IS_MOCK) return mockCreateCategory(request);
  return backend.createCategory(request);
}

/**
 * Customers are master-data records (md_customer), served by CustomerAdminController. The list
 * is every customer of the company, ordered by name, and is searched in the browser.
 */
export function listCustomers(signal?: AbortSignal): Promise<CustomerView[]> {
  if (IS_MOCK) return mockListCustomers();
  return backend.listCustomers(signal);
}

/**
 * One customer by its id — the stable reference quotations, orders, deposits
 * and credit notes store. Customers are never deleted, so an id issued once
 * resolves for good; 404 means it was never issued.
 */
export function getCustomer(customerId: string, signal?: AbortSignal): Promise<CustomerView> {
  if (IS_MOCK) return mockGetCustomer(customerId);
  return backend.getCustomer(customerId, signal);
}

export function listBundles(signal?: AbortSignal): Promise<BundleView[]> {
  if (IS_MOCK) return mockListBundles();
  return backend.listBundles(signal);
}

export function listWarehouses(signal?: AbortSignal): Promise<WarehouseView[]> {
  if (IS_MOCK) return mockListWarehouses();
  return backend.listWarehouses(signal);
}

export function listTrucks(signal?: AbortSignal): Promise<TruckView[]> {
  if (IS_MOCK) return mockListTrucks();
  return backend.listTrucks(signal);
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
  return backend.updateCategory(categoryId, request);
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
  return backend.deactivateCategory(categoryId);
}

/** The reverse of deactivateCategory; its sub-categories come back with it. Real backend only. */
export function activateCategory(categoryId: string): Promise<CategoryView> {
  if (IS_MOCK) return Promise.reject(new ApiError("This needs the real backend. Set NEXT_PUBLIC_DATA_SOURCE=api.", 422));
  return backend.activateCategory(categoryId);
}

export function createWarehouse(request: CreateWarehouseRequest): Promise<WarehouseView> {
  if (IS_MOCK) return mockCreateWarehouse(request);
  return backend.createWarehouse(request);
}

export function updateWarehouse(
  warehouseId: string,
  request: UpdateWarehouseRequest,
): Promise<WarehouseView> {
  if (IS_MOCK) return mockUpdateWarehouse(warehouseId, request);
  return backend.updateWarehouse(warehouseId, request);
}

/** 422 when a dispatch or return still points at it. Deleting also removes the stock it held. */
export function deleteWarehouse(warehouseId: string): Promise<void> {
  if (IS_MOCK) return mockDeleteWarehouse(warehouseId);
  return backend.deleteWarehouse(warehouseId);
}

/** Sorted by product name. 404 if the warehouse does not exist. Backend path: /warehouses/{id}/stock. */
export function listWarehouseProducts(
  warehouseId: string,
  signal?: AbortSignal,
): Promise<WarehouseProductView[]> {
  if (IS_MOCK) return mockListWarehouseProducts(warehouseId);
  return backend.listWarehouseProducts(warehouseId, signal);
}

/**
 * Adds stock of a product to a warehouse, creating the warehouse–product
 * relationship or raising its quantity if the warehouse already holds that
 * product. 422 for an inactive warehouse or a product that needs a variant; 400 for a
 * quantity below 1.
 */
export function addProductToWarehouse(
  warehouseId: string,
  request: AddWarehouseProductRequest,
): Promise<WarehouseProductView> {
  if (IS_MOCK) return mockAddProductToWarehouse(warehouseId, request);
  return backend.addProductToWarehouse(warehouseId, request);
}

export function createTruck(request: CreateTruckRequest): Promise<TruckView> {
  if (IS_MOCK) return mockCreateTruck(request);
  return backend.createTruck(request);
}

export function updateTruck(truckId: string, request: UpdateTruckRequest): Promise<TruckView> {
  if (IS_MOCK) return mockUpdateTruck(truckId, request);
  return backend.updateTruck(truckId, request);
}

export function deleteTruck(truckId: string): Promise<void> {
  if (IS_MOCK) return mockDeleteTruck(truckId);
  return backend.deleteTruck(truckId);
}

export function createBundle(request: CreateBundleRequest): Promise<BundleView> {
  if (IS_MOCK) return mockCreateBundle(request);
  return backend.createBundle(request);
}

export function updateBundle(bundleId: string, request: UpdateBundleRequest): Promise<BundleView> {
  if (IS_MOCK) return mockUpdateBundle(bundleId, request);
  return backend.updateBundle(bundleId, request);
}

/** Inactive bundles stay on record but leave the storefront. Real backend only. */
export function setBundleActive(bundleId: string, active: boolean): Promise<BundleView> {
  if (IS_MOCK) return Promise.reject(new ApiError("This needs the real backend. Set NEXT_PUBLIC_DATA_SOURCE=api.", 422));
  return backend.setBundleActive(bundleId, active);
}

export function deleteBundle(bundleId: string): Promise<void> {
  if (IS_MOCK) return mockDeleteBundle(bundleId);
  return backend.deleteBundle(bundleId);
}

/**
 * The storefront's occasion filter row (backend: /occasions, shared with products and
 * collections). Every occasion is returned, shown or hidden, in display order.
 */
export function listBundleOccasions(signal?: AbortSignal): Promise<BundleOccasionView[]> {
  if (IS_MOCK) return mockListBundleOccasions();
  return backend.listBundleOccasions(signal);
}

/** 422 for a blank or taken name. A new occasion is shown, at the end of the row. */
export function createBundleOccasion(
  request: CreateBundleOccasionRequest,
): Promise<BundleOccasionView> {
  if (IS_MOCK) return mockCreateBundleOccasion(request);
  return backend.createBundleOccasion(request);
}

export function updateBundleOccasion(
  occasionId: string,
  request: UpdateBundleOccasionRequest,
): Promise<BundleOccasionView> {
  if (IS_MOCK) return mockUpdateBundleOccasion(occasionId, request);
  return backend.updateBundleOccasion(occasionId, request);
}

/** Same activate/deactivate shape as featured collections. */
export function setBundleOccasionActive(
  occasionId: string,
  active: boolean,
): Promise<BundleOccasionView> {
  if (IS_MOCK) return mockSetBundleOccasionActive(occasionId, active);
  return backend.setBundleOccasionActive(occasionId, active);
}

/** Every occasion id, in the new display order. */
export function reorderBundleOccasions(occasionIds: string[]): Promise<BundleOccasionView[]> {
  if (IS_MOCK) return mockReorderBundleOccasions(occasionIds);
  return backend.reorderBundleOccasions(occasionIds);
}

/**
 * Featured collections: curated product selections for the storefront (backend:
 * /featured-collections, ADR-008). Every collection is returned, active or not, sorted by name.
 */
export function listFeaturedCollections(signal?: AbortSignal): Promise<FeaturedCollectionView[]> {
  if (IS_MOCK) return mockListFeaturedCollections();
  return backend.listFeaturedCollections(signal);
}

/** 422 for a taken name, no products, a repeated product or an inactive one. */
export function createFeaturedCollection(
  request: CreateFeaturedCollectionRequest,
): Promise<FeaturedCollectionView> {
  if (IS_MOCK) return mockCreateFeaturedCollection(request);
  return backend.createFeaturedCollection(request);
}

/** Replaces the product list; a product left out leaves the collection, nothing more. */
export function updateFeaturedCollection(
  collectionId: string,
  request: UpdateFeaturedCollectionRequest,
): Promise<FeaturedCollectionView> {
  if (IS_MOCK) return mockUpdateFeaturedCollection(collectionId, request);
  return backend.updateFeaturedCollection(collectionId, request);
}

/** Same activate/deactivate shape as categories, which also switch off rather than delete. */
export function setFeaturedCollectionActive(
  collectionId: string,
  active: boolean,
): Promise<FeaturedCollectionView> {
  if (IS_MOCK) return mockSetFeaturedCollectionActive(collectionId, active);
  return backend.setFeaturedCollectionActive(collectionId, active);
}

/** 422 if the email already belongs to another customer of this company (case-insensitive). */
export function createCustomer(request: CreateCustomerRequest): Promise<CustomerView> {
  if (IS_MOCK) return mockCreateCustomer(request);
  return backend.createCustomer(request);
}

/**
 * 422 for another customer's email, or for turning an event planner who has applied back into a
 * plain customer.
 */
export function updateCustomer(
  customerId: string,
  request: UpdateCustomerRequest,
): Promise<CustomerView> {
  if (IS_MOCK) return mockUpdateCustomer(customerId, request);
  return backend.updateCustomer(customerId, request);
}

// Rental suppliers exist only on the real backend; the demo data has no such concept.
const SUPPLIERS_NEED_BACKEND = "Suppliers need the real backend. Set NEXT_PUBLIC_DATA_SOURCE=api.";

/** Every supplier, active or not, ordered by name. */
export function listSuppliers(signal?: AbortSignal): Promise<SupplierView[]> {
  if (IS_MOCK) return Promise.resolve([]);
  return backend.listSuppliers(signal);
}

/** 422 if the name is taken by another supplier of this company (case-insensitive). */
export function createSupplier(request: SupplierRequest): Promise<SupplierView> {
  if (IS_MOCK) return Promise.reject(new ApiError(SUPPLIERS_NEED_BACKEND, 422));
  return backend.createSupplier(request);
}

export function updateSupplier(supplierId: string, request: SupplierRequest): Promise<SupplierView> {
  if (IS_MOCK) return Promise.reject(new ApiError(SUPPLIERS_NEED_BACKEND, 422));
  return backend.updateSupplier(supplierId, request);
}

/** What this supplier can provide. Kept apart from owned stock, and never shown on the storefront. */
export function listSupplierStock(
  supplierId: string,
  signal?: AbortSignal,
): Promise<SupplierStockView[]> {
  if (IS_MOCK) return Promise.resolve([]);
  return backend.listSupplierStock(supplierId, signal);
}

/** Sets (replaces) the supplier's count. Zero is allowed. */
export function setSupplierStock(
  supplierId: string,
  request: SetSupplierStockRequest,
): Promise<SupplierStockView> {
  if (IS_MOCK) return Promise.reject(new ApiError(SUPPLIERS_NEED_BACKEND, 422));
  return backend.setSupplierStock(supplierId, request);
}

// Planner applications exist only on the real backend; the demo data has no such concept.
const NEEDS_BACKEND = "Planner applications need the real backend. Set NEXT_PUBLIC_DATA_SOURCE=api.";

/** Pending applications, oldest first. */
export function listPlannerApplications(signal?: AbortSignal): Promise<PlannerProfileView[]> {
  if (IS_MOCK) return Promise.resolve([]);
  return backend.listPlannerApplications(signal);
}

/** 422 unless the customer is an event planner. Resubmitting after a rejection re-queues it. */
export function applyAsPlanner(
  customerId: string,
  request: PlannerApplicationRequest,
): Promise<PlannerProfileView> {
  if (IS_MOCK) return Promise.reject(new ApiError(NEEDS_BACKEND, 422));
  return backend.applyAsPlanner(customerId, request);
}

export function approvePlannerApplication(customerId: string): Promise<PlannerProfileView> {
  if (IS_MOCK) return Promise.reject(new ApiError(NEEDS_BACKEND, 422));
  return backend.approvePlannerApplication(customerId);
}

/** The reason is required (400 if blank) and is kept on the application. */
export function rejectPlannerApplication(
  customerId: string,
  reason: string,
): Promise<PlannerProfileView> {
  if (IS_MOCK) return Promise.reject(new ApiError(NEEDS_BACKEND, 422));
  return backend.rejectPlannerApplication(customerId, reason);
}

// Price lists and payment setup exist only on the real backend; the demo data has none.
const SETUP_NEEDS_BACKEND = "This needs the real backend. Set NEXT_PUBLIC_DATA_SOURCE=api.";
const needsBackend = <T>() => Promise.reject<T>(new ApiError(SETUP_NEEDS_BACKEND, 422));

/** Trade pricing for verified event planners. Every list, active or not, by name. */
export function listPriceLists(signal?: AbortSignal): Promise<PriceListView[]> {
  if (IS_MOCK) return Promise.resolve([]);
  return backend.listPriceLists(signal);
}

/** 422 for a name already used, a rate repeated for one product, or a variant of another product. */
export function createPriceList(request: PriceListRequest): Promise<PriceListView> {
  if (IS_MOCK) return needsBackend();
  return backend.createPriceList(request);
}

export function updatePriceList(priceListId: string, request: PriceListRequest): Promise<PriceListView> {
  if (IS_MOCK) return needsBackend();
  return backend.updatePriceList(priceListId, request);
}

/** Takes effect once the planner's application is approved. null takes them off every list. */
export function assignPriceList(customerId: string, priceListId: string | null): Promise<void> {
  if (IS_MOCK) return needsBackend();
  return backend.assignPriceList(customerId, priceListId);
}

export function listPaymentModes(signal?: AbortSignal): Promise<PaymentModeView[]> {
  if (IS_MOCK) return Promise.resolve([]);
  return backend.listPaymentModes(signal);
}

export function createPaymentMode(request: PaymentModeRequest): Promise<PaymentModeView> {
  if (IS_MOCK) return needsBackend();
  return backend.createPaymentMode(request);
}

export function updatePaymentMode(modeId: string, request: PaymentModeRequest): Promise<PaymentModeView> {
  if (IS_MOCK) return needsBackend();
  return backend.updatePaymentMode(modeId, request);
}

export function listPaymentTerms(signal?: AbortSignal): Promise<PaymentTermsView[]> {
  if (IS_MOCK) return Promise.resolve([]);
  return backend.listPaymentTerms(signal);
}

/** 422 unless the lines add up to exactly 100%. */
export function createPaymentTerms(request: PaymentTermsRequest): Promise<PaymentTermsView> {
  if (IS_MOCK) return needsBackend();
  return backend.createPaymentTerms(request);
}

export function updatePaymentTerms(termsId: string, request: PaymentTermsRequest): Promise<PaymentTermsView> {
  if (IS_MOCK) return needsBackend();
  return backend.updatePaymentTerms(termsId, request);
}

/** Query keys kept beside the calls they invalidate, so the two cannot drift. */
export const masterDataKeys = {
  products: ["master-data", "products"] as const,
  categories: ["master-data", "categories"] as const,
  customers: ["master-data", "customers"] as const,
  plannerApplications: ["master-data", "planner-applications"] as const,
  // Nested under `customers`, so refreshing the list refreshes every lookup too.
  customer: (customerId: string) => ["master-data", "customers", customerId] as const,
  bundles: ["master-data", "bundles"] as const,
  // Nested under `bundles`, so a bundle save refreshes the occasions' counts.
  bundleOccasions: ["master-data", "bundles", "occasions"] as const,
  featuredCollections: ["master-data", "featured-collections"] as const,
  warehouses: ["master-data", "warehouses"] as const,
  // Nested under `warehouses`, so invalidating the warehouse list refreshes
  // every warehouse's products too.
  warehouseProducts: (warehouseId: string) =>
    ["master-data", "warehouses", warehouseId, "products"] as const,
  trucks: ["master-data", "trucks"] as const,
  suppliers: ["master-data", "suppliers"] as const,
  priceLists: ["master-data", "price-lists"] as const,
  paymentModes: ["master-data", "payment-modes"] as const,
  paymentTerms: ["master-data", "payment-terms"] as const,
  // Nested under `suppliers`, so refreshing the list refreshes every supplier's stock too.
  supplierStock: (supplierId: string) => ["master-data", "suppliers", supplierId, "stock"] as const,
};

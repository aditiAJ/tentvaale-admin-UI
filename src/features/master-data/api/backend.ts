import { apiFetch } from "@/services/api-client";
import { getAuthToken } from "@/services/auth-token";
import { readSession } from "@/services/jwt";
import type { ProductSetting, RateType } from "@/features/master-data/storefront";
import type {
  AddWarehouseProductRequest,
  CategoryView,
  CreateCategoryRequest,
  CreateCustomerRequest,
  CreateProductRequest,
  CreateProductVariantRequest,
  CreateTruckRequest,
  CreateWarehouseRequest,
  CustomerView,
  DimensionUnit,
  MediaAsset,
  PlannerApplicationRequest,
  PlannerProfileView,
  ProductDimensions,
  ProductVariantView,
  FacetOption,
  StockGrid,
  VariantCombination,
  ProductView,
  SetSupplierStockRequest,
  SubCategoryView,
  SupplierRequest,
  SupplierStockView,
  SupplierView,
  TruckView,
  UpdateCategoryRequest,
  UpdateCustomerRequest,
  UpdateTruckRequest,
  UpdateWarehouseRequest,
  WarehouseProductView,
  WarehouseView,
} from "@/features/master-data/types";
import type {
  PaymentModeRequest,
  PaymentModeView,
  PaymentTermsRequest,
  PaymentTermsView,
  PriceListRequest,
  PriceListView,
} from "@/features/master-data/types";
import type {
  BundleOccasionView,
  BundleView,
  CreateBundleOccasionRequest,
  CreateBundleRequest,
  CreateFeaturedCollectionRequest,
  FeaturedCollectionView,
  UpdateBundleOccasionRequest,
  UpdateBundleRequest,
  UpdateFeaturedCollectionRequest,
} from "@/features/master-data/types";

/**
 * Real-backend side of master data: the wire shapes of MasterDataApi's admin
 * controllers, and the mapping to the shapes the screens were built on.
 *
 * The backend speaks numeric ids and a single URL per image; the screens speak
 * string ids and MediaAsset. Mapping happens here so no component changes when
 * the data source flips from mock to api.
 *
 * Notes on fields the backend models differently:
 * - `retailRate` is the backend's `dailyRate` (the standard rate); `wholesaleRate` is its own field.
 * - Storefront details (colours, materials, moods, setting, size, attributes) are facets on the
 *   backend. They are written through one call, PUT /products/{id}/storefront-details, which
 *   creates any facet or value that does not exist yet, and read back from the product's facets.
 * - Media is stored as URLs only; there is no upload endpoint.
 */

const CURRENCY = "INR";
const BASE = "/admin/master-data";

interface WireSubCategory {
  id: number;
  categoryId: number;
  name: string;
}

interface WireCategory {
  id: number;
  name: string;
  imageUrl: string | null;
  displayOrder?: number;
  active: boolean;
  subCategories: WireSubCategory[];
  skuPrefix?: string | null;
}

interface WireVariant {
  id: number;
  productId: number;
  name: string;
  dailyRate: number | null;
  wholesaleRate: number | null;
  effectiveRate: number;
  ownedStock: number;
  supplierStock: number;
  sku: string;
  isDefault: boolean;
  active: boolean;
  attributes?: Record<string, number>;
}

interface WireProduct {
  id: number;
  sku: string;
  name: string;
  description?: string | null;
  categoryId: number;
  categoryName: string;
  subCategoryId: number;
  subCategoryName: string;
  rateType: "QTY" | "SQFT" | "RFT";
  dailyRate: number;
  wholesaleRate: number | null;
  skuOwner: string | null;
  genericName: string | null;
  tag: string | null;
  hasVariants: boolean;
  active: boolean;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  dimensionUnit?: string | null;
  maxCoverageSqft?: number | null;
  media?: {
    id: number;
    type: "IMAGE" | "VIDEO";
    url: string;
    altText: string | null;
    thumbnailUrl?: string | null;
    sizeBytes?: number | null;
    contentType?: string | null;
    width?: number | null;
    height?: number | null;
  }[];
  facets?: { facetCode: string; facetLabel: string; value: string }[];
  variants?: WireVariant[];
  axes?: { facetId: number; code: string; label: string }[];
}

const RATE_TO_WIRE: Record<RateType, WireProduct["rateType"]> = {
  Qty: "QTY",
  RFt: "RFT",
  SqFt: "SQFT",
};

const RATE_FROM_WIRE: Record<WireProduct["rateType"], RateType> = {
  QTY: "Qty",
  RFT: "RFt",
  SQFT: "SqFt",
};

function companyId(): string {
  const token = getAuthToken();
  return readSession(token)?.companyId ?? "";
}

const money = (amount: number | null | undefined) => ({
  amount: amount ?? 0,
  currency: CURRENCY,
});

/** A pasted URL becomes a MediaAsset the screens can carry; only the URL is stored. */
export function mediaFromUrl(url: string): MediaAsset {
  const clean = url.trim();
  const last = clean.split("?")[0].split("/").filter(Boolean).pop() ?? "media";
  return {
    id: crypto.randomUUID(),
    kind: /\.(mp4|webm)$/i.test(clean.split("?")[0]) ? "VIDEO" : "IMAGE",
    fileName: last,
    contentType: "",
    sizeBytes: 0,
    url: clean,
  };
}

// ---------------------------------------------------------------- categories

function subCategoryFromWire(sub: WireSubCategory): SubCategoryView {
  return {
    id: String(sub.id),
    companyId: companyId(),
    categoryId: String(sub.categoryId),
    name: sub.name,
  };
}

function categoryFromWire(category: WireCategory): CategoryView {
  return {
    id: String(category.id),
    companyId: companyId(),
    name: category.name,
    active: category.active,
    media: category.imageUrl ? [mediaFromUrl(category.imageUrl)] : [],
    subCategories: [...category.subCategories]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(subCategoryFromWire),
    skuPrefix: category.skuPrefix ?? null,
  };
}

export async function listCategories(signal?: AbortSignal): Promise<CategoryView[]> {
  const rows = await apiFetch<WireCategory[]>(`${BASE}/categories`, { signal });
  return rows.map(categoryFromWire);
}

export async function createCategory(request: CreateCategoryRequest): Promise<CategoryView> {
  const created = await apiFetch<WireCategory>(`${BASE}/categories`, {
    method: "POST",
    body: {
      name: request.name,
      imageUrl: request.media[0]?.url ?? null,
      subCategories: request.subCategories ?? [],
      skuPrefix: request.skuPrefix?.trim() || null,
    },
  });
  return categoryFromWire(created);
}

/**
 * The screen edits a category and its sub-categories in one form; the backend
 * has a call per sub-category, so the sub-category list is diffed against what
 * is stored: kept ones are renamed if needed, new ones added, dropped ones deleted.
 */
export async function updateCategory(
  categoryId: string,
  request: UpdateCategoryRequest,
): Promise<CategoryView> {
  const current = await apiFetch<WireCategory>(`${BASE}/categories/${categoryId}`);
  await apiFetch<WireCategory>(`${BASE}/categories/${categoryId}`, {
    method: "PUT",
    // displayOrder goes back as stored: the backend sets it from the request, so leaving it out reset it to 0.
    body: {
      name: request.name,
      imageUrl: request.media[0]?.url ?? null,
      displayOrder: current.displayOrder,
      skuPrefix: request.skuPrefix?.trim() || null,
    },
  });

  const keptIds = new Set(request.subCategories.filter((s) => s.id).map((s) => s.id));
  for (const existing of current.subCategories) {
    if (!keptIds.has(String(existing.id))) {
      await apiFetch<void>(`${BASE}/sub-categories/${existing.id}`, { method: "DELETE" });
    }
  }
  for (const sub of request.subCategories) {
    if (sub.id) {
      const before = current.subCategories.find((s) => String(s.id) === sub.id);
      if (before && before.name !== sub.name) {
        await apiFetch(`${BASE}/sub-categories/${sub.id}`, { method: "PUT", body: { name: sub.name } });
      }
    } else {
      await apiFetch(`${BASE}/categories/${categoryId}/sub-categories`, {
        method: "POST",
        body: { name: sub.name },
      });
    }
  }

  return categoryFromWire(await apiFetch<WireCategory>(`${BASE}/categories/${categoryId}`));
}

export async function deactivateCategory(categoryId: string): Promise<CategoryView> {
  return categoryFromWire(
    await apiFetch<WireCategory>(`${BASE}/categories/${categoryId}/deactivate`, { method: "POST" }),
  );
}

export async function activateCategory(categoryId: string): Promise<CategoryView> {
  return categoryFromWire(
    await apiFetch<WireCategory>(`${BASE}/categories/${categoryId}/activate`, { method: "POST" }),
  );
}

// ------------------------------------------------------------------ products

/** Switches a product off (kept on record, hidden from pickers and the storefront) or back on. */
export async function setProductActive(productId: string, active: boolean): Promise<void> {
  await apiFetch<unknown>(`${BASE}/products/${productId}/${active ? "activate" : "deactivate"}`, {
    method: "POST",
  });
}

function variantFromWire(variant: WireVariant): ProductVariantView {
  return {
    id: String(variant.id),
    companyId: companyId(),
    productId: String(variant.productId),
    name: variant.name,
    wholesaleRate: money(variant.wholesaleRate),
    retailRate: money(variant.effectiveRate),
    sku: variant.sku,
    isDefault: variant.isDefault,
    active: variant.active,
    hasAttributes: Object.keys(variant.attributes ?? {}).length > 0,
    attributeFacetIds: Object.keys(variant.attributes ?? {}),
    stock: variant.ownedStock + variant.supplierStock,
  };
}

const ATTRIBUTE_PREFIX = "attr-";

/** Collects one facet's values, in a stable order. */
function facetValues(product: WireProduct, code: string): string[] {
  return (product.facets ?? [])
    .filter((facet) => facet.facetCode === code)
    .map((facet) => facet.value)
    .sort((a, b) => a.localeCompare(b));
}

function attributesFromWire(product: WireProduct): Record<string, string> {
  return Object.fromEntries(
    (product.facets ?? [])
      .filter((facet) => facet.facetCode.startsWith(ATTRIBUTE_PREFIX))
      .map((facet) => [facet.facetLabel, facet.value]),
  );
}

/** Rounds to two places, which is plenty for a tent pole or a rug. */
const round2 = (value: number) => Math.round(value * 100) / 100;

function dimensionsFromWire(product: WireProduct): ProductDimensions | null {
  const { length, width, height } = product;
  if (length == null && width == null && height == null) return null;
  // The form offers feet and inches only: a size stored in cm or m is shown converted (and saved that way).
  const wire = (product.dimensionUnit ?? "").toUpperCase();
  const [factor, unit]: [number, DimensionUnit] =
    wire === "CM" ? [1 / 2.54, "in"] : wire === "M" ? [3.28084, "ft"] : [1, wire === "IN" ? "in" : "ft"];
  const convert = (side: number | null | undefined) => (side == null ? null : factor === 1 ? Number(side) : round2(Number(side) * factor));
  return { length: convert(length), width: convert(width), height: convert(height), unit };
}

function productFromWire(product: WireProduct, variants: WireVariant[] = []): ProductView {
  const list = product.variants ?? variants;
  return {
    id: String(product.id),
    companyId: companyId(),
    sku: product.sku,
    skuOwner: product.skuOwner ?? "",
    name: product.name,
    genericName: product.genericName ?? "",
    description: product.description ?? null,
    categoryId: String(product.categoryId),
    categoryName: product.categoryName,
    subCategoryId: String(product.subCategoryId),
    subCategoryName: product.subCategoryName,
    wholesaleRate: money(product.wholesaleRate),
    retailRate: money(product.dailyRate),
    hasVariants: product.hasVariants,
    variants: list.map(variantFromWire),
    axes: (product.axes ?? []).map((axis) => ({
      facetId: String(axis.facetId),
      code: axis.code,
      label: axis.label,
    })),
    media: product.media?.map((m) => ({
      id: String(m.id),
      kind: m.type,
      fileName: m.altText ?? m.url.split("/").pop() ?? "media",
      contentType: m.contentType ?? "",
      sizeBytes: m.sizeBytes ?? 0,
      url: m.url,
      thumbnailUrl: m.thumbnailUrl ?? null,
      width: m.width ?? null,
      height: m.height ?? null,
    })),
    rateType: RATE_FROM_WIRE[product.rateType],
    size: facetValues(product, "size")[0] ?? null,
    dimensions: dimensionsFromWire(product),
    maxCoverageSqft: product.maxCoverageSqft ?? null,
    setting: (facetValues(product, "setting")[0] as ProductSetting | undefined) ?? null,
    colours: facetValues(product, "colour"),
    materials: facetValues(product, "material"),
    fabrics: facetValues(product, "fabric"),
    moods: facetValues(product, "mood"),
    themes: facetValues(product, "theme"),
    attributes: attributesFromWire(product),
    active: product.active,
  };
}

export async function listProducts(
  signal?: AbortSignal,
  includeInactive = false,
): Promise<ProductView[]> {
  const rows = await apiFetch<WireProduct[]>(
    `${BASE}/products${includeInactive ? "?includeInactive=true" : ""}`,
    { signal },
  );
  // The list is a summary with no variants, media or facets; the screens read all three off the
  // product, so each row is completed from its detail.
  return Promise.all(
    rows.map(async (row) =>
      productFromWire(await apiFetch<WireProduct>(`${BASE}/products/${row.id}`, { signal })),
    ),
  );
}

function productBody(request: CreateProductRequest) {
  return {
    subCategoryId: Number(request.subCategoryId),
    // Left out, the backend numbers a new product (FUR-001); on an edit it is ignored, a SKU never changes.
    sku: request.sku?.trim() || null,
    name: request.name,
    description: request.description || null,
    rateType: RATE_TO_WIRE[request.rateType],
    dailyRate: request.retailRate,
    wholesaleRate: request.wholesaleRate,
    skuOwner: request.skuOwner,
    genericName: request.genericName,
    hasVariants: request.hasVariants,
    // Sent on every save: the backend replaces these, so leaving them out would erase them.
    length: request.dimensions?.length ?? null,
    width: request.dimensions?.width ?? null,
    height: request.dimensions?.height ?? null,
    dimensionUnit: request.dimensions ? request.dimensions.unit.toUpperCase() : null,
    maxCoverageSqft: request.maxCoverageSqft ?? null,
  };
}

/** The first image is the primary one; the backend keeps it first. */
function mediaBody(media: MediaAsset[]) {
  const firstImage = media.find((m) => m.kind === "IMAGE" && m.url);
  return media
    .filter((m) => m.url)
    .map((m) => ({
      type: m.kind,
      url: m.url as string,
      altText: m.fileName,
      thumbnailUrl: m.thumbnailUrl ?? undefined,
      sizeBytes: m.sizeBytes || undefined,
      contentType: m.contentType || undefined,
      width: m.width ?? undefined,
      height: m.height ?? undefined,
      primary: m === firstImage,
    }));
}

export interface UploadResult {
  fileName: string;
  ok: boolean;
  error: string | null;
  url: string | null;
  thumbnailUrl: string | null;
  contentType: string | null;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  /** Stored, but short of a guideline (for example not square). */
  warning: string | null;
}

/**
 * Sends images to the backend (stored in R2, with a thumbnail); every file has its own result. `product` applies
 * the product media rules (PNG or JPEG under 2 MB, 800 to 3000 pixels, or one MP4 under 10 MB, 30 s, 1080p).
 */
export function uploadMedia(files: File[], purpose: "general" | "product" = "general"): Promise<UploadResult[]> {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  form.append("purpose", purpose);
  return apiFetch<UploadResult[]>(`${BASE}/media/upload`, { method: "POST", body: form });
}

function storefrontDetailsBody(request: CreateProductRequest) {
  return {
    size: request.size,
    setting: request.setting,
    colours: request.colours,
    materials: request.materials,
    fabrics: request.fabrics,
    moods: request.moods,
    themes: request.themes,
    attributes: request.attributes,
  };
}

function setupBody(setup: NonNullable<CreateProductRequest["setup"]>) {
  const stock = (lines: { warehouseId: string; quantity: number }[]) =>
    lines.map((line) => ({ warehouseId: Number(line.warehouseId), quantity: line.quantity }));
  return {
    variants: setup.variants?.map((variant) => ({
      type: variant.type,
      id: variant.id === undefined ? undefined : Number(variant.id),
      active: variant.active,
      name: variant.name,
      wholesaleRate: variant.wholesaleRate,
      dailyRate: variant.retailRate,
      stock: stock(variant.stock),
    })),
    stock: stock(setup.stock ?? []),
  };
}

function completeBody(request: CreateProductRequest) {
  return {
    product: productBody(request),
    media: mediaBody(request.media),
    details: storefrontDetailsBody(request),
    setup: request.setup ? setupBody(request.setup) : undefined,
  };
}

/** One request, one transaction: a failure leaves nothing half-created. */
export async function createProduct(request: CreateProductRequest): Promise<ProductView> {
  return productFromWire(
    await apiFetch<WireProduct>(`${BASE}/products/complete`, { method: "POST", body: completeBody(request) }),
  );
}

export async function updateProduct(
  productId: string,
  request: CreateProductRequest,
): Promise<ProductView> {
  return productFromWire(
    await apiFetch<WireProduct>(`${BASE}/products/${productId}/complete`, {
      method: "PUT",
      body: completeBody(request),
    }),
  );
}

function variantBody(request: CreateProductVariantRequest) {
  return {
    name: request.name,
    wholesaleRate: request.wholesaleRate,
    dailyRate: request.retailRate,
  };
}

export async function createProductVariant(
  productId: string,
  request: CreateProductVariantRequest,
): Promise<ProductVariantView> {
  return variantFromWire(
    await apiFetch<WireVariant>(`${BASE}/products/${productId}/variants`, {
      method: "POST",
      body: variantBody(request),
    }),
  );
}

export async function updateProductVariant(
  _productId: string,
  variantId: string,
  request: CreateProductVariantRequest,
): Promise<ProductVariantView> {
  return variantFromWire(
    await apiFetch<WireVariant>(`${BASE}/variants/${variantId}`, {
      method: "PUT",
      body: variantBody(request),
    }),
  );
}

export function deleteProductVariant(_productId: string, variantId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/variants/${variantId}`, { method: "DELETE" });
}

export async function setVariantActive(variantId: string, active: boolean): Promise<ProductVariantView> {
  return variantFromWire(
    await apiFetch<WireVariant>(`${BASE}/variants/${variantId}/${active ? "activate" : "deactivate"}`, {
      method: "POST",
    }),
  );
}

interface WireFacet {
  id: number;
  code: string;
  label: string;
  active: boolean;
  values: { id: number; value: string; active: boolean }[];
}

/** Active facets with their values: the pool an axis is picked from. */
export async function listFacetOptions(signal?: AbortSignal): Promise<FacetOption[]> {
  const rows = await apiFetch<WireFacet[]>(`${BASE}/facets`, { signal });
  return rows
    .filter((facet) => facet.active)
    .map((facet) => ({
      id: String(facet.id),
      code: facet.code,
      label: facet.label,
      values: facet.values.map((v) => ({ id: String(v.id), value: v.value, active: v.active })),
    }));
}

export async function setProductAxes(productId: string, facetIds: string[]): Promise<ProductView> {
  return productFromWire(
    await apiFetch<WireProduct>(`${BASE}/products/${productId}/variant-axes`, {
      method: "PUT",
      body: facetIds.map(Number),
    }),
  );
}

export async function listVariantCombinations(
  productId: string,
  signal?: AbortSignal,
): Promise<VariantCombination[]> {
  const rows = await apiFetch<
    { valueIds: number[]; label: string; existingVariantId: number | null }[]
  >(`${BASE}/products/${productId}/variant-combinations`, { signal });
  return rows.map((row) => ({
    valueIds: row.valueIds.map(String),
    label: row.label,
    existingVariantId: row.existingVariantId == null ? null : String(row.existingVariantId),
  }));
}

/** Creates one variant per ticked combination (one value id per axis, in axis order). */
export async function generateVariants(
  productId: string,
  combinations: string[][],
): Promise<ProductVariantView[]> {
  const rows = await apiFetch<WireVariant[]>(`${BASE}/products/${productId}/variants/generate`, {
    method: "POST",
    body: combinations.map((combo) => combo.map(Number)),
  });
  return rows.map(variantFromWire);
}

interface WireStockGrid {
  variants: { id: number; name: string; sku: string; active: boolean }[];
  warehouses: { id: number; name: string }[];
  cells: { variantId: number; warehouseId: number; quantity: number }[];
  shownToCustomers: number;
}

function gridFromWire(grid: WireStockGrid): StockGrid {
  return {
    variants: grid.variants.map((v) => ({ ...v, id: String(v.id) })),
    warehouses: grid.warehouses.map((w) => ({ ...w, id: String(w.id) })),
    cells: grid.cells.map((c) => ({
      variantId: String(c.variantId),
      warehouseId: String(c.warehouseId),
      quantity: c.quantity,
    })),
    shownToCustomers: grid.shownToCustomers,
  };
}

export async function getStockGrid(productId: string, signal?: AbortSignal): Promise<StockGrid> {
  return gridFromWire(await apiFetch<WireStockGrid>(`${BASE}/products/${productId}/stock-grid`, { signal }));
}

/** Saves the cells as written (a set, not an add). */
export async function saveStockGrid(
  productId: string,
  cells: { variantId: string; warehouseId: string; quantity: number }[],
): Promise<StockGrid> {
  return gridFromWire(
    await apiFetch<WireStockGrid>(`${BASE}/products/${productId}/stock-grid`, {
      method: "PUT",
      body: cells.map((c) => ({
        variantId: Number(c.variantId),
        warehouseId: Number(c.warehouseId),
        quantity: c.quantity,
      })),
    }),
  );
}

// ----------------------------------------------------------------- customers

interface WirePlannerProfile {
  customerId: number;
  customerName: string | null;
  businessName: string;
  yearsInBusiness: string | null;
  about: string | null;
  status: PlannerProfileView["status"];
  rejectionReason?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
}

/** The backend leaves null fields out of its JSON, so most of these may be absent. */
interface WireCustomer {
  id: number;
  fullName: string;
  email: string;
  phone?: string | null;
  accountType: CustomerView["accountType"];
  gstin?: string | null;
  state?: string | null;
  active: boolean;
  storefrontAccountId?: string | null;
  plannerProfile?: WirePlannerProfile | null;
  priceListId?: number | null;
}

function plannerFromWire(profile: WirePlannerProfile): PlannerProfileView {
  return {
    customerId: String(profile.customerId),
    customerName: profile.customerName ?? null,
    businessName: profile.businessName,
    yearsInBusiness: profile.yearsInBusiness ?? null,
    about: profile.about ?? null,
    status: profile.status,
    rejectionReason: profile.rejectionReason ?? null,
    submittedAt: profile.submittedAt,
    reviewedAt: profile.reviewedAt ?? null,
    reviewedBy: profile.reviewedBy ?? null,
  };
}

function customerFromWire(customer: WireCustomer): CustomerView {
  return {
    id: String(customer.id),
    fullName: customer.fullName,
    email: customer.email,
    phone: customer.phone ?? null,
    accountType: customer.accountType,
    gstin: customer.gstin ?? null,
    state: customer.state ?? null,
    active: customer.active,
    storefrontAccountId: customer.storefrontAccountId ?? null,
    plannerProfile: customer.plannerProfile ? plannerFromWire(customer.plannerProfile) : null,
    priceListId: customer.priceListId == null ? null : String(customer.priceListId),
  };
}

/** Blank optional fields are sent as absent, which the backend stores as empty. */
function customerBody(request: CreateCustomerRequest | UpdateCustomerRequest) {
  return {
    fullName: request.fullName,
    email: request.email,
    phone: request.phone || undefined,
    accountType: request.accountType,
    gstin: request.gstin || undefined,
    // Always sent: blank clears it (an absent state would leave the old one).
    state: request.state ?? "",
  };
}

export async function listCustomers(signal?: AbortSignal): Promise<CustomerView[]> {
  const rows = await apiFetch<WireCustomer[]>(`${BASE}/customers`, { signal });
  return rows.map(customerFromWire);
}

export async function getCustomer(customerId: string, signal?: AbortSignal): Promise<CustomerView> {
  const row = await apiFetch<WireCustomer>(`${BASE}/customers/${encodeURIComponent(customerId)}`, {
    signal,
  });
  return customerFromWire(row);
}

export async function createCustomer(request: CreateCustomerRequest): Promise<CustomerView> {
  const created = await apiFetch<WireCustomer>(`${BASE}/customers`, {
    method: "POST",
    body: customerBody(request),
  });
  return customerFromWire(created);
}

export async function updateCustomer(
  customerId: string,
  request: UpdateCustomerRequest,
): Promise<CustomerView> {
  const updated = await apiFetch<WireCustomer>(`${BASE}/customers/${customerId}`, {
    method: "PUT",
    body: customerBody(request),
  });
  return customerFromWire(updated);
}

/** Pending applications only, oldest first. */
export async function listPlannerApplications(signal?: AbortSignal): Promise<PlannerProfileView[]> {
  const rows = await apiFetch<WirePlannerProfile[]>(`${BASE}/planner-applications`, { signal });
  return rows.map(plannerFromWire);
}

/** Staff applying for trade pricing on a planner's behalf. 422 unless the customer is an event planner. */
export async function applyAsPlanner(
  customerId: string,
  request: PlannerApplicationRequest,
): Promise<PlannerProfileView> {
  const profile = await apiFetch<WirePlannerProfile>(
    `${BASE}/customers/${customerId}/planner-profile`,
    {
      method: "PUT",
      body: {
        businessName: request.businessName,
        yearsInBusiness: request.yearsInBusiness || undefined,
        about: request.about || undefined,
      },
    },
  );
  return plannerFromWire(profile);
}

export async function approvePlannerApplication(customerId: string): Promise<PlannerProfileView> {
  const profile = await apiFetch<WirePlannerProfile>(
    `${BASE}/planner-applications/${customerId}/approve`,
    { method: "POST" },
  );
  return plannerFromWire(profile);
}

/** 400 for a blank reason; 422 if the application is not pending. */
export async function rejectPlannerApplication(
  customerId: string,
  reason: string,
): Promise<PlannerProfileView> {
  const profile = await apiFetch<WirePlannerProfile>(
    `${BASE}/planner-applications/${customerId}/reject`,
    { method: "POST", body: { reason } },
  );
  return plannerFromWire(profile);
}

// ------------------------------------------------- warehouses, suppliers, trucks

interface WireWarehouse {
  id: number;
  name: string;
  addressLine?: string | null;
  city?: string | null;
  active: boolean;
}

interface WireStockLine {
  id: number;
  locationId: number;
  productId: number;
  productName: string | null;
  variantId?: number | null;
  variantName?: string | null;
  quantity: number;
}

interface WireSupplier {
  id: number;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  addressLine?: string | null;
  gstin?: string | null;
  active: boolean;
}

interface WireTruck {
  id: number;
  registrationNumber: string;
  capacityKg: number;
  active: boolean;
}

function warehouseFromWire(warehouse: WireWarehouse): WarehouseView {
  return {
    id: String(warehouse.id),
    companyId: companyId(),
    name: warehouse.name,
    address: warehouse.addressLine ?? "",
    city: warehouse.city ?? "",
    active: warehouse.active,
  };
}

/** The same shape serves owned stock (location = warehouse) and supplier stock (location = supplier). */
function stockFromWire(line: WireStockLine): WarehouseProductView {
  return {
    warehouseId: String(line.locationId),
    productId: String(line.productId),
    variantId: line.variantId == null ? null : String(line.variantId),
    productName: line.productName ?? "",
    variantName: line.variantName ?? null,
    quantity: line.quantity,
  };
}

function supplierFromWire(supplier: WireSupplier): SupplierView {
  return {
    id: String(supplier.id),
    name: supplier.name,
    contactPerson: supplier.contactPerson ?? null,
    phone: supplier.phone ?? null,
    email: supplier.email ?? null,
    addressLine: supplier.addressLine ?? null,
    gstin: supplier.gstin ?? null,
    active: supplier.active,
  };
}

function truckFromWire(truck: WireTruck): TruckView {
  return {
    id: String(truck.id),
    companyId: companyId(),
    registration: truck.registrationNumber,
    capacityKg: Number(truck.capacityKg),
    active: truck.active,
  };
}

export async function listWarehouses(signal?: AbortSignal): Promise<WarehouseView[]> {
  const rows = await apiFetch<WireWarehouse[]>(`${BASE}/warehouses`, { signal });
  return rows.map(warehouseFromWire);
}

export async function createWarehouse(request: CreateWarehouseRequest): Promise<WarehouseView> {
  const created = await apiFetch<WireWarehouse>(`${BASE}/warehouses`, {
    method: "POST",
    body: { name: request.name, addressLine: request.address, city: request.city, location: request.location },
  });
  return warehouseFromWire(created);
}

export async function updateWarehouse(
  warehouseId: string,
  request: UpdateWarehouseRequest,
): Promise<WarehouseView> {
  const updated = await apiFetch<WireWarehouse>(`${BASE}/warehouses/${warehouseId}`, {
    method: "PUT",
    body: {
      name: request.name,
      addressLine: request.address,
      city: request.city,
      active: request.active,
      location: request.location,
    },
  });
  return warehouseFromWire(updated);
}

export function deleteWarehouse(warehouseId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/warehouses/${warehouseId}`, { method: "DELETE" });
}

export async function listWarehouseProducts(
  warehouseId: string,
  signal?: AbortSignal,
): Promise<WarehouseProductView[]> {
  const rows = await apiFetch<WireStockLine[]>(`${BASE}/warehouses/${warehouseId}/stock`, { signal });
  return rows.map(stockFromWire);
}

export async function addProductToWarehouse(
  warehouseId: string,
  request: AddWarehouseProductRequest,
): Promise<WarehouseProductView> {
  const line = await apiFetch<WireStockLine>(`${BASE}/warehouses/${warehouseId}/stock`, {
    method: "POST",
    body: {
      productId: Number(request.productId),
      variantId: request.variantId ? Number(request.variantId) : undefined,
      quantity: request.quantity,
    },
  });
  return stockFromWire(line);
}

export async function listSuppliers(signal?: AbortSignal): Promise<SupplierView[]> {
  const rows = await apiFetch<WireSupplier[]>(`${BASE}/suppliers`, { signal });
  return rows.map(supplierFromWire);
}

function supplierBody(request: SupplierRequest) {
  return {
    name: request.name,
    contactPerson: request.contactPerson || undefined,
    phone: request.phone || undefined,
    email: request.email || undefined,
    addressLine: request.addressLine || undefined,
    gstin: request.gstin || undefined,
    active: request.active,
  };
}

export async function createSupplier(request: SupplierRequest): Promise<SupplierView> {
  const created = await apiFetch<WireSupplier>(`${BASE}/suppliers`, {
    method: "POST",
    body: supplierBody(request),
  });
  return supplierFromWire(created);
}

export async function updateSupplier(
  supplierId: string,
  request: SupplierRequest,
): Promise<SupplierView> {
  const updated = await apiFetch<WireSupplier>(`${BASE}/suppliers/${supplierId}`, {
    method: "PUT",
    body: supplierBody(request),
  });
  return supplierFromWire(updated);
}

export async function listSupplierStock(
  supplierId: string,
  signal?: AbortSignal,
): Promise<SupplierStockView[]> {
  const rows = await apiFetch<WireStockLine[]>(`${BASE}/suppliers/${supplierId}/stock`, { signal });
  return rows.map(stockFromWire);
}

/** Replaces the supplier's count for that product or variant; it does not add to it. */
export async function setSupplierStock(
  supplierId: string,
  request: SetSupplierStockRequest,
): Promise<SupplierStockView> {
  const line = await apiFetch<WireStockLine>(`${BASE}/suppliers/${supplierId}/stock`, {
    method: "PUT",
    body: {
      productId: Number(request.productId),
      variantId: request.variantId ? Number(request.variantId) : undefined,
      quantity: request.quantity,
    },
  });
  return stockFromWire(line);
}

export async function listTrucks(signal?: AbortSignal): Promise<TruckView[]> {
  const rows = await apiFetch<WireTruck[]>(`${BASE}/trucks`, { signal });
  return rows.map(truckFromWire);
}

export async function createTruck(request: CreateTruckRequest): Promise<TruckView> {
  const created = await apiFetch<WireTruck>(`${BASE}/trucks`, {
    method: "POST",
    body: { registrationNumber: request.registration, capacityKg: request.capacityKg },
  });
  return truckFromWire(created);
}

export async function updateTruck(truckId: string, request: UpdateTruckRequest): Promise<TruckView> {
  const updated = await apiFetch<WireTruck>(`${BASE}/trucks/${truckId}`, {
    method: "PUT",
    body: {
      registrationNumber: request.registration,
      capacityKg: request.capacityKg,
      active: request.active,
    },
  });
  return truckFromWire(updated);
}

export function deleteTruck(truckId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/trucks/${truckId}`, { method: "DELETE" });
}

// ------------------------------------------- occasions, bundles, featured collections

interface WireOccasion {
  id: number;
  name: string;
  slug: string;
  displayOrder: number;
  visible: boolean;
  productCount: number;
  bundleCount: number;
}

interface WireBundleSwap {
  productId: number;
  productName: string;
  variantId?: number | null;
  variantName?: string | null;
}

interface WireBundleItem {
  productId: number;
  productName: string;
  variantId?: number | null;
  variantName?: string | null;
  quantity: number;
  productActive: boolean;
  swapOptions: WireBundleSwap[];
}

interface WireBundle {
  id: number;
  name: string;
  tagline?: string | null;
  description?: string | null;
  guestMin?: number | null;
  guestMax?: number | null;
  setupHours?: number | null;
  imageUrl?: string | null;
  active: boolean;
  highlights: string[];
  occasionIds: number[];
  items: WireBundleItem[];
  fromPricePerEvent: number;
  discountPercent?: number;
  discountedPrice?: number;
}

interface WireCollection {
  id: number;
  name: string;
  description?: string | null;
  palette?: string | null;
  imageUrl?: string | null;
  active: boolean;
  occasionIds: number[];
  products: { productId: number; sku: string; name: string; imageUrl?: string | null; productActive: boolean }[];
}

function fetchOccasions(signal?: AbortSignal): Promise<WireOccasion[]> {
  return apiFetch<WireOccasion[]>(`${BASE}/occasions`, { signal });
}

function occasionFromWire(occasion: WireOccasion): BundleOccasionView {
  return {
    id: String(occasion.id),
    companyId: companyId(),
    name: occasion.name,
    active: occasion.visible,
    // The screens count positions from 1; the backend from 0.
    sortOrder: occasion.displayOrder + 1,
    bundleCount: occasion.bundleCount,
  };
}

const occasionsById = (rows: WireOccasion[]) => new Map(rows.map((row) => [row.id, row]));

export async function listBundleOccasions(signal?: AbortSignal): Promise<BundleOccasionView[]> {
  return (await fetchOccasions(signal)).map(occasionFromWire);
}

export async function createBundleOccasion(
  request: CreateBundleOccasionRequest,
): Promise<BundleOccasionView> {
  const created = await apiFetch<WireOccasion>(`${BASE}/occasions`, {
    method: "POST",
    body: { name: request.name },
  });
  return occasionFromWire(created);
}

export async function updateBundleOccasion(
  occasionId: string,
  request: UpdateBundleOccasionRequest,
): Promise<BundleOccasionView> {
  // Leaving the position out would move the occasion to the front, so it is sent back unchanged.
  const current = (await fetchOccasions()).find((row) => String(row.id) === occasionId);
  const updated = await apiFetch<WireOccasion>(`${BASE}/occasions/${occasionId}`, {
    method: "PUT",
    body: { name: request.name, displayOrder: current?.displayOrder },
  });
  return occasionFromWire(updated);
}

/** Hiding keeps the occasion on its bundles and products; it only leaves the storefront's filter row. */
export async function setBundleOccasionActive(
  occasionId: string,
  active: boolean,
): Promise<BundleOccasionView> {
  const changed = await apiFetch<WireOccasion>(
    `${BASE}/occasions/${occasionId}/${active ? "show" : "hide"}`,
    { method: "POST" },
  );
  return occasionFromWire(changed);
}

/** One write per occasion whose position changed, so reordering is a short run of small saves. */
export async function reorderBundleOccasions(occasionIds: string[]): Promise<BundleOccasionView[]> {
  const byId = new Map((await fetchOccasions()).map((row) => [String(row.id), row]));
  for (const [index, id] of occasionIds.entries()) {
    const row = byId.get(id);
    if (row && row.displayOrder !== index) {
      await apiFetch<WireOccasion>(`${BASE}/occasions/${id}`, {
        method: "PUT",
        body: { name: row.name, displayOrder: index },
      });
    }
  }
  return listBundleOccasions();
}

function guestsLabel(min?: number | null, max?: number | null): string | null {
  if (min != null && max != null) return min === max ? String(min) : `${min}–${max}`;
  if (min != null) return `${min}+`;
  if (max != null) return `up to ${max}`;
  return null;
}

function setupLabel(hours?: number | null): string | null {
  return hours == null ? null : `${hours} ${Number(hours) === 1 ? "hour" : "hours"}`;
}

function bundleFromWire(bundle: WireBundle, occasions: Map<number, WireOccasion>): BundleView {
  return {
    id: String(bundle.id),
    companyId: companyId(),
    name: bundle.name,
    active: bundle.active,
    tagline: bundle.tagline ?? null,
    description: bundle.description ?? null,
    guests: guestsLabel(bundle.guestMin, bundle.guestMax),
    setupTime: setupLabel(bundle.setupHours),
    guestMin: bundle.guestMin ?? null,
    guestMax: bundle.guestMax ?? null,
    setupHours: bundle.setupHours == null ? null : Number(bundle.setupHours),
    highlights: bundle.highlights,
    components: bundle.items.map((item) => ({
      productId: String(item.productId),
      productName: item.productName,
      sku: "",
      quantity: item.quantity,
      active: item.productActive,
      variantId: item.variantId == null ? null : String(item.variantId),
      variantName: item.variantName ?? null,
      swapOptions: item.swapOptions.map((swap) => ({
        productId: String(swap.productId),
        productName: swap.productName,
        variantId: swap.variantId == null ? null : String(swap.variantId),
        variantName: swap.variantName ?? null,
      })),
    })),
    // Derived from the items on the backend, never typed in (ADR-005): "from ₹X per event".
    rentalRate: money(bundle.fromPricePerEvent),
    discountPercent: bundle.discountPercent ?? 0,
    discountedPrice: money(bundle.discountedPrice ?? bundle.fromPricePerEvent),
    media: bundle.imageUrl ? [mediaFromUrl(bundle.imageUrl)] : [],
    occasions: bundle.occasionIds.flatMap((id) => {
      const occasion = occasions.get(id);
      return occasion ? [{ id: String(id), name: occasion.name, active: occasion.visible }] : [];
    }),
  };
}

function bundleBody(request: CreateBundleRequest) {
  return {
    name: request.name,
    tagline: request.tagline || undefined,
    description: request.description || undefined,
    guestMin: request.guestMin ?? undefined,
    guestMax: request.guestMax ?? undefined,
    setupHours: request.setupHours ?? undefined,
    discountPercent: request.discountPercent ?? 0,
    imageUrl: request.media[0]?.url || undefined,
    highlights: request.highlights,
    occasionIds: request.occasionIds.map(Number),
    items: request.components.map((component) => ({
      productId: Number(component.productId),
      variantId: component.variantId ? Number(component.variantId) : undefined,
      quantity: component.quantity,
      swapOptions: (component.swapOptions ?? []).map((swap) => ({
        productId: Number(swap.productId),
        variantId: swap.variantId ? Number(swap.variantId) : undefined,
      })),
    })),
  };
}

export async function listBundles(signal?: AbortSignal): Promise<BundleView[]> {
  const [rows, occasions] = await Promise.all([
    apiFetch<WireBundle[]>(`${BASE}/bundles`, { signal }),
    fetchOccasions(signal),
  ]);
  const byId = occasionsById(occasions);
  return rows.map((row) => bundleFromWire(row, byId));
}

export async function createBundle(request: CreateBundleRequest): Promise<BundleView> {
  const created = await apiFetch<WireBundle>(`${BASE}/bundles`, {
    method: "POST",
    body: bundleBody(request),
  });
  return bundleFromWire(created, occasionsById(await fetchOccasions()));
}

export async function updateBundle(
  bundleId: string,
  request: UpdateBundleRequest,
): Promise<BundleView> {
  const updated = await apiFetch<WireBundle>(`${BASE}/bundles/${bundleId}`, {
    method: "PUT",
    body: bundleBody(request),
  });
  return bundleFromWire(updated, occasionsById(await fetchOccasions()));
}

/** Inactive bundles stay on record but leave the storefront. */
export async function setBundleActive(bundleId: string, active: boolean): Promise<BundleView> {
  const changed = await apiFetch<WireBundle>(
    `${BASE}/bundles/${bundleId}/${active ? "activate" : "deactivate"}`,
    { method: "POST" },
  );
  return bundleFromWire(changed, occasionsById(await fetchOccasions()));
}

export function deleteBundle(bundleId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/bundles/${bundleId}`, { method: "DELETE" });
}

function collectionFromWire(
  collection: WireCollection,
  occasions: Map<number, WireOccasion>,
): FeaturedCollectionView {
  return {
    id: String(collection.id),
    companyId: companyId(),
    name: collection.name,
    description: collection.description ?? null,
    active: collection.active,
    media: collection.imageUrl ? [mediaFromUrl(collection.imageUrl)] : [],
    bestFor: collection.occasionIds.flatMap((id) => {
      const occasion = occasions.get(id);
      return occasion ? [occasion.name] : [];
    }),
    occasionIds: collection.occasionIds.map(String),
    palette: collection.palette ?? null,
    products: collection.products.map((product) => ({
      productId: String(product.productId),
      name: product.name,
      sku: product.sku,
      imageUrl: product.imageUrl ?? null,
      active: product.productActive,
    })),
  };
}

function collectionBody(request: CreateFeaturedCollectionRequest) {
  return {
    name: request.name,
    description: request.description || undefined,
    palette: request.palette || undefined,
    imageUrl: request.media[0]?.url || undefined,
    productIds: request.productIds.map(Number),
    occasionIds: (request.occasionIds ?? []).map(Number),
  };
}

export async function listFeaturedCollections(signal?: AbortSignal): Promise<FeaturedCollectionView[]> {
  const [rows, occasions] = await Promise.all([
    apiFetch<WireCollection[]>(`${BASE}/featured-collections`, { signal }),
    fetchOccasions(signal),
  ]);
  const byId = occasionsById(occasions);
  return rows.map((row) => collectionFromWire(row, byId));
}

export async function createFeaturedCollection(
  request: CreateFeaturedCollectionRequest,
): Promise<FeaturedCollectionView> {
  const created = await apiFetch<WireCollection>(`${BASE}/featured-collections`, {
    method: "POST",
    body: collectionBody(request),
  });
  return collectionFromWire(created, occasionsById(await fetchOccasions()));
}

/** Replaces the product list and the occasions in full. */
export async function updateFeaturedCollection(
  collectionId: string,
  request: UpdateFeaturedCollectionRequest,
): Promise<FeaturedCollectionView> {
  const updated = await apiFetch<WireCollection>(`${BASE}/featured-collections/${collectionId}`, {
    method: "PUT",
    body: collectionBody(request),
  });
  return collectionFromWire(updated, occasionsById(await fetchOccasions()));
}

export async function setFeaturedCollectionActive(
  collectionId: string,
  active: boolean,
): Promise<FeaturedCollectionView> {
  const changed = await apiFetch<WireCollection>(
    `${BASE}/featured-collections/${collectionId}/${active ? "activate" : "deactivate"}`,
    { method: "POST" },
  );
  return collectionFromWire(changed, occasionsById(await fetchOccasions()));
}

// ------------------------------------------ price lists, payment setup, company

interface WirePriceListItem {
  productId: number;
  productName: string;
  variantId?: number | null;
  variantName?: string | null;
  dailyRate: number;
}

interface WirePriceList {
  id: number;
  name: string;
  defaultDiscountPercent: number;
  active: boolean;
  items: WirePriceListItem[];
}

interface WirePaymentTerms {
  id: number;
  name: string;
  description?: string | null;
  active: boolean;
  details: { description: string; percentage: number }[];
}

function priceListFromWire(list: WirePriceList): PriceListView {
  return {
    id: String(list.id),
    name: list.name,
    defaultDiscountPercent: Number(list.defaultDiscountPercent),
    active: list.active,
    items: list.items.map((item) => ({
      productId: String(item.productId),
      productName: item.productName,
      variantId: item.variantId == null ? null : String(item.variantId),
      variantName: item.variantName ?? null,
      dailyRate: Number(item.dailyRate),
    })),
  };
}

function priceListItemsBody(request: PriceListRequest) {
  return request.items.map((item) => ({
    productId: Number(item.productId),
    variantId: item.variantId ? Number(item.variantId) : undefined,
    dailyRate: item.dailyRate,
  }));
}

export async function listPriceLists(signal?: AbortSignal): Promise<PriceListView[]> {
  const rows = await apiFetch<WirePriceList[]>(`${BASE}/price-lists`, { signal });
  return rows.map(priceListFromWire);
}

/** Two calls: the list itself, then its explicit rates. A failure in the second leaves the list saved without rates. */
export async function createPriceList(request: PriceListRequest): Promise<PriceListView> {
  const created = await apiFetch<WirePriceList>(`${BASE}/price-lists`, {
    method: "POST",
    body: { name: request.name, defaultDiscountPercent: request.defaultDiscountPercent },
  });
  const withItems = await apiFetch<WirePriceList>(`${BASE}/price-lists/${created.id}/items`, {
    method: "PUT",
    body: priceListItemsBody(request),
  });
  return priceListFromWire(withItems);
}

export async function updatePriceList(
  priceListId: string,
  request: PriceListRequest,
): Promise<PriceListView> {
  await apiFetch<WirePriceList>(`${BASE}/price-lists/${priceListId}`, {
    method: "PUT",
    body: {
      name: request.name,
      defaultDiscountPercent: request.defaultDiscountPercent,
      active: request.active,
    },
  });
  const withItems = await apiFetch<WirePriceList>(`${BASE}/price-lists/${priceListId}/items`, {
    method: "PUT",
    body: priceListItemsBody(request),
  });
  return priceListFromWire(withItems);
}

/** Puts an event planner on a price list, or off every list with null. 422 for a plain customer. */
export async function assignPriceList(customerId: string, priceListId: string | null): Promise<void> {
  await apiFetch<unknown>(`${BASE}/customers/${customerId}/price-list`, {
    method: "PUT",
    body: { priceListId: priceListId === null ? null : Number(priceListId) },
  });
}

export function listPaymentModes(signal?: AbortSignal): Promise<PaymentModeView[]> {
  return apiFetch<{ id: number; name: string; active: boolean }[]>(`${BASE}/payment-modes`, {
    signal,
  }).then((rows) => rows.map((row) => ({ id: String(row.id), name: row.name, active: row.active })));
}

export async function createPaymentMode(request: PaymentModeRequest): Promise<PaymentModeView> {
  const created = await apiFetch<{ id: number; name: string; active: boolean }>(`${BASE}/payment-modes`, {
    method: "POST",
    body: { name: request.name },
  });
  return { id: String(created.id), name: created.name, active: created.active };
}

export async function updatePaymentMode(
  modeId: string,
  request: PaymentModeRequest,
): Promise<PaymentModeView> {
  const updated = await apiFetch<{ id: number; name: string; active: boolean }>(
    `${BASE}/payment-modes/${modeId}`,
    { method: "PUT", body: { name: request.name, active: request.active } },
  );
  return { id: String(updated.id), name: updated.name, active: updated.active };
}

function termsFromWire(terms: WirePaymentTerms): PaymentTermsView {
  return {
    id: String(terms.id),
    name: terms.name,
    description: terms.description ?? null,
    active: terms.active,
    details: terms.details.map((line) => ({
      description: line.description,
      percentage: Number(line.percentage),
    })),
  };
}

export async function listPaymentTerms(signal?: AbortSignal): Promise<PaymentTermsView[]> {
  const rows = await apiFetch<WirePaymentTerms[]>(`${BASE}/payment-terms`, { signal });
  return rows.map(termsFromWire);
}

export async function createPaymentTerms(request: PaymentTermsRequest): Promise<PaymentTermsView> {
  const created = await apiFetch<WirePaymentTerms>(`${BASE}/payment-terms`, {
    method: "POST",
    body: { name: request.name, description: request.description || undefined, details: request.details },
  });
  return termsFromWire(created);
}

export async function updatePaymentTerms(
  termsId: string,
  request: PaymentTermsRequest,
): Promise<PaymentTermsView> {
  const updated = await apiFetch<WirePaymentTerms>(`${BASE}/payment-terms/${termsId}`, {
    method: "PUT",
    body: {
      name: request.name,
      description: request.description || undefined,
      active: request.active,
      details: request.details,
    },
  });
  return termsFromWire(updated);
}

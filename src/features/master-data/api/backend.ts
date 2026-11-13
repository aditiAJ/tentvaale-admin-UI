import { apiDownload, apiFetch, ApiError } from "@/services/api-client";
import { getAuthToken } from "@/services/auth-token";
import { readSession } from "@/services/jwt";
import type { ArchiveKind, ArchiveView } from "@/features/master-data/types";
import type { ProductSetting, RateType } from "@/features/master-data/storefront";
import type { ImportOutcome, ImportPreview } from "@/features/master-data/productImport";
import type { WarehouseImportOutcome, WarehouseImportPreview } from "@/features/master-data/warehouseImport";
import type {
  AddWarehouseProductRequest,
  AllocationQuery,
  CreateLocationRequest,
  LayoutSummary,
  ListLocationsQuery,
  LocationCrumb,
  MoveStockRequest,
  PlaceStockRequest,
  StockAllocationView,
  StorageLocationView,
  UpdateLocationRequest,
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
  SupplierStockHistoryView,
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
  active: boolean;
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
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  /** Stated by an import; null/absent means it is worked out from the stock. */
  maxOrderable?: number | null;
}

interface WireProduct {
  id: number;
  sku: string;
  name: string;
  maxOrderable?: number | null;
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
  hsnCode?: string | null;
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
    active: sub.active,
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

/** Switches one sub-category off (its products hidden from the storefront, still editable) or back on. */
export async function setSubCategoryActive(subCategoryId: string, active: boolean): Promise<SubCategoryView> {
  return subCategoryFromWire(
    await apiFetch<WireSubCategory>(`${BASE}/sub-categories/${subCategoryId}/${active ? "activate" : "deactivate"}`, {
      method: "POST",
    }),
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
    imageUrl: variant.imageUrl ?? null,
    thumbnailUrl: variant.thumbnailUrl ?? null,
    maxOrderable: variant.maxOrderable ?? null,
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
    hsnCode: product.hsnCode ?? "",
    description: product.description ?? null,
    categoryId: String(product.categoryId),
    categoryName: product.categoryName,
    subCategoryId: String(product.subCategoryId),
    subCategoryName: product.subCategoryName,
    wholesaleRate: money(product.wholesaleRate),
    retailRate: money(product.dailyRate),
    hasVariants: product.hasVariants,
    maxOrderable: product.maxOrderable ?? null,
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

interface WireProductPage {
  items: WireProduct[];
  page: number;
  size: number;
  total: number;
}

/** The pictures variants carry of their own, by variant id. A variant with none is absent: its product's pictures show. */
export interface VariantImage {
  variantId: number;
  productId: number;
  imageUrl: string;
  thumbnailUrl?: string | null;
}

export function listVariantImages(signal?: AbortSignal): Promise<VariantImage[]> {
  return apiFetch<VariantImage[]>(`${BASE}/variant-images`, { signal });
}

export async function listProducts(
  signal?: AbortSignal,
  includeInactive = false,
): Promise<ProductView[]> {
  // The summary row now carries its own media and description, so one call is enough; no more
  // fetching every product's full detail (variants, facets, stock) just to read its thumbnail.
  // `size` is a generous cap, not real paging: screens still expect every matching product back
  // (pickers, the bundle/quotation forms, the products grid's own client-side filters).
  const params = new URLSearchParams({ size: "10000" });
  if (includeInactive) params.set("includeInactive", "true");
  const { items, total } = await apiFetch<WireProductPage>(`${BASE}/products?${params}`, { signal });
  // Loud, not silent: a catalogue past the cap must be visibly wrong, never quietly incomplete
  // (a picker missing products, a grid under-reporting its own count).
  if (total > items.length) {
    throw new ApiError(
      `The catalogue has ${total} products, more than this screen loads at once (${items.length}). ` +
        "This needs real paging before the catalogue can grow further.",
      500,
    );
  }
  return items.map((row) => productFromWire(row));
}

/** One product in full: unlike a list row it carries its variants, which View variants and Edit product need. */
export async function getProduct(productId: string, signal?: AbortSignal): Promise<ProductView> {
  return productFromWire(await apiFetch<WireProduct>(`${BASE}/products/${productId}`, { signal }));
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
    // Sent on every save: the backend replaces it, so leaving it out would erase it.
    hsnCode: request.hsnCode?.trim() || null,
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
 * the product media rules (PNG or JPEG, 800 to 3000 pixels, or one MP4 under 10 MB, 30 s, 1080p). The backend
 * still hard-rejects a product image over 2 MB — MediaField compresses to under that first (see media.ts's
 * compressProductImage), so a caller here should already be under the cap.
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
      imageUrl: variant.imageUrl,
      thumbnailUrl: variant.thumbnailUrl,
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
  addressLine?: string | null;
  postalCode?: string | null;
  active: boolean;
  storefrontAccountId?: string | null;
  plannerProfile?: WirePlannerProfile | null;
  plannerDiscountPercent?: number | null;
  customerDiscountPercent?: number | null;
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
    addressLine: customer.addressLine ?? null,
    postalCode: customer.postalCode ?? null,
    active: customer.active,
    storefrontAccountId: customer.storefrontAccountId ?? null,
    plannerProfile: customer.plannerProfile ? plannerFromWire(customer.plannerProfile) : null,
    plannerDiscountPercent: customer.plannerDiscountPercent == null ? null : Number(customer.plannerDiscountPercent),
    customerDiscountPercent: customer.customerDiscountPercent == null ? null : Number(customer.customerDiscountPercent),
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
    addressLine: request.addressLine ?? "",
    postalCode: request.postalCode ?? "",
    // Sent only when set: left out, the backend keeps the planner's discount (20 for a new planner).
    plannerDiscountPercent: request.plannerDiscountPercent ?? undefined,
    customerDiscountPercent: request.customerDiscountPercent ?? undefined,
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

/** 204; 422 with the reason when quotations, orders or credit notes still refer to the customer. */
export function deleteCustomer(customerId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/customers/${encodeURIComponent(customerId)}`, { method: "DELETE" });
}

/** Pending applications only, oldest first. */
export async function listPlannerApplications(signal?: AbortSignal): Promise<PlannerProfileView[]> {
  const rows = await apiFetch<WirePlannerProfile[]>(`${BASE}/planner-applications`, { signal });
  return rows.map(plannerFromWire);
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
  code?: string;
  contactPerson?: string | null;
  contactNumber?: string | null;
  description?: string | null;
  zoneCount?: number;
  locationCount?: number;
  location?: {
    placeId?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    postalCode?: string | null;
    state?: string | null;
    country?: string | null;
  } | null;
}

interface WireStockLine {
  id: number;
  locationId: number;
  productId: number;
  productName: string | null;
  variantId?: number | null;
  variantName?: string | null;
  quantity: number;
  placed?: number | null;
  sku?: string | null;
}

interface WireSupplier {
  id: number;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  gstin?: string | null;
  notes?: string | null;
  leadTimeDays?: number | null;
  minimumOrderQuantity?: number | null;
  active: boolean;
  productCount?: number;
  totalUnits?: number;
}

interface WireSupplierStock {
  id: number;
  supplierId: number;
  productId: number;
  productName: string | null;
  variantId?: number | null;
  variantName?: string | null;
  sku?: string | null;
  quantity: number;
  rate?: number | null;
  confirmedAt?: string | null;
}

interface WireSupplierHistory {
  id: number;
  productId: number;
  productName: string;
  variantId?: number | null;
  variantName?: string | null;
  previousQuantity?: number | null;
  newQuantity: number;
  previousRate?: number | null;
  newRate?: number | null;
  reason?: string | null;
  changedBy?: string | null;
  changedAt: string;
}

interface WireTruck {
  id: number;
  registrationNumber: string;
  capacityKg: number;
  active: boolean;
  vehicleType?: string | null;
  make?: string | null;
  model?: string | null;
  volumeCapacityM3?: number | null;
  notes?: string | null;
  inMaintenance?: boolean;
}

function warehouseFromWire(warehouse: WireWarehouse): WarehouseView {
  return {
    id: String(warehouse.id),
    companyId: companyId(),
    name: warehouse.name,
    address: warehouse.addressLine ?? "",
    city: warehouse.city ?? "",
    active: warehouse.active,
    code: warehouse.code,
    contactPerson: warehouse.contactPerson ?? undefined,
    contactNumber: warehouse.contactNumber ?? undefined,
    description: warehouse.description ?? undefined,
    zoneCount: warehouse.zoneCount ?? 0,
    locationCount: warehouse.locationCount ?? 0,
    location: warehouse.location
      ? {
          placeId: warehouse.location.placeId ?? undefined,
          latitude: warehouse.location.latitude ?? undefined,
          longitude: warehouse.location.longitude ?? undefined,
          postalCode: warehouse.location.postalCode ?? undefined,
          state: warehouse.location.state ?? undefined,
          country: warehouse.location.country ?? undefined,
        }
      : undefined,
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
    placed: line.placed ?? undefined,
    sku: line.sku ?? undefined,
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
    city: supplier.city ?? null,
    state: supplier.state ?? null,
    gstin: supplier.gstin ?? null,
    notes: supplier.notes ?? null,
    leadTimeDays: supplier.leadTimeDays ?? null,
    minimumOrderQuantity: supplier.minimumOrderQuantity ?? null,
    active: supplier.active,
    productCount: supplier.productCount ?? 0,
    totalUnits: supplier.totalUnits ?? 0,
  };
}

function supplierStockFromWire(line: WireSupplierStock): SupplierStockView {
  return {
    supplierId: String(line.supplierId),
    productId: String(line.productId),
    variantId: line.variantId == null ? null : String(line.variantId),
    productName: line.productName ?? "",
    variantName: line.variantName ?? null,
    sku: line.sku ?? undefined,
    quantity: line.quantity,
    rate: line.rate == null ? null : Number(line.rate),
    confirmedAt: line.confirmedAt ?? null,
  };
}

function truckFromWire(truck: WireTruck): TruckView {
  return {
    id: String(truck.id),
    companyId: companyId(),
    registration: truck.registrationNumber,
    capacityKg: Number(truck.capacityKg),
    active: truck.active,
    vehicleType: truck.vehicleType ?? null,
    make: truck.make ?? null,
    model: truck.model ?? null,
    volumeCapacityM3: truck.volumeCapacityM3 == null ? null : Number(truck.volumeCapacityM3),
    notes: truck.notes ?? null,
    inMaintenance: truck.inMaintenance ?? false,
  };
}

/** An edit replaces every field on the server, so the whole form is sent; an empty box clears it. */
function truckBody(request: CreateTruckRequest) {
  return {
    registrationNumber: request.registration,
    capacityKg: request.capacityKg,
    active: request.active,
    vehicleType: request.vehicleType || undefined,
    make: request.make || undefined,
    model: request.model || undefined,
    volumeCapacityM3: request.volumeCapacityM3,
    notes: request.notes || undefined,
    inMaintenance: request.inMaintenance,
  };
}

export async function listWarehouses(signal?: AbortSignal): Promise<WarehouseView[]> {
  const rows = await apiFetch<WireWarehouse[]>(`${BASE}/warehouses`, { signal });
  return rows.map(warehouseFromWire);
}

export async function createWarehouse(request: CreateWarehouseRequest): Promise<WarehouseView> {
  const created = await apiFetch<WireWarehouse>(`${BASE}/warehouses`, {
    method: "POST",
    body: {
      name: request.name,
      addressLine: request.address,
      city: request.city,
      location: request.location,
      code: request.code,
      contactPerson: request.contactPerson,
      contactNumber: request.contactNumber,
      description: request.description,
    },
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
      code: request.code,
      contactPerson: request.contactPerson,
      contactNumber: request.contactNumber,
      description: request.description,
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
    city: request.city || undefined,
    state: request.state || undefined,
    gstin: request.gstin || undefined,
    notes: request.notes || undefined,
    leadTimeDays: request.leadTimeDays,
    minimumOrderQuantity: request.minimumOrderQuantity,
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
  const rows = await apiFetch<WireSupplierStock[]>(`${BASE}/suppliers/${supplierId}/stock`, { signal });
  return rows.map(supplierStockFromWire);
}

function supplierStockBody(request: SetSupplierStockRequest) {
  return {
    productId: Number(request.productId),
    variantId: request.variantId ? Number(request.variantId) : undefined,
    quantity: request.quantity,
    rate: request.rate,
    reason: request.reason || undefined,
  };
}

/** Replaces the supplier's count for that product or variant; it does not add to it. */
export async function setSupplierStock(
  supplierId: string,
  request: SetSupplierStockRequest,
): Promise<SupplierStockView> {
  const line = await apiFetch<WireSupplierStock>(`${BASE}/suppliers/${supplierId}/stock`, {
    method: "PUT",
    body: supplierStockBody(request),
  });
  return supplierStockFromWire(line);
}

/** All or nothing: the server saves every line or none of them. */
export async function setSupplierStockBulk(
  supplierId: string,
  lines: SetSupplierStockRequest[],
  reason?: string,
): Promise<SupplierStockView[]> {
  const saved = await apiFetch<WireSupplierStock[]>(`${BASE}/suppliers/${supplierId}/stock/bulk`, {
    method: "PUT",
    body: { lines: lines.map(supplierStockBody), reason: reason || undefined },
  });
  return saved.map(supplierStockFromWire);
}

export async function listSupplierStockHistory(
  supplierId: string,
  signal?: AbortSignal,
): Promise<SupplierStockHistoryView[]> {
  const rows = await apiFetch<WireSupplierHistory[]>(`${BASE}/suppliers/${supplierId}/stock/history`, { signal });
  return rows.map((row) => ({
    id: String(row.id),
    productId: String(row.productId),
    productName: row.productName,
    variantId: row.variantId == null ? null : String(row.variantId),
    variantName: row.variantName ?? null,
    previousQuantity: row.previousQuantity ?? null,
    newQuantity: row.newQuantity,
    previousRate: row.previousRate == null ? null : Number(row.previousRate),
    newRate: row.newRate == null ? null : Number(row.newRate),
    reason: row.reason ?? null,
    changedBy: row.changedBy ?? null,
    changedAt: row.changedAt,
  }));
}

export async function listTrucks(signal?: AbortSignal): Promise<TruckView[]> {
  const rows = await apiFetch<WireTruck[]>(`${BASE}/trucks`, { signal });
  return rows.map(truckFromWire);
}

export async function createTruck(request: CreateTruckRequest): Promise<TruckView> {
  const created = await apiFetch<WireTruck>(`${BASE}/trucks`, {
    method: "POST",
    body: truckBody(request),
  });
  return truckFromWire(created);
}

export async function updateTruck(truckId: string, request: UpdateTruckRequest): Promise<TruckView> {
  const updated = await apiFetch<WireTruck>(`${BASE}/trucks/${truckId}`, {
    method: "PUT",
    body: truckBody(request),
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
  rateType?: WireProduct["rateType"];
  productActive: boolean;
  swapOptions: WireBundleSwap[];
}

interface WireBundle {
  id: number;
  sku?: string | null;
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
  featured?: boolean;
}

interface WireCollection {
  id: number;
  sku?: string | null;
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
    sku: bundle.sku ?? null,
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
      rateType: item.rateType ? RATE_FROM_WIRE[item.rateType] : undefined,
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
    featured: bundle.featured ?? false,
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

/** A featured bundle is shown on the storefront beside the featured collections. */
export async function setBundleFeatured(bundleId: string, featured: boolean): Promise<BundleView> {
  const changed = await apiFetch<WireBundle>(
    `${BASE}/bundles/${bundleId}/${featured ? "feature" : "unfeature"}`,
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
    sku: collection.sku ?? null,
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

// ------------------------------------------ payment setup, company

interface WirePaymentTerms {
  id: number;
  name: string;
  description?: string | null;
  active: boolean;
  details: { description: string; percentage: number }[];
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

/** What the Products page can ask the Excel export for. `ids` wins: exactly those products. */
export interface ProductExportRequest {
  categoryId?: string;
  subCategoryId?: string;
  includeInactive: boolean;
  ids?: string[];
}

/** The catalogue as an .xlsx file (two sheets: Products and Variants), with the name the server gave it. */
export function exportProducts(request: ProductExportRequest, signal?: AbortSignal): Promise<{ blob: Blob; filename: string }> {
  const params = new URLSearchParams({ includeInactive: String(request.includeInactive) });
  if (request.categoryId) params.set("categoryId", request.categoryId);
  if (request.subCategoryId) params.set("subCategoryId", request.subCategoryId);
  if (request.ids?.length) params.set("ids", request.ids.join(","));
  return apiDownload(`${BASE}/products/export?${params}`, signal);
}

/** Checks an Excel file against the catalogue and says what importing it would do. Writes nothing. */
export function previewProductImport(file: File, signal?: AbortSignal): Promise<ImportPreview> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<ImportPreview>(`${BASE}/products/import/preview`, { method: "POST", body: form, signal });
}

/**
 * Imports the file: all of it or none of it. The server checks it again first, so a file that went stale since the
 * preview comes back with `imported: false` and its errors, not an exception.
 */
export function importProducts(file: File, fingerprint: string | undefined): Promise<ImportOutcome> {
  const form = new FormData();
  form.append("file", file);
  // What the user was shown; the server refuses to import if the catalogue no longer gives the same answer.
  if (fingerprint) form.append("fingerprint", fingerprint);
  return apiFetch<ImportOutcome>(`${BASE}/products/import`, { method: "POST", body: form });
}

// ---- the archive ----------------------------------------------------------------------------

/** Everything that was archived: categories, sub-categories and products. `query` matches a name or SKU. */
export function getArchive(query: string, signal?: AbortSignal): Promise<ArchiveView> {
  const q = query.trim();
  return apiFetch<ArchiveView>(`${BASE}/archive${q ? `?q=${encodeURIComponent(q)}` : ""}`, { signal });
}

/** 204. Archiving a category or sub-category archives what is under it; see ArchiveService. */
export function archiveItem(kind: ArchiveKind, id: number | string): Promise<void> {
  return apiFetch<void>(`${BASE}/${kind}/${encodeURIComponent(String(id))}/archive`, { method: "POST" });
}

/** 204; 422 with the reason when its parent is still archived. */
export function restoreItem(kind: ArchiveKind, id: number | string): Promise<void> {
  return apiFetch<void>(`${BASE}/${kind}/${encodeURIComponent(String(id))}/restore`, { method: "POST" });
}

/** 204; 422 with the reason when something still refers to a product. Only an archived item can be deleted this way. */
export function deleteArchivedItem(kind: ArchiveKind, id: number | string): Promise<void> {
  return apiFetch<void>(`${BASE}/${kind}/${encodeURIComponent(String(id))}`, { method: "DELETE" });
}

// ------------------------------------------------- warehouse layout and stock placement

interface WireLocation {
  id: number;
  warehouseId: number;
  parentId?: number | null;
  type: StorageLocationView["type"];
  code: string;
  name: string;
  fullCode: string;
  active: boolean;
  childCount: number;
  units: number;
  unitsInside?: number;
}

interface WireCrumb {
  id: number;
  type: LocationCrumb["type"];
  code: string;
  name: string;
  fullCode: string;
}

interface WireAllocation {
  id: number;
  warehouseId: number;
  warehouseName: string;
  locationId: number;
  locationCode: string;
  locationName: string;
  locationType: StockAllocationView["locationType"];
  locationActive: boolean;
  trail: WireCrumb[];
  productId: number;
  productName: string;
  sku: string;
  variantId?: number | null;
  variantName?: string | null;
  variantSku?: string | null;
  quantity: number;
}

const locationFromWire = (l: WireLocation): StorageLocationView => ({
  id: String(l.id),
  warehouseId: String(l.warehouseId),
  parentId: l.parentId == null ? null : String(l.parentId),
  type: l.type,
  code: l.code,
  name: l.name,
  fullCode: l.fullCode,
  active: l.active,
  childCount: l.childCount,
  units: l.units,
  unitsInside: l.unitsInside ?? l.units,
});

const crumbFromWire = (c: WireCrumb): LocationCrumb => ({ ...c, id: String(c.id) });

const allocationFromWire = (a: WireAllocation): StockAllocationView => ({
  id: String(a.id),
  warehouseId: String(a.warehouseId),
  warehouseName: a.warehouseName,
  locationId: String(a.locationId),
  locationCode: a.locationCode,
  locationName: a.locationName,
  locationType: a.locationType,
  locationActive: a.locationActive,
  trail: a.trail.map(crumbFromWire),
  productId: String(a.productId),
  productName: a.productName,
  sku: a.sku,
  variantId: a.variantId == null ? null : String(a.variantId),
  variantName: a.variantName ?? null,
  variantSku: a.variantSku ?? null,
  quantity: a.quantity,
});

function queryString(params: Record<string, string | number | boolean | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export async function listLocations(
  warehouseId: string,
  filter: ListLocationsQuery = {},
  signal?: AbortSignal,
): Promise<StorageLocationView[]> {
  const rows = await apiFetch<WireLocation[]>(
    `${BASE}/warehouses/${warehouseId}/locations${queryString({ ...filter })}`,
    { signal },
  );
  return rows.map(locationFromWire);
}

export async function getLocation(
  warehouseId: string,
  locationId: string,
  signal?: AbortSignal,
): Promise<{ location: StorageLocationView; ancestors: LocationCrumb[] }> {
  const detail = await apiFetch<{ location: WireLocation; ancestors: WireCrumb[] }>(
    `${BASE}/warehouses/${warehouseId}/locations/${locationId}`,
    { signal },
  );
  return { location: locationFromWire(detail.location), ancestors: detail.ancestors.map(crumbFromWire) };
}

export function getLayoutSummary(warehouseId: string, signal?: AbortSignal): Promise<LayoutSummary> {
  return apiFetch<LayoutSummary>(`${BASE}/warehouses/${warehouseId}/layout-summary`, { signal });
}

export async function createLocation(
  warehouseId: string,
  request: CreateLocationRequest,
): Promise<StorageLocationView> {
  const created = await apiFetch<WireLocation>(`${BASE}/warehouses/${warehouseId}/locations`, {
    method: "POST",
    body: {
      type: request.type,
      parentId: request.parentId ? Number(request.parentId) : undefined,
      code: request.code,
      name: request.name,
    },
  });
  return locationFromWire(created);
}

export async function updateLocation(
  warehouseId: string,
  locationId: string,
  request: UpdateLocationRequest,
): Promise<StorageLocationView> {
  const updated = await apiFetch<WireLocation>(`${BASE}/warehouses/${warehouseId}/locations/${locationId}`, {
    method: "PUT",
    body: request,
  });
  return locationFromWire(updated);
}

export function deleteLocation(warehouseId: string, locationId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/warehouses/${warehouseId}/locations/${locationId}`, { method: "DELETE" });
}

export async function listAllocations(
  warehouseId: string,
  filter: AllocationQuery = {},
  signal?: AbortSignal,
): Promise<StockAllocationView[]> {
  const rows = await apiFetch<WireAllocation[]>(
    `${BASE}/warehouses/${warehouseId}/allocations${queryString({ ...filter })}`,
    { signal },
  );
  return rows.map(allocationFromWire);
}

/** Resolves to null when quantity 0 removed the placement. */
export async function placeStock(
  warehouseId: string,
  request: PlaceStockRequest,
): Promise<StockAllocationView | null> {
  const row = await apiFetch<WireAllocation | undefined>(`${BASE}/warehouses/${warehouseId}/allocations`, {
    method: "PUT",
    body: {
      productId: Number(request.productId),
      variantId: request.variantId ? Number(request.variantId) : undefined,
      locationId: Number(request.locationId),
      quantity: request.quantity,
    },
  });
  return row ? allocationFromWire(row) : null;
}

export async function moveStock(warehouseId: string, request: MoveStockRequest): Promise<StockAllocationView> {
  const row = await apiFetch<WireAllocation>(`${BASE}/warehouses/${warehouseId}/allocations/move`, {
    method: "POST",
    body: {
      productId: Number(request.productId),
      variantId: request.variantId ? Number(request.variantId) : undefined,
      fromLocationId: Number(request.fromLocationId),
      toLocationId: Number(request.toLocationId),
      quantity: request.quantity,
    },
  });
  return allocationFromWire(row);
}

/** The warehouses and their stock as the workbook the warehouse import reads: a template and a copy in one. */
export function downloadWarehouseImportTemplate(signal?: AbortSignal): Promise<{ blob: Blob; filename: string }> {
  return apiDownload(`${BASE}/warehouses/import/template`, signal);
}

/** Checks a warehouse and stock file and says what importing it would do. Writes nothing. */
export function previewWarehouseImport(file: File, signal?: AbortSignal): Promise<WarehouseImportPreview> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<WarehouseImportPreview>(`${BASE}/warehouses/import/preview`, { method: "POST", body: form, signal });
}

/** Imports the file, all or nothing, and only if it still gives the answer the preview gave (the fingerprint). */
export function importWarehouses(file: File, fingerprint: string | undefined): Promise<WarehouseImportOutcome> {
  const form = new FormData();
  form.append("file", file);
  if (fingerprint) form.append("fingerprint", fingerprint);
  return apiFetch<WarehouseImportOutcome>(`${BASE}/warehouses/import`, { method: "POST", body: form });
}

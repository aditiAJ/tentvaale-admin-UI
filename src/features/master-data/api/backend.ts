import { apiFetch } from "@/services/api-client";
import { getAuthToken } from "@/services/auth-token";
import { readSession } from "@/services/jwt";
import type { ProductSetting, RateType } from "@/features/master-data/storefront";
import type {
  CategoryView,
  CreateCategoryRequest,
  CreateProductRequest,
  CreateProductVariantRequest,
  MediaAsset,
  ProductVariantView,
  ProductView,
  SubCategoryView,
  UpdateCategoryRequest,
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
  active: boolean;
  subCategories: WireSubCategory[];
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
  media?: { id: number; type: "IMAGE" | "VIDEO"; url: string; altText: string | null }[];
  facets?: { facetCode: string; facetLabel: string; value: string }[];
  variants?: WireVariant[];
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
    body: { name: request.name, imageUrl: request.media[0]?.url ?? null },
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

// ------------------------------------------------------------------ products

function variantFromWire(variant: WireVariant): ProductVariantView {
  return {
    id: String(variant.id),
    companyId: companyId(),
    productId: String(variant.productId),
    name: variant.name,
    wholesaleRate: money(variant.wholesaleRate),
    retailRate: money(variant.effectiveRate),
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
    tag: product.tag ?? "",
    wholesaleRate: money(product.wholesaleRate),
    retailRate: money(product.dailyRate),
    hasVariants: product.hasVariants,
    variants: list.map(variantFromWire),
    media: product.media?.map((m) => ({
      id: String(m.id),
      kind: m.type,
      fileName: m.altText ?? m.url.split("/").pop() ?? "media",
      contentType: "",
      sizeBytes: 0,
      url: m.url,
    })),
    rateType: RATE_FROM_WIRE[product.rateType],
    size: facetValues(product, "size")[0] ?? null,
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

export async function listProducts(signal?: AbortSignal): Promise<ProductView[]> {
  const rows = await apiFetch<WireProduct[]>(`${BASE}/products`, { signal });
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
    sku: request.sku,
    name: request.name,
    description: request.description || null,
    rateType: RATE_TO_WIRE[request.rateType],
    dailyRate: request.retailRate,
    wholesaleRate: request.wholesaleRate,
    skuOwner: request.skuOwner,
    genericName: request.genericName,
    tag: request.tag,
    hasVariants: request.hasVariants,
  };
}

function mediaBody(media: MediaAsset[]) {
  return media
    .filter((m) => m.url)
    .map((m) => ({ type: m.kind, url: m.url as string, altText: m.fileName }));
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

export async function createProduct(request: CreateProductRequest): Promise<ProductView> {
  const created = await apiFetch<WireProduct>(`${BASE}/products`, {
    method: "POST",
    body: productBody(request),
  });
  if (request.media.length) {
    await apiFetch<WireProduct>(`${BASE}/products/${created.id}/media`, {
      method: "PUT",
      body: mediaBody(request.media),
    });
  }
  return productFromWire(
    await apiFetch<WireProduct>(`${BASE}/products/${created.id}/storefront-details`, {
      method: "PUT",
      body: storefrontDetailsBody(request),
    }),
  );
}

export async function updateProduct(
  productId: string,
  request: CreateProductRequest,
): Promise<ProductView> {
  await apiFetch<WireProduct>(`${BASE}/products/${productId}`, {
    method: "PUT",
    body: productBody(request),
  });
  await apiFetch<WireProduct>(`${BASE}/products/${productId}/media`, {
    method: "PUT",
    body: mediaBody(request.media),
  });
  return productFromWire(
    await apiFetch<WireProduct>(`${BASE}/products/${productId}/storefront-details`, {
      method: "PUT",
      body: storefrontDetailsBody(request),
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

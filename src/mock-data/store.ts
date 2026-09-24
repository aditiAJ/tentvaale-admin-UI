import { ApiError } from "@/services/api-client";
import { isIsoDate, isValidPhone } from "@/lib/forms";
import { getAuthToken } from "@/services/auth-token";
import { readSession } from "@/services/jwt";
import type { Role } from "@/services/permissions";
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
  ProductMedia,
  SubCategoryView,
  UpdateTruckRequest,
  UpdateWarehouseRequest,
  WarehouseProductView,
  WarehouseView,
} from "@/features/master-data/types";
import { PRODUCT_MEDIA_LIMITS } from "@/features/master-data/types";
import type {
  CreateQuotationRequest,
  QuotationLineView,
  QuotationView,
  UpdateQuotationRequest,
} from "@/features/quotations/types";
import type { OrderView } from "@/features/orders/types";
import type {
  AvailabilityRow,
  RecordStockMovementRequest,
  StockMovementView,
} from "@/features/inventory/types";
import type {
  CreditNoteView,
  CustomerCreditBalance,
  IssueCreditNoteRequest,
} from "@/features/credit-notes/types";
import type { AdminUserView, CreateAdminUserRequest } from "@/features/users/types";
import type { AdminDashboardView } from "@/features/dashboard/types";
import type { NotificationLogView } from "@/features/notifications/types";
import { ALLOWED_NEXT, type DepositLedgerView } from "@/features/deposits/types";
import { mintMockToken } from "@/mock-data/token";
import {
  COMPANY_ID,
  SEED_BUNDLES,
  SEED_CATEGORIES,
  SEED_CREDIT_NOTES,
  SEED_CUSTOMERS,
  SEED_DEPOSITS,
  SEED_FEATURED_COLLECTIONS,
  SEED_NOTIFICATIONS,
  SEED_ORDERS,
  SEED_ORDER_DETAILS,
  SEED_PRODUCTS,
  SEED_PRODUCT_VARIANTS,
  SEED_QUOTATIONS,
  SEED_QUOTATION_DETAILS,
  SEED_STOCK_MOVEMENTS,
  SEED_SUB_CATEGORIES,
  SEED_TRUCKS,
  SEED_WAREHOUSES,
  SEED_WAREHOUSE_PRODUCTS,
  SEED_USERS,
  type BundleRecord,
  type CategoryRecord,
  type ProductRecord,
  type ProductVariantRecord,
  type FeaturedCollectionRecord,
  type WarehouseProduct,
} from "@/mock-data/seed";

/**
 * The mock backend.
 *
 * Every function here stands in for one endpoint and reproduces that endpoint's
 * *rules*, not just its shape — duplicate SKUs are refused, the last active
 * ADMIN cannot be demoted, deposits only move where the state machine allows.
 * Errors are thrown as the same ApiError the real client throws, with the same
 * status codes, so the UI's error handling is exercised rather than bypassed.
 *
 * State lives in localStorage so edits survive a reload, the way a real backend
 * would. Bump STORAGE_KEY's version suffix when the seed shape changes.
 */

// v13: movement lines carry a variantId, and the seeded orders, movements,
// deposits and warehouse stock were made to agree with one another.
// v12: bundles store { productId, quantity } components instead of product names.
// v11: MockState gained `productVariants`, and warehouse stock a variantId.
// v10: products store categoryId/subCategoryId instead of a category name.
// v9: MockState gained `featuredCollections`.
// v8: ProductView gained a required skuOwner.
// v7: MockState gained `subCategories`; without it, listing categories throws.
// v6: ProductView gained hasVariants and media.
// v5: ProductView swapped rentalRate/securityDeposit for wholesaleRate/retailRate
// and gained genericName and tag. A v4 payload would hydrate products without
// the fields quotation pricing and the products table now read.
// v4: MockState gained `warehouseProducts`. A v3 payload has no such array, and
// reading a warehouse's products from it would throw rather than come back empty.
const STORAGE_KEY = "tentvaale.admin.mock.v13";

/** Enough delay to make loading states real, little enough to feel instant. */
const LATENCY_MS = 220;

interface MockUser extends AdminUserView {
  password: string;
}

interface MockState {
  users: MockUser[];
  products: ProductRecord[];
  productVariants: ProductVariantRecord[];
  categories: CategoryRecord[];
  subCategories: SubCategoryView[];
  customers: CustomerView[];
  bundles: BundleRecord[];
  featuredCollections: FeaturedCollectionRecord[];
  warehouses: WarehouseView[];
  warehouseProducts: WarehouseProduct[];
  trucks: TruckView[];
  quotations: QuotationView[];
  orders: OrderView[];
  stockMovements: StockMovementView[];
  creditNotes: CreditNoteView[];
  notifications: NotificationLogView[];
  deposits: DepositLedgerView[];
}

function seedState(): MockState {
  // Structured-cloned so a mutation can never write back into the seed module.
  return structuredClone({
    users: SEED_USERS,
    products: SEED_PRODUCTS,
    productVariants: SEED_PRODUCT_VARIANTS,
    categories: SEED_CATEGORIES,
    subCategories: SEED_SUB_CATEGORIES,
    customers: SEED_CUSTOMERS,
    bundles: SEED_BUNDLES,
    featuredCollections: SEED_FEATURED_COLLECTIONS,
    warehouses: SEED_WAREHOUSES,
    warehouseProducts: SEED_WAREHOUSE_PRODUCTS,
    trucks: SEED_TRUCKS,
    quotations: SEED_QUOTATION_DETAILS,
    orders: SEED_ORDER_DETAILS,
    stockMovements: SEED_STOCK_MOVEMENTS,
    creditNotes: SEED_CREDIT_NOTES,
    notifications: SEED_NOTIFICATIONS,
    deposits: SEED_DEPOSITS,
  });
}

let cache: MockState | null = null;

function state(): MockState {
  if (cache) return cache;

  if (typeof window === "undefined") {
    cache = seedState();
    return cache;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    cache = stored ? forgetDeadMediaUrls(JSON.parse(stored) as MockState) : seedState();
  } catch {
    // Corrupt or unreadable storage is not worth failing over in a mock.
    cache = seedState();
  }
  return cache;
}

/**
 * A video's object URL points into the page that made it and is dead once that
 * page is gone, so one read back from storage is dropped rather than handed to
 * a <video> that would fail to load it. The rest of the media record stays.
 */
function forgetDeadMediaUrls(stored: MockState): MockState {
  for (const product of stored.products) {
    for (const item of product.media) {
      if (item.url?.startsWith("blob:")) item.url = null;
    }
  }
  return stored;
}

/**
 * Returns false when the write did not land. Most callers ignore that: quota or
 * private-mode failures leave the in-memory copy authoritative, which is fine
 * for a mock. Product writes do not, because images make them the one write
 * large enough to hit the quota — see saveProducts.
 */
function persist(): boolean {
  if (typeof window === "undefined" || !cache) return true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    return true;
  } catch {
    return false;
  }
}

/** Drops every local edit and reloads the seed. */
export function resetMockData(): void {
  cache = seedState();
  persist();
}

const delay = () => new Promise<void>((resolve) => setTimeout(resolve, LATENCY_MS));

/** Mirrors BusinessRuleViolationException → 422 with a message meant for the user. */
const businessRule = (detail: string) => new ApiError(detail, 422);
const notFound = (detail: string) => new ApiError(detail, 404);

/**
 * Who is making the call. The real endpoints take this from the token via
 * CompanyContext/CurrentCaller; here it is read from the same stored token, so
 * the self-deactivation and self-demotion rules behave identically.
 */
function caller() {
  const session = readSession(getAuthToken());
  if (!session) throw new ApiError("Your session has expired. Please sign in again.", 401);
  return session;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function mockLogin(username: string, password: string) {
  await delay();

  const match = state().users.find(
    (user) => user.username.toLowerCase() === username.trim().toLowerCase() && user.active,
  );

  // The real service throws a business-rule violation for bad credentials, not
  // a 401, and says nothing about which half was wrong.
  if (!match || match.password !== password) {
    throw businessRule("Invalid username or password");
  }

  return {
    accessToken: mintMockToken({
      userId: match.id,
      companyId: match.companyId,
      username: match.username,
      role: match.role,
    }),
  };
}

// ---------------------------------------------------------------------------
// Master data
// ---------------------------------------------------------------------------

/**
 * A stored product with its category and sub-category names resolved. Looked
 * up among all categories, inactive ones included, so deactivating a category
 * does not strip the label from products already filed under it.
 */
function toProductView(product: ProductRecord, current: MockState): ProductView {
  const category = current.categories.find((candidate) => candidate.id === product.categoryId);
  const subCategory = current.subCategories.find(
    (candidate) => candidate.id === product.subCategoryId,
  );
  return {
    ...product,
    categoryName: category?.name ?? null,
    subCategoryName: subCategory?.name ?? null,
    variants: current.productVariants
      .filter((variant) => variant.productId === product.id)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((variant) => toVariantView(variant, current)),
  };
}

/** A stored variant with its stock summed across every warehouse. */
function toVariantView(variant: ProductVariantRecord, current: MockState): ProductVariantView {
  return {
    ...variant,
    stock: current.warehouseProducts
      .filter((entry) => entry.variantId === variant.id)
      .reduce((sum, entry) => sum + entry.quantity, 0),
  };
}

export async function mockListProducts(): Promise<ProductView[]> {
  await delay();
  const current = state();
  // findByCompanyIdAndActiveTrueOrderByNameAsc — active only, sorted by name.
  return current.products
    .filter((product) => product.active)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((product) => toProductView(product, current));
}

/**
 * The category and sub-category a product is being filed under: both must
 * exist, and the sub-category must belong to that category. They must also be
 * active — unless the product is already in that category, so that switching a
 * category off does not make every product in it impossible to edit.
 */
function checkProductCategory(
  request: CreateProductRequest | UpdateProductRequest,
  current: MockState,
  existing?: ProductRecord,
): void {
  if (!request.categoryId) throw businessRule("Category is required");
  if (!request.subCategoryId) throw businessRule("Sub-category is required");

  const category = current.categories.find((candidate) => candidate.id === request.categoryId);
  if (!category) throw notFound(`Category ${request.categoryId} not found`);
  if (!category.active && existing?.categoryId !== category.id) {
    throw businessRule(`Category '${category.name}' is inactive`);
  }

  const subCategory = current.subCategories.find(
    (candidate) => candidate.id === request.subCategoryId,
  );
  if (!subCategory) throw notFound(`Sub-category ${request.subCategoryId} not found`);
  if (subCategory.categoryId !== category.id) {
    throw businessRule(`'${subCategory.name}' is not a sub-category of '${category.name}'`);
  }
}

/**
 * The rules both a product create and update enforce beyond the form's own.
 *
 * The object is always built field by field from the request, never spread, so
 * anything else a caller sends — a leftover rentalRate or securityDeposit from
 * an older client — is dropped rather than stored.
 */
function checkProductRequest(request: CreateProductRequest | UpdateProductRequest): void {
  if (typeof request.hasVariants !== "boolean") {
    throw businessRule("Say whether the product has variants");
  }
  checkProductMedia(request.media);
  if (!request.genericName?.trim()) throw businessRule("Generic name is required");
  if (!request.skuOwner?.trim()) throw businessRule("SKU owner is required");
  if (!request.tag?.trim()) throw businessRule("Tag is required");
  for (const [label, amount] of [
    ["Wholesale rate", request.wholesaleRate],
    ["Retail rate", request.retailRate],
  ] as const) {
    if (!Number.isFinite(amount) || amount < 0) {
      throw businessRule(`${label} must be zero or more`);
    }
  }
}

/**
 * The media a product may carry. A data URL for images and an object URL for
 * video are the only URLs the mock can have made itself (see
 * features/master-data/media); anything else is refused rather than stored.
 */
function checkProductMedia(media: ProductMedia[]): void {
  if (!Array.isArray(media)) throw businessRule("Media must be a list");
  const images = media.filter((item) => item.kind === "IMAGE").length;
  const videos = media.filter((item) => item.kind === "VIDEO").length;
  if (images + videos !== media.length) throw businessRule("Media must be an image or a video");
  if (images > PRODUCT_MEDIA_LIMITS.images) {
    throw businessRule(`A product can have at most ${PRODUCT_MEDIA_LIMITS.images} images`);
  }
  if (videos > PRODUCT_MEDIA_LIMITS.videos) {
    throw businessRule(`A product can have at most ${PRODUCT_MEDIA_LIMITS.videos} video`);
  }
  for (const item of media) {
    const expected = item.kind === "IMAGE" ? "data:image/" : "blob:";
    // A video whose preview was lost on reload is kept with a null url.
    const lostVideo = item.kind === "VIDEO" && item.url === null;
    if (!lostVideo && !item.url?.startsWith(expected)) {
      throw businessRule(`${item.fileName} was not added through the media picker`);
    }
  }
}

/** Images first, then video, each group in the order given. */
function orderedMedia(media: ProductMedia[]): ProductMedia[] {
  return [
    ...media.filter((item) => item.kind === "IMAGE"),
    ...media.filter((item) => item.kind === "VIDEO"),
  ].map((item) => ({
    id: item.id,
    kind: item.kind,
    fileName: item.fileName,
    contentType: item.contentType,
    sizeBytes: item.sizeBytes,
    url: item.url,
  }));
}

/**
 * Persists a product write, or undoes it and says why. Images are the one
 * thing in this mock large enough to exhaust the browser's storage quota, and
 * a save that looked successful but was gone after a reload would be worse
 * than a refusal.
 */
function saveProducts(current: MockState, previous: ProductRecord[]): void {
  if (persist()) return;
  current.products = previous;
  throw businessRule(
    "The browser's storage for this demo is full. Remove some images, here or on other products, and try again.",
  );
}

export async function mockCreateProduct(request: CreateProductRequest): Promise<ProductView> {
  await delay();
  const current = state();

  if (current.products.some((p) => p.sku.toLowerCase() === request.sku.toLowerCase())) {
    throw businessRule(`A product with SKU ${request.sku} already exists for this company`);
  }
  checkProductRequest(request);
  checkProductCategory(request, current);

  const created: ProductRecord = {
    id: crypto.randomUUID(),
    companyId: COMPANY_ID,
    sku: request.sku,
    skuOwner: request.skuOwner.trim(),
    name: request.name,
    genericName: request.genericName.trim(),
    description: request.description?.trim() ? request.description : null,
    categoryId: request.categoryId,
    subCategoryId: request.subCategoryId,
    tag: request.tag.trim(),
    wholesaleRate: { amount: request.wholesaleRate, currency: "INR" },
    retailRate: { amount: request.retailRate, currency: "INR" },
    hasVariants: request.hasVariants,
    media: orderedMedia(request.media),
    active: true,
  };

  const previous = current.products;
  current.products = [...previous, created];
  saveProducts(current, previous);
  return toProductView(created, current);
}

/** Every field is replaced; the product's id, company and active flag are kept. */
export async function mockUpdateProduct(
  productId: string,
  request: UpdateProductRequest,
): Promise<ProductView> {
  await delay();
  const current = state();

  const index = current.products.findIndex((product) => product.id === productId);
  if (index === -1) throw notFound(`Product ${productId} not found`);

  const others = current.products.filter((product) => product.id !== productId);
  if (others.some((p) => p.sku.toLowerCase() === request.sku.toLowerCase())) {
    throw businessRule(`A product with SKU ${request.sku} already exists for this company`);
  }
  checkProductRequest(request);
  const existing = current.products[index];
  checkProductCategory(request, current, existing);
  // Turning the flag off would leave variants, and their stock, attached to a
  // product that says it has none. Removing them first is a deliberate step.
  const variantCount = current.productVariants.filter((v) => v.productId === productId).length;
  if (!request.hasVariants && variantCount > 0) {
    throw businessRule(
      `'${existing.name}' has ${variantCount} ${variantCount === 1 ? "variant" : "variants"}; delete them before setting Has variants to No`,
    );
  }
  // Turning it on would strand stock held without a variant: every stock write
  // and movement then demands one, so that stock could never be dispatched,
  // topped up or — if it is out on rent — returned.
  if (request.hasVariants && !existing.hasVariants) {
    const onShelf = current.warehouseProducts
      .filter((entry) => entry.productId === productId && entry.variantId === null)
      .reduce((sum, entry) => sum + entry.quantity, 0);
    if (onShelf > 0) {
      throw businessRule(
        `'${existing.name}' has ${onShelf} in warehouses without a variant; it cannot be set to have variants`,
      );
    }
    const onRent = current.stockMovements
      .flatMap((movement) =>
        movement.lines
          .filter((line) => line.productId === productId && !line.variantId)
          .map((line) => (movement.direction === "OUTWARD" ? line.quantity : -line.quantity)),
      )
      .reduce((sum, quantity) => sum + quantity, 0);
    if (onRent > 0) {
      throw businessRule(
        `'${existing.name}' has ${onRent} out on rent without a variant; it cannot be set to have variants`,
      );
    }
  }

  const updated: ProductRecord = {
    id: existing.id,
    companyId: existing.companyId,
    sku: request.sku,
    skuOwner: request.skuOwner.trim(),
    name: request.name,
    genericName: request.genericName.trim(),
    description: request.description?.trim() ? request.description : null,
    categoryId: request.categoryId,
    subCategoryId: request.subCategoryId,
    tag: request.tag.trim(),
    wholesaleRate: { amount: request.wholesaleRate, currency: "INR" },
    retailRate: { amount: request.retailRate, currency: "INR" },
    hasVariants: request.hasVariants,
    media: orderedMedia(request.media),
    active: existing.active,
  };
  const previous = current.products;
  current.products = previous.map((product, i) => (i === index ? updated : product));
  saveProducts(current, previous);
  return toProductView(updated, current);
}

/** A stored category with its sub-categories gathered in, sorted by name. */
function toCategoryView(category: CategoryRecord, current: MockState): CategoryView {
  return {
    ...category,
    subCategories: current.subCategories
      .filter((sub) => sub.categoryId === category.id)
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/**
 * Trimmed sub-category names, refused if any is blank, too long, or repeats
 * another in the same list. Unique within one category, case-insensitively,
 * the same rule category names follow company-wide; the same name under two
 * different categories is fine.
 */
function checkSubCategoryNames(names: string[]): string[] {
  const trimmed = names.map((name) => (typeof name === "string" ? name.trim() : ""));
  const seen = new Set<string>();
  for (const name of trimmed) {
    if (!name) throw businessRule("Sub-category names cannot be empty");
    if (name.length > 150) throw businessRule(`Sub-category '${name.slice(0, 40)}…' is over 150 characters`);
    const key = name.toLowerCase();
    if (seen.has(key)) throw businessRule(`Sub-category '${name}' is listed more than once`);
    seen.add(key);
  }
  return trimmed;
}

export async function mockListCategories(): Promise<CategoryView[]> {
  await delay();
  const current = state();
  return current.categories
    .filter((category) => category.active)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((category) => toCategoryView(category, current));
}

export async function mockCreateCategory(request: CreateCategoryRequest): Promise<CategoryView> {
  await delay();
  const current = state();

  if (current.categories.some((c) => c.name.toLowerCase() === request.name.toLowerCase())) {
    throw businessRule(`A category named '${request.name}' already exists for this company`);
  }
  const subNames = checkSubCategoryNames(request.subCategories ?? []);

  const created: CategoryRecord = {
    id: crypto.randomUUID(),
    companyId: COMPANY_ID,
    name: request.name,
    active: true,
  };

  current.categories.push(created);
  current.subCategories.push(
    ...subNames.map((name) => ({
      id: crypto.randomUUID(),
      companyId: COMPANY_ID,
      categoryId: created.id,
      name,
    })),
  );
  persist();
  return toCategoryView(created, current);
}

/**
 * Customers, bundles, warehouses and trucks have no endpoint anywhere: none of
 * them has a controller to stand in for, so the writes further down this file
 * are this UI's proposals rather than mirrors. Customers at least have a real
 * entity (identity's StorefrontAccount), but it is created by storefront signup,
 * and nothing under /admin reaches it.
 */
export async function mockListCustomers(): Promise<CustomerView[]> {
  await delay();
  return [...state().customers].sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/** A stored bundle with each component's product resolved from the catalogue. */
function toBundleView(bundle: BundleRecord, current: MockState): BundleView {
  return {
    ...bundle,
    components: bundle.components.map(({ productId, quantity }) => {
      const product = current.products.find((candidate) => candidate.id === productId);
      // Products are only deactivated, never deleted, so this should always
      // resolve; the raw id beats a blank chip if it ever does not.
      return {
        productId,
        productName: product?.name ?? productId,
        sku: product?.sku ?? "",
        quantity,
        active: product?.active ?? false,
      };
    }),
  };
}

export async function mockListBundles(): Promise<BundleView[]> {
  await delay();
  const current = state();
  return [...current.bundles]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((bundle) => toBundleView(bundle, current));
}

export async function mockListWarehouses(): Promise<WarehouseView[]> {
  await delay();
  return [...state().warehouses].sort((a, b) => a.name.localeCompare(b.name));
}

export async function mockListTrucks(): Promise<TruckView[]> {
  await delay();
  return [...state().trucks].sort((a, b) => a.registration.localeCompare(b.registration));
}

// ---------------------------------------------------------------------------
// Master data writes for the modules with no backend.
//
// Everything below stands in for an endpoint that does not exist, so unlike the
// rest of this file it is not mirroring rules — it is proposing them. Three
// come up repeatedly and are worth stating once:
//
//  - Names are unique per company, case-insensitively, the same rule the real
//    createProduct applies to SKUs. It is the rule a human would expect and the
//    one that keeps a picker usable.
//  - Deleting is refused while something still points at the record, rather
//    than allowed and left to dangle. Nothing here is a foreign key, so the
//    database would not stop it and the UI is the only thing that can.
//  - A category deactivates instead of being deleted, because md_category is a
//    real table and products reference it loosely.
//
// When the backend defines these modules it may well decide differently. What
// matters is that the decision is visible here rather than implied by whatever
// the UI happened to allow.
// ---------------------------------------------------------------------------

/** Case-insensitive name match, ignoring one record — the one being edited. */
function nameTaken(names: string[], candidate: string): boolean {
  const normalised = candidate.trim().toLowerCase();
  return names.some((name) => name.trim().toLowerCase() === normalised);
}

export async function mockUpdateCategory(
  categoryId: string,
  request: UpdateCategoryRequest,
): Promise<CategoryView> {
  await delay();
  const current = state();

  const index = current.categories.findIndex((category) => category.id === categoryId);
  if (index === -1) throw notFound(`Category ${categoryId} not found`);

  const others = current.categories.filter((category) => category.id !== categoryId);
  if (nameTaken(others.map((category) => category.name), request.name)) {
    throw businessRule(`A category named '${request.name}' already exists for this company`);
  }

  // Validated in full before anything is written, so a bad entry halfway down
  // the list cannot leave the category half-updated.
  const entries = request.subCategories ?? [];
  const names = checkSubCategoryNames(entries.map((entry) => entry.name));
  const owned = new Set(
    current.subCategories.filter((sub) => sub.categoryId === categoryId).map((sub) => sub.id),
  );
  for (const entry of entries) {
    if (entry.id !== undefined && !owned.has(entry.id)) {
      throw notFound(`Sub-category ${entry.id} not found in this category`);
    }
  }
  // A sub-category left out is removed, which is refused while products are
  // filed under it — the same rule a referenced warehouse follows.
  const keptIds = new Set(entries.map((entry) => entry.id));
  for (const sub of current.subCategories) {
    if (sub.categoryId !== categoryId || keptIds.has(sub.id)) continue;
    const using = current.products.filter((product) => product.subCategoryId === sub.id).length;
    if (using > 0) {
      throw businessRule(
        `'${sub.name}' cannot be removed: ${using} ${using === 1 ? "product is" : "products are"} filed under it`,
      );
    }
  }

  const kept: SubCategoryView[] = entries.map((entry, i) => ({
    id: entry.id ?? crypto.randomUUID(),
    companyId: COMPANY_ID,
    categoryId,
    name: names[i],
  }));
  const updated: CategoryRecord = { ...current.categories[index], name: request.name };
  current.categories[index] = updated;
  current.subCategories = [
    ...current.subCategories.filter((sub) => sub.categoryId !== categoryId),
    ...kept,
  ];
  persist();
  return toCategoryView(updated, current);
}

export async function mockDeactivateCategory(categoryId: string): Promise<CategoryView> {
  await delay();
  const current = state();

  const index = current.categories.findIndex((category) => category.id === categoryId);
  if (index === -1) throw notFound(`Category ${categoryId} not found`);
  if (!current.categories[index].active) {
    throw businessRule(`Category '${current.categories[index].name}' is already inactive`);
  }

  // Its sub-categories are left in place: they are hidden with it, and come
  // back with it if it is ever reactivated.
  const updated: CategoryRecord = { ...current.categories[index], active: false };
  current.categories[index] = updated;
  persist();
  return toCategoryView(updated, current);
}

export async function mockCreateWarehouse(
  request: CreateWarehouseRequest,
): Promise<WarehouseView> {
  await delay();
  const current = state();

  if (nameTaken(current.warehouses.map((warehouse) => warehouse.name), request.name)) {
    throw businessRule(`A warehouse named '${request.name}' already exists for this company`);
  }

  const created: WarehouseView = {
    id: crypto.randomUUID(),
    companyId: COMPANY_ID,
    name: request.name,
    address: request.address,
    city: request.city,
  };

  current.warehouses.push(created);
  persist();
  return created;
}

export async function mockUpdateWarehouse(
  warehouseId: string,
  request: UpdateWarehouseRequest,
): Promise<WarehouseView> {
  await delay();
  const current = state();

  const index = current.warehouses.findIndex((warehouse) => warehouse.id === warehouseId);
  if (index === -1) throw notFound(`Warehouse ${warehouseId} not found`);

  const others = current.warehouses.filter((warehouse) => warehouse.id !== warehouseId);
  if (nameTaken(others.map((warehouse) => warehouse.name), request.name)) {
    throw businessRule(`A warehouse named '${request.name}' already exists for this company`);
  }

  const updated: WarehouseView = {
    ...current.warehouses[index],
    name: request.name,
    address: request.address,
    city: request.city,
  };
  current.warehouses[index] = updated;
  persist();
  return updated;
}

/**
 * Refused while a stock movement still points at the warehouse.
 *
 * StockMovement.warehouseId is an opaque UUID with no foreign key behind it, so
 * deleting the warehouse would not fail — it would quietly turn every movement
 * that used it into a record naming a place that no longer exists, and the
 * movement screen would render the raw id. Refusing is the only way that stays
 * visible.
 */
export async function mockDeleteWarehouse(warehouseId: string): Promise<void> {
  await delay();
  const current = state();

  const warehouse = current.warehouses.find((candidate) => candidate.id === warehouseId);
  if (!warehouse) throw notFound(`Warehouse ${warehouseId} not found`);

  const movements = current.stockMovements.filter(
    (movement) => movement.warehouseId === warehouseId,
  ).length;
  if (movements > 0) {
    throw businessRule(
      `'${warehouse.name}' cannot be deleted: ${movements} stock ${
        movements === 1 ? "movement refers" : "movements refer"
      } to it`,
    );
  }

  current.warehouses = current.warehouses.filter((candidate) => candidate.id !== warehouseId);
  // Its product counts go with it. Unlike a movement, a count is a fact about
  // the warehouse and nothing else, and there is no remove-product action, so
  // refusing here would leave any warehouse that ever held stock undeletable.
  current.warehouseProducts = current.warehouseProducts.filter(
    (entry) => entry.warehouseId !== warehouseId,
  );
  persist();
}

// ---------------------------------------------------------------------------
// Product variants
//
// A variant belongs to one product and carries its own name and rates. Its
// stock is not stored on it: warehouse stock is recorded per warehouse +
// product + variant, so each variant's count is separate by construction.
// ---------------------------------------------------------------------------

/** The product a variant write is for, which must exist and have hasVariants set. */
function variantParent(current: MockState, productId: string): ProductRecord {
  const product = current.products.find((candidate) => candidate.id === productId);
  if (!product) throw notFound(`Product ${productId} not found`);
  if (!product.hasVariants) {
    throw businessRule(`'${product.name}' is not set to have variants`);
  }
  return product;
}

/** Name required and unique within the product; both rates zero or more. */
function checkVariantRequest(
  request: CreateProductVariantRequest | UpdateProductVariantRequest,
  siblings: ProductVariantRecord[],
): string {
  const name = typeof request.name === "string" ? request.name.trim() : "";
  if (!name) throw businessRule("Variant name is required");
  if (name.length > 100) throw businessRule("Variant name is over 100 characters");
  if (nameTaken(siblings.map((variant) => variant.name), name)) {
    throw businessRule(`This product already has a variant named '${name}'`);
  }
  for (const [label, amount] of [
    ["Wholesale rate", request.wholesaleRate],
    ["Retail rate", request.retailRate],
  ] as const) {
    if (!Number.isFinite(amount) || amount < 0) {
      throw businessRule(`${label} must be zero or more`);
    }
  }
  return name;
}

export async function mockCreateProductVariant(
  productId: string,
  request: CreateProductVariantRequest,
): Promise<ProductVariantView> {
  await delay();
  const current = state();
  variantParent(current, productId);
  const siblings = current.productVariants.filter((variant) => variant.productId === productId);
  const name = checkVariantRequest(request, siblings);

  const created: ProductVariantRecord = {
    id: crypto.randomUUID(),
    companyId: COMPANY_ID,
    productId,
    name,
    wholesaleRate: { amount: request.wholesaleRate, currency: "INR" },
    retailRate: { amount: request.retailRate, currency: "INR" },
  };
  current.productVariants.push(created);
  persist();
  return toVariantView(created, current);
}

export async function mockUpdateProductVariant(
  productId: string,
  variantId: string,
  request: UpdateProductVariantRequest,
): Promise<ProductVariantView> {
  await delay();
  const current = state();
  variantParent(current, productId);

  const index = current.productVariants.findIndex(
    (variant) => variant.id === variantId && variant.productId === productId,
  );
  if (index === -1) throw notFound(`Variant ${variantId} not found on this product`);
  const siblings = current.productVariants.filter(
    (variant) => variant.productId === productId && variant.id !== variantId,
  );
  const name = checkVariantRequest(request, siblings);

  const updated: ProductVariantRecord = {
    ...current.productVariants[index],
    name,
    wholesaleRate: { amount: request.wholesaleRate, currency: "INR" },
    retailRate: { amount: request.retailRate, currency: "INR" },
  };
  current.productVariants[index] = updated;
  persist();
  return toVariantView(updated, current);
}

/**
 * Removes the variant and nothing else: the product and its other variants
 * are untouched. Refused while a warehouse holds stock of it, because there is
 * no way to take stock out of a warehouse, so deleting would leave counts
 * pointing at a variant that no longer exists.
 */
export async function mockDeleteProductVariant(
  productId: string,
  variantId: string,
): Promise<void> {
  await delay();
  const current = state();

  const variant = current.productVariants.find(
    (candidate) => candidate.id === variantId && candidate.productId === productId,
  );
  if (!variant) throw notFound(`Variant ${variantId} not found on this product`);

  const stock = current.warehouseProducts
    .filter((entry) => entry.variantId === variantId)
    .reduce((sum, entry) => sum + entry.quantity, 0);
  if (stock > 0) {
    throw businessRule(`'${variant.name}' cannot be deleted: ${stock} held in warehouses`);
  }
  // Stock out on rent is off the shelf but still has to come back to it, and
  // the return names the variant.
  const onRent = current.stockMovements
    .flatMap((movement) =>
      movement.lines
        .filter((line) => line.variantId === variantId)
        .map((line) => (movement.direction === "OUTWARD" ? line.quantity : -line.quantity)),
    )
    .reduce((sum, quantity) => sum + quantity, 0);
  if (onRent > 0) {
    throw businessRule(`'${variant.name}' cannot be deleted: ${onRent} out on rent`);
  }

  current.productVariants = current.productVariants.filter((candidate) => candidate.id !== variantId);
  persist();
}

function toWarehouseProductView(entry: WarehouseProduct, current: MockState): WarehouseProductView {
  const product = current.products.find((candidate) => candidate.id === entry.productId);
  const variant = entry.variantId
    ? current.productVariants.find((candidate) => candidate.id === entry.variantId)
    : undefined;
  return {
    ...entry,
    // A product is only ever deactivated, never deleted, so the lookup should
    // not miss — but the stored relationship is ids only, and a raw id is a
    // better thing to show than a blank cell if it ever does.
    productName: product?.name ?? entry.productId,
    variantName: entry.variantId ? (variant?.name ?? entry.variantId) : null,
    sku: product?.sku ?? "",
  };
}

export async function mockListWarehouseProducts(
  warehouseId: string,
): Promise<WarehouseProductView[]> {
  await delay();
  const current = state();

  if (!current.warehouses.some((warehouse) => warehouse.id === warehouseId)) {
    throw notFound(`Warehouse ${warehouseId} not found`);
  }

  return current.warehouseProducts
    .filter((entry) => entry.warehouseId === warehouseId)
    .map((entry) => toWarehouseProductView(entry, current))
    .sort(
      (a, b) =>
        a.productName.localeCompare(b.productName) ||
        (a.variantName ?? "").localeCompare(b.variantName ?? ""),
    );
}

/**
 * Adds stock of one product, or one variant of it, to one warehouse.
 *
 * There is at most one relationship per warehouse + product + variant: when
 * the warehouse already holds it, its quantity is raised by the amount added
 * rather than a second row being created. Another warehouse, or another
 * variant of the same product, is a different relationship and is never
 * touched. A product with variants is stocked by variant, so one must be named;
 * a product without them takes none.
 */
export async function mockAddProductToWarehouse(
  warehouseId: string,
  request: AddWarehouseProductRequest,
): Promise<WarehouseProductView> {
  await delay();
  const current = state();

  const warehouse = current.warehouses.find((candidate) => candidate.id === warehouseId);
  if (!warehouse) throw notFound(`Warehouse ${warehouseId} not found`);

  const product = current.products.find((candidate) => candidate.id === request.productId);
  if (!product) throw notFound(`Product ${request.productId} not found`);
  // Inactive products are hidden from the catalogue list the picker is built
  // from, so one arriving here is a stale form rather than a choice.
  if (!product.active) {
    throw businessRule(`'${product.name}' is inactive and cannot be added to a warehouse`);
  }

  const variantId = request.variantId || null;
  if (product.hasVariants) {
    if (!variantId) throw businessRule(`Choose which variant of '${product.name}' to add`);
    const variant = current.productVariants.find((candidate) => candidate.id === variantId);
    if (!variant || variant.productId !== product.id) {
      throw notFound(`Variant ${variantId} not found on '${product.name}'`);
    }
  } else if (variantId) {
    throw businessRule(`'${product.name}' has no variants`);
  }

  if (!Number.isInteger(request.quantity) || request.quantity <= 0) {
    throw businessRule("Quantity must be a whole number of at least 1");
  }

  let entry = current.warehouseProducts.find(
    (candidate) =>
      candidate.warehouseId === warehouseId &&
      candidate.productId === request.productId &&
      candidate.variantId === variantId,
  );
  if (entry) {
    entry.quantity += request.quantity;
  } else {
    entry = { warehouseId, productId: request.productId, variantId, quantity: request.quantity };
    current.warehouseProducts.push(entry);
  }

  persist();
  return toWarehouseProductView(entry, current);
}

/**
 * A truck write's fields, trimmed and checked: the same rules TruckDialog
 * applies, repeated because the mock stands in for the endpoint and the
 * endpoint cannot trust its caller. Uniqueness is checked by the callers,
 * since only they know which record to leave out.
 */
function checkTruckRequest(request: CreateTruckRequest | UpdateTruckRequest) {
  const registration =
    typeof request.registration === "string" ? request.registration.trim() : "";
  if (!registration) throw businessRule("Registration is required");
  if (registration.length > 20) {
    throw businessRule("Registration must be 20 characters or fewer");
  }
  if (!Number.isInteger(request.capacityKg) || request.capacityKg < 1) {
    throw businessRule("Capacity must be a whole number of kilograms, at least 1");
  }
  return { registration, capacityKg: request.capacityKg };
}

export async function mockCreateTruck(request: CreateTruckRequest): Promise<TruckView> {
  await delay();
  const current = state();
  const fields = checkTruckRequest(request);

  // Registrations are the one genuinely unique thing a truck has.
  if (nameTaken(current.trucks.map((truck) => truck.registration), fields.registration)) {
    throw businessRule(`Truck ${fields.registration} is already on the fleet`);
  }

  const created: TruckView = {
    id: crypto.randomUUID(),
    companyId: COMPANY_ID,
    ...fields,
  };

  current.trucks.push(created);
  persist();
  return created;
}

export async function mockUpdateTruck(
  truckId: string,
  request: UpdateTruckRequest,
): Promise<TruckView> {
  await delay();
  const current = state();

  const index = current.trucks.findIndex((truck) => truck.id === truckId);
  if (index === -1) throw notFound(`Truck ${truckId} not found`);
  const fields = checkTruckRequest(request);

  const others = current.trucks.filter((truck) => truck.id !== truckId);
  if (nameTaken(others.map((truck) => truck.registration), fields.registration)) {
    throw businessRule(`Truck ${fields.registration} is already on the fleet`);
  }

  // Id and company come from the stored record, never the request.
  const existing = current.trucks[index];
  const updated: TruckView = { id: existing.id, companyId: existing.companyId, ...fields };
  current.trucks[index] = updated;
  persist();
  return updated;
}

/** Nothing references a truck — no load, no dispatch — so this really removes it. */
export async function mockDeleteTruck(truckId: string): Promise<void> {
  await delay();
  const current = state();

  if (!current.trucks.some((truck) => truck.id === truckId)) {
    throw notFound(`Truck ${truckId} not found`);
  }

  current.trucks = current.trucks.filter((truck) => truck.id !== truckId);
  persist();
}

/**
 * The component list a bundle write carries: at least one, every product real,
 * each at most once, every quantity a whole number of at least one. A product
 * must be active to be added, but one already in the bundle may stay after it
 * is deactivated, so an unrelated edit does not force it out.
 */
function checkBundleRequest(
  request: CreateBundleRequest | UpdateBundleRequest,
  current: MockState,
  alreadyIn: string[],
): { productId: string; quantity: number }[] {
  if (!Array.isArray(request.components) || request.components.length === 0) {
    throw businessRule("A bundle must contain at least one product");
  }
  const seen = new Set<string>();
  for (const { productId, quantity } of request.components) {
    const product = current.products.find((candidate) => candidate.id === productId);
    if (!product) throw notFound(`Product ${productId} not found`);
    if (seen.has(productId)) {
      throw businessRule(`'${product.name}' is listed twice; raise its quantity instead`);
    }
    seen.add(productId);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw businessRule(`Quantity for '${product.name}' must be a whole number of at least 1`);
    }
    if (!product.active && !alreadyIn.includes(productId)) {
      throw businessRule(`'${product.name}' is inactive and cannot be added to a bundle`);
    }
  }
  if (!Number.isFinite(request.rentalRate) || request.rentalRate < 0) {
    throw businessRule("Rental rate must be zero or more");
  }
  return request.components.map(({ productId, quantity }) => ({ productId, quantity }));
}

export async function mockCreateBundle(request: CreateBundleRequest): Promise<BundleView> {
  await delay();
  const current = state();

  const name = typeof request.name === "string" ? request.name.trim() : "";
  if (!name) throw businessRule("Name is required");
  if (nameTaken(current.bundles.map((bundle) => bundle.name), name)) {
    throw businessRule(`A bundle named '${name}' already exists for this company`);
  }
  const components = checkBundleRequest(request, current, []);

  const created: BundleRecord = {
    id: crypto.randomUUID(),
    companyId: COMPANY_ID,
    name,
    components,
    rentalRate: { amount: request.rentalRate, currency: "INR" },
  };

  current.bundles.push(created);
  persist();
  return toBundleView(created, current);
}

/**
 * Replaces the name, rate and component list. A product left out of the list
 * is taken out of this bundle and nothing else: the product, and any other
 * bundle holding it, are untouched.
 */
export async function mockUpdateBundle(
  bundleId: string,
  request: UpdateBundleRequest,
): Promise<BundleView> {
  await delay();
  const current = state();

  const index = current.bundles.findIndex((bundle) => bundle.id === bundleId);
  if (index === -1) throw notFound(`Bundle ${bundleId} not found`);
  const existing = current.bundles[index];

  const name = typeof request.name === "string" ? request.name.trim() : "";
  if (!name) throw businessRule("Name is required");
  const others = current.bundles.filter((bundle) => bundle.id !== bundleId);
  if (nameTaken(others.map((bundle) => bundle.name), name)) {
    throw businessRule(`A bundle named '${name}' already exists for this company`);
  }
  const components = checkBundleRequest(
    request,
    current,
    existing.components.map((component) => component.productId),
  );

  const updated: BundleRecord = {
    ...existing,
    name,
    components,
    rentalRate: { amount: request.rentalRate, currency: "INR" },
  };
  current.bundles[index] = updated;
  persist();
  return toBundleView(updated, current);
}

// ---------------------------------------------------------------------------
// Featured collections
//
// A collection holds product ids and nothing else from a product, so a product
// can be in any number of collections and removing it from one is an edit to
// that collection's list alone. There is no delete: like a category, a
// collection is switched off instead, which keeps a seasonal one ready to
// bring back.
// ---------------------------------------------------------------------------

function toFeaturedCollectionView(
  record: FeaturedCollectionRecord,
  current: MockState,
): FeaturedCollectionView {
  const { productIds, ...rest } = record;
  return {
    ...rest,
    // Products are only ever deactivated, never deleted, so every id should
    // resolve; one that does not is skipped rather than shown as a blank chip.
    products: productIds.flatMap((productId) => {
      const product = current.products.find((candidate) => candidate.id === productId);
      if (!product) return [];
      return [
        {
          productId,
          name: product.name,
          sku: product.sku,
          imageUrl: product.media.find((item) => item.kind === "IMAGE" && item.url)?.url ?? null,
          active: product.active,
        },
      ];
    }),
  };
}

/**
 * At least one product, none twice, every one real. A product must be active
 * to be added, but one already in the collection may stay after it is
 * deactivated, so saving an unrelated edit does not force it out.
 */
function checkCollectionProducts(productIds: string[], alreadyIn: string[], current: MockState) {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    throw businessRule("A featured collection needs at least one product");
  }
  if (new Set(productIds).size !== productIds.length) {
    throw businessRule("A product can appear in a collection only once");
  }
  for (const productId of productIds) {
    const product = current.products.find((candidate) => candidate.id === productId);
    if (!product) throw notFound(`Product ${productId} not found`);
    if (!product.active && !alreadyIn.includes(productId)) {
      throw businessRule(`'${product.name}' is inactive and cannot be added to a collection`);
    }
  }
}

/** Every collection, active or not, sorted by name. */
export async function mockListFeaturedCollections(): Promise<FeaturedCollectionView[]> {
  await delay();
  const current = state();
  return [...current.featuredCollections]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((record) => toFeaturedCollectionView(record, current));
}

export async function mockCreateFeaturedCollection(
  request: CreateFeaturedCollectionRequest,
): Promise<FeaturedCollectionView> {
  await delay();
  const current = state();

  if (nameTaken(current.featuredCollections.map((c) => c.name), request.name)) {
    throw businessRule(`A featured collection named '${request.name}' already exists`);
  }
  checkCollectionProducts(request.productIds, [], current);

  const created: FeaturedCollectionRecord = {
    id: crypto.randomUUID(),
    companyId: COMPANY_ID,
    name: request.name.trim(),
    description: request.description?.trim() ? request.description.trim() : null,
    active: true,
    productIds: [...request.productIds],
  };
  current.featuredCollections.push(created);
  persist();
  return toFeaturedCollectionView(created, current);
}

export async function mockUpdateFeaturedCollection(
  collectionId: string,
  request: UpdateFeaturedCollectionRequest,
): Promise<FeaturedCollectionView> {
  await delay();
  const current = state();

  const index = current.featuredCollections.findIndex((c) => c.id === collectionId);
  if (index === -1) throw notFound(`Featured collection ${collectionId} not found`);
  const existing = current.featuredCollections[index];

  const others = current.featuredCollections.filter((c) => c.id !== collectionId);
  if (nameTaken(others.map((c) => c.name), request.name)) {
    throw businessRule(`A featured collection named '${request.name}' already exists`);
  }
  checkCollectionProducts(request.productIds, existing.productIds, current);

  const updated: FeaturedCollectionRecord = {
    ...existing,
    name: request.name.trim(),
    description: request.description?.trim() ? request.description.trim() : null,
    productIds: [...request.productIds],
  };
  current.featuredCollections[index] = updated;
  persist();
  return toFeaturedCollectionView(updated, current);
}

export async function mockSetFeaturedCollectionActive(
  collectionId: string,
  active: boolean,
): Promise<FeaturedCollectionView> {
  await delay();
  const current = state();

  const index = current.featuredCollections.findIndex((c) => c.id === collectionId);
  if (index === -1) throw notFound(`Featured collection ${collectionId} not found`);
  const existing = current.featuredCollections[index];
  if (existing.active === active) {
    throw businessRule(`'${existing.name}' is already ${active ? "active" : "inactive"}`);
  }

  const updated: FeaturedCollectionRecord = { ...existing, active };
  current.featuredCollections[index] = updated;
  persist();
  return toFeaturedCollectionView(updated, current);
}

export async function mockDeleteBundle(bundleId: string): Promise<void> {
  await delay();
  const current = state();

  if (!current.bundles.some((bundle) => bundle.id === bundleId)) {
    throw notFound(`Bundle ${bundleId} not found`);
  }

  current.bundles = current.bundles.filter((bundle) => bundle.id !== bundleId);
  persist();
}

const ACCOUNT_TYPES: CustomerView["accountType"][] = ["CUSTOMER", "EVENT_PLANNER"];

/**
 * The fields a customer write carries, trimmed and checked. The same rules the
 * form applies, repeated because the mock stands in for the endpoint and the
 * endpoint cannot trust its caller. Email is checked for uniqueness by the
 * callers, since only they know which record to leave out.
 */
function checkCustomerRequest(request: CreateCustomerRequest | UpdateCustomerRequest) {
  const fullName = typeof request.fullName === "string" ? request.fullName.trim() : "";
  const email = typeof request.email === "string" ? request.email.trim() : "";
  const phone = typeof request.phone === "string" ? request.phone.trim() : "";

  if (!fullName) throw businessRule("Full name is required");
  if (fullName.length > 200) throw businessRule("Full name is over 200 characters");
  if (!email) throw businessRule("Email is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw businessRule(`'${email}' is not a valid email address`);
  }
  if (phone && (phone.length > 30 || !isValidPhone(phone))) {
    throw businessRule(`'${phone}' is not a valid phone number`);
  }
  if (!ACCOUNT_TYPES.includes(request.accountType)) {
    throw businessRule("Account type must be Customer or Event planner");
  }
  return { fullName, email, phone: phone || null, accountType: request.accountType };
}

/**
 * One customer by id — the lookup a quotation or order will make to resolve
 * the customerId it stores. 404 for an id that was never issued: customers
 * are never deleted, so an id that was valid once stays valid.
 */
export async function mockGetCustomer(customerId: string): Promise<CustomerView> {
  await delay();
  const customer = state().customers.find((candidate) => candidate.id === customerId);
  if (!customer) throw notFound(`Customer ${customerId} not found`);
  return customer;
}

export async function mockCreateCustomer(
  request: CreateCustomerRequest,
): Promise<CustomerView> {
  await delay();
  const current = state();
  const fields = checkCustomerRequest(request);

  // Email is the storefront account's natural key — it is what login uses.
  if (nameTaken(current.customers.map((customer) => customer.email), fields.email)) {
    throw businessRule(`An account already exists for ${fields.email}`);
  }

  const created: CustomerView = { id: crypto.randomUUID(), ...fields };

  current.customers.push(created);
  persist();
  return created;
}

export async function mockUpdateCustomer(
  customerId: string,
  request: UpdateCustomerRequest,
): Promise<CustomerView> {
  await delay();
  const current = state();

  const index = current.customers.findIndex((customer) => customer.id === customerId);
  if (index === -1) throw notFound(`Customer ${customerId} not found`);
  const fields = checkCustomerRequest(request);

  const others = current.customers.filter((customer) => customer.id !== customerId);
  if (nameTaken(others.map((customer) => customer.email), fields.email)) {
    throw businessRule(`An account already exists for ${fields.email}`);
  }

  // The id is carried over, never taken from the request: quotations, orders,
  // deposits and credit notes all point at it, so it must outlive every edit.
  const updated: CustomerView = { id: current.customers[index].id, ...fields };
  current.customers[index] = updated;
  persist();
  return updated;
}

// ---------------------------------------------------------------------------
// Quotations and orders
// ---------------------------------------------------------------------------

export async function mockGetQuotation(quotationId: string): Promise<QuotationView> {
  await delay();
  const found = state().quotations.find((quotation) => quotation.id === quotationId);
  if (!found) throw notFound(`Quotation ${quotationId} not found`);
  return found;
}

/**
 * Stands in for QuotationService#createQuotation.
 *
 * The pricing is the backend's own, copied deliberately rather than
 * approximated: line total is rate x quantity x days, with the product's retail
 * rate as the rate. The security deposit is no longer priced at all: products
 * stopped carrying one, so it is the single amount the request names for the
 * booking as a whole. QuotationItem#priced carries a TODO saying the legacy slab
 * and seasonal rules live in unread stored procedures, so this is the simplest
 * defensible formula on both sides — and wrong in the same way if it is wrong.
 *
 * The status is always DRAFT and the source is always "admin-ui": the
 * controller supplies both, so neither is the client's to choose.
 */
/** The customer a quotation is for: required, and it must exist. */
function quotationCustomer(current: MockState, customerId: string | undefined): CustomerView {
  if (!customerId) throw businessRule("Choose a customer for the quotation");
  const customer = current.customers.find((candidate) => candidate.id === customerId);
  if (!customer) throw notFound(`Customer ${customerId} not found`);
  return customer;
}

/**
 * What create and update both check before pricing anything: at least one
 * line, whole-number quantities and days of at least 1, a deposit of zero or
 * more, and an event date that is a real yyyy-MM-dd date if one is given.
 * Returns the event date to store.
 */
function checkQuotationRequest(request: {
  lines: { quantity: number; rentalDays: number }[];
  securityDeposit: number;
  eventDate?: string;
}): string | null {
  if (!Array.isArray(request.lines) || request.lines.length === 0) {
    throw businessRule("A quotation must have at least one line");
  }
  for (const line of request.lines) {
    if (
      !Number.isInteger(line.quantity) ||
      !Number.isInteger(line.rentalDays) ||
      line.quantity < 1 ||
      line.rentalDays < 1
    ) {
      throw businessRule("Quantity and rental days must both be whole numbers of at least 1");
    }
  }
  if (!Number.isFinite(request.securityDeposit) || request.securityDeposit < 0) {
    throw businessRule("Security deposit must be zero or more");
  }
  const eventDate = request.eventDate?.trim() ?? "";
  if (eventDate && !isIsoDate(eventDate)) {
    throw businessRule(`'${eventDate}' is not a valid event date`);
  }
  return eventDate || null;
}

/**
 * The real service calls masterData.getProduct, which throws when the id
 * belongs to another company — that is what stops a forged product id crossing
 * tenants, so an unknown id is a failure here too rather than a skipped line.
 */
function quotationProduct(current: MockState, productId: string): ProductRecord {
  const product = current.products.find((candidate) => candidate.id === productId);
  if (!product) throw notFound(`Product ${productId} not found`);
  return product;
}

/** One priced line: the stored per-day rate times quantity times days. */
function pricedLine(
  id: string,
  product: { id: string; name: string },
  rate: number,
  quantity: number,
  rentalDays: number,
): QuotationLineView {
  return {
    id,
    productId: product.id,
    productName: product.name,
    quantity,
    rentalDays,
    unitRatePerDay: { amount: rate, currency: "INR" },
    lineTotal: { amount: rate * quantity * rentalDays, currency: "INR" },
  };
}

export async function mockCreateQuotation(
  request: CreateQuotationRequest,
): Promise<QuotationView> {
  await delay();
  const current = state();

  const customer = quotationCustomer(current, request.customerId);
  const eventDate = checkQuotationRequest(request);

  const id = crypto.randomUUID();
  const lines = request.lines.map((line, index) => {
    const product = quotationProduct(current, line.productId);
    return pricedLine(
      `${id}-L${index + 1}`,
      product,
      Number(product.retailRate.amount),
      line.quantity,
      line.rentalDays,
    );
  });

  const created: QuotationView = {
    id,
    companyId: COMPANY_ID,
    quotationNumber: nextQuotationNumber(current),
    customerId: customer.id,
    // Copies, taken now and kept: the quotation records who it was sent to.
    // They come from the customer record rather than the request, so the copy
    // always matches the id beside it.
    customerName: customer.fullName,
    customerEmail: customer.email,
    eventDate,
    status: "DRAFT",
    totalAmount: {
      amount: lines.reduce((sum, line) => sum + Number(line.lineTotal.amount), 0),
      currency: "INR",
    },
    totalSecurityDeposit: { amount: request.securityDeposit, currency: "INR" },
    sourceReference: "admin-ui",
    lines,
  };

  current.quotations.push(created);
  persist();
  return created;
}

/**
 * Edits a quotation that has not been converted. There is no update endpoint
 * on the real controller, so this is this UI's proposal, built on the rules
 * the quotation already has:
 *
 * - Pricing is a snapshot. A line that already exists keeps the per-day rate
 *   it was priced at, and its total is that rate x the new quantity x days; a
 *   later change to the product's retail rate does not reach it. Only a new
 *   line is priced from today's retail rate.
 * - A converted quotation is refused: its order was copied from it, and
 *   editing one would leave the two disagreeing. No other status rule is
 *   applied, because the backend has none to mirror.
 * - The customer's name and email copies are kept while the customer stays
 *   the same, and re-taken only when the customer is changed.
 */
export async function mockUpdateQuotation(
  quotationId: string,
  request: UpdateQuotationRequest,
): Promise<QuotationView> {
  await delay();
  const current = state();

  const index = current.quotations.findIndex((quotation) => quotation.id === quotationId);
  if (index === -1) throw notFound(`Quotation ${quotationId} not found`);
  const existing = current.quotations[index];
  if (
    existing.status === "CONVERTED" ||
    current.orders.some((order) => order.quotationId === quotationId)
  ) {
    throw businessRule(
      `Quotation ${existing.quotationNumber} has been converted to an order and can no longer be edited`,
    );
  }

  const customer = quotationCustomer(current, request.customerId);
  const eventDate = checkQuotationRequest(request);

  // New lines continue the numbering, so a line id is never reused.
  let nextLine = existing.lines.reduce((max, line) => {
    const tail = /-L(\d+)$/.exec(line.id);
    return tail ? Math.max(max, Number(tail[1])) : max;
  }, 0);

  const seen = new Set<string>();
  const lines = request.lines.map((line) => {
    if (line.lineId) {
      if (seen.has(line.lineId)) throw businessRule(`Line ${line.lineId} is listed twice`);
      seen.add(line.lineId);
      const stored = existing.lines.find((candidate) => candidate.id === line.lineId);
      if (!stored) throw notFound(`Line ${line.lineId} not found on this quotation`);
      if (stored.productId !== line.productId) {
        throw businessRule(
          "An existing line's product cannot change; remove the line and add a new one",
        );
      }
      return pricedLine(
        stored.id,
        { id: stored.productId, name: stored.productName },
        Number(stored.unitRatePerDay.amount),
        line.quantity,
        line.rentalDays,
      );
    }
    const product = quotationProduct(current, line.productId);
    nextLine += 1;
    return pricedLine(
      `${existing.id}-L${nextLine}`,
      product,
      Number(product.retailRate.amount),
      line.quantity,
      line.rentalDays,
    );
  });

  const sameCustomer = existing.customerId === customer.id;
  const updated: QuotationView = {
    ...existing,
    customerId: customer.id,
    customerName: sameCustomer ? existing.customerName : customer.fullName,
    customerEmail: sameCustomer ? existing.customerEmail : customer.email,
    eventDate,
    totalAmount: {
      amount: lines.reduce((sum, line) => sum + Number(line.lineTotal.amount), 0),
      currency: "INR",
    },
    totalSecurityDeposit: { amount: request.securityDeposit, currency: "INR" },
    lines,
  };

  // Replaced rather than mutated: see the note in mockCreateOrderFromQuotation.
  current.quotations[index] = updated;
  persist();
  return updated;
}

/**
 * The real number comes from ConfigService's per-company sequence and looks
 * like QT-000001 — a prefix and a zero-padded counter. The seed predates that
 * and numbers its quotations QT-<year>-<n>, so this continues the seed's scheme
 * rather than introducing a second format halfway down the same list. The
 * number is cosmetic in the mock either way; what matters is that it is unique
 * and looks like the ones beside it.
 */
function nextQuotationNumber(current: MockState): string {
  const highest = current.quotations.reduce((max, quotation) => {
    const tail = /(\d+)$/.exec(quotation.quotationNumber);
    const value = tail ? Number(tail[1]) : 0;
    return value > max ? value : max;
  }, 0);
  return `QT-2026-${highest + 1}`;
}

export async function mockGetOrder(orderId: string): Promise<OrderView> {
  await delay();
  const found = state().orders.find((order) => order.id === orderId);
  if (!found) throw notFound(`Order ${orderId} not found`);
  return found;
}

/**
 * Stands in for OrderMgmtService#createOrderFromQuotation.
 *
 * An order is a copy, not a repricing: lines, totals, customer and source all
 * come across from the quotation exactly as the real service copies them, and
 * the order carries no per-day rate because SalesOrderItem does not store one.
 *
 * Both of the real rules are here. One order per quotation is checked against
 * the orders already held; markConverted's own refusal is checked separately,
 * because the real service runs both and the second is what makes the
 * conversion terminal even if the first were ever bypassed.
 *
 * The order starts CONFIRMED, and its security deposit is opened as a HELD
 * ledger in the same write — the one place a deposit is ever created, so an
 * order has exactly one.
 */
export async function mockCreateOrderFromQuotation(quotationId: string): Promise<OrderView> {
  await delay();
  const current = state();

  const index = current.quotations.findIndex((quotation) => quotation.id === quotationId);
  if (index === -1) throw notFound(`Quotation ${quotationId} not found`);
  const quotation = current.quotations[index];

  if (current.orders.some((order) => order.quotationId === quotationId)) {
    throw businessRule(`An order already exists for quotation ${quotation.quotationNumber}`);
  }

  if (quotation.status === "CONVERTED") {
    throw businessRule(
      `Quotation ${quotation.quotationNumber} has already been converted to an order`,
    );
  }

  const id = crypto.randomUUID();

  const created: OrderView = {
    id,
    companyId: COMPANY_ID,
    orderNumber: nextOrderNumber(current),
    quotationId: quotation.id,
    customerId: quotation.customerId,
    customerName: quotation.customerName,
    customerEmail: quotation.customerEmail,
    eventDate: quotation.eventDate,
    status: "CONFIRMED",
    totalAmount: quotation.totalAmount,
    securityDeposit: quotation.totalSecurityDeposit,
    sourceReference: quotation.sourceReference,
    lines: quotation.lines.map((line) => ({
      id: `${id}-${line.id}`,
      productId: line.productId,
      productName: line.productName,
      quantity: line.quantity,
      rentalDays: line.rentalDays,
      lineTotal: line.lineTotal,
    })),
  };

  current.orders.push(created);

  // Unreachable for a fresh id, but the one-deposit-per-order rule is the
  // ledger's, so it is checked here rather than assumed.
  if (current.deposits.some((deposit) => deposit.orderId === id)) {
    throw businessRule(`A deposit is already held against ${created.orderNumber}`);
  }
  current.deposits.push({
    id: crypto.randomUUID(),
    companyId: COMPANY_ID,
    orderId: id,
    accountId: quotation.customerId ?? "",
    amountHeld: {
      amount: Number(quotation.totalSecurityDeposit.amount),
      currency: quotation.totalSecurityDeposit.currency,
    },
    amountRefunded: { amount: 0, currency: quotation.totalSecurityDeposit.currency },
    amountForfeited: { amount: 0, currency: quotation.totalSecurityDeposit.currency },
    status: "HELD",
    heldAt: new Date().toISOString(),
  });

  // Replaced rather than mutated in place. The query cache holds the very
  // object this array holds — mockGetQuotation hands back the stored record
  // rather than a copy — so editing it would change what a screen is showing
  // without changing the reference React compares, and the quotation would sit
  // there reading SENT until something else forced a render.
  current.quotations[index] = { ...quotation, status: "CONVERTED" };

  persist();
  return created;
}

/**
 * As with quotation numbers, the real sequence is ConfigService's prefix plus a
 * zero-padded counter — SO-000001 for an order. The seed numbers its orders
 * ORD-<year>-<n>, so this continues that rather than mixing two formats.
 */
function nextOrderNumber(current: MockState): string {
  const highest = current.orders.reduce((max, order) => {
    const tail = /(\d+)$/.exec(order.orderNumber);
    const value = tail ? Number(tail[1]) : 0;
    return value > max ? value : max;
  }, 0);
  return `ORD-2026-${String(highest + 1).padStart(4, "0")}`;
}

function requireOrderIndex(current: MockState, orderId: string): number {
  const index = current.orders.findIndex((order) => order.id === orderId);
  if (index === -1) throw notFound(`Order ${orderId} not found`);
  return index;
}

/**
 * CONFIRMED → CANCELLED, and from nowhere else: once anything has been
 * dispatched the order has to come back instead. Nothing moves in stock,
 * because a confirmed order has sent nothing. A deposit still HELD is moved to
 * REFUND_PENDING, the same step "Request refund" takes, so it is paid back
 * through the deposits screen like any other; one already settling is left be.
 */
export async function mockCancelOrder(orderId: string): Promise<OrderView> {
  await delay();
  const current = state();
  const index = requireOrderIndex(current, orderId);
  const order = current.orders[index];

  if (order.status !== "CONFIRMED") {
    throw businessRule(
      `${order.orderNumber} is ${order.status}; only a confirmed order can be cancelled`,
    );
  }

  const deposit = current.deposits.find((candidate) => candidate.orderId === orderId);
  if (deposit?.status === "HELD") {
    updateDeposit(deposit, (next) =>
      transition(next, "REFUND_PENDING", `Order ${order.orderNumber} cancelled`),
    );
  }

  const cancelled: OrderView = { ...order, status: "CANCELLED" };
  current.orders[index] = cancelled;
  persist();
  return cancelled;
}

/** RETURNED → COMPLETED, once the deposit is REFUNDED or FORFEITED. */
export async function mockCompleteOrder(orderId: string): Promise<OrderView> {
  await delay();
  const current = state();
  const index = requireOrderIndex(current, orderId);
  const order = current.orders[index];

  if (order.status !== "RETURNED") {
    throw businessRule(
      `${order.orderNumber} is ${order.status}; only a returned order can be completed`,
    );
  }

  const deposit = current.deposits.find((candidate) => candidate.orderId === orderId);
  if (!deposit || (deposit.status !== "REFUNDED" && deposit.status !== "FORFEITED")) {
    throw businessRule(
      `The deposit on ${order.orderNumber} is ${
        deposit ? deposit.status.replace("_", " ").toLowerCase() : "missing"
      }; it must be refunded or forfeited before the order can be completed`,
    );
  }

  const completed: OrderView = { ...order, status: "COMPLETED" };
  current.orders[index] = completed;
  persist();
  return completed;
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export async function mockListStockMovementsByOrder(
  orderId: string,
): Promise<StockMovementView[]> {
  await delay();
  // findByCompanyIdAndOrderIdOrderByMovedOnDesc — newest first, and an order
  // with no movements is an empty list rather than a 404.
  return state()
    .stockMovements.filter((movement) => movement.orderId === orderId)
    .sort((a, b) => Date.parse(b.movedOn) - Date.parse(a.movedOn));
}

/** One warehouse + product + variant — the unit stock is held and moved in. */
const stockKey = (warehouseId: string, productId: string, variantId: string | null) =>
  `${warehouseId}|${productId}|${variantId ?? ""}`;

/**
 * What has moved against one order so far: how much of each product has been
 * dispatched in total, and how much of each warehouse + product + variant is
 * still out (outward minus inward).
 */
function orderMovementTotals(current: MockState, orderId: string) {
  const dispatched = new Map<string, number>();
  const outstanding = new Map<string, number>();
  for (const movement of current.stockMovements) {
    if (movement.orderId !== orderId) continue;
    const sign = movement.direction === "OUTWARD" ? 1 : -1;
    for (const line of movement.lines) {
      if (movement.direction === "OUTWARD") {
        dispatched.set(line.productId, (dispatched.get(line.productId) ?? 0) + line.quantity);
      }
      const key = stockKey(movement.warehouseId ?? "", line.productId, line.variantId ?? null);
      outstanding.set(key, (outstanding.get(key) ?? 0) + sign * line.quantity);
    }
  }
  return { dispatched, outstanding };
}

/**
 * Stands in for InventoryService#recordMovement, with the rules the order flow
 * needs on top of the real ones (at least one line, an order that exists,
 * every quantity at least 1).
 *
 * A movement is what moves an order along — nothing sets its status directly:
 * - OUTWARD takes stock off the named warehouse's shelf and puts it on rent.
 *   The order must be CONFIRMED, or DISPATCHED with some of it still to send;
 *   each product may not go out beyond what was ordered, and each warehouse +
 *   product + variant may not go below zero. The first one makes the order
 *   DISPATCHED.
 * - INWARD puts stock back on the shelf of the warehouse it left. The order
 *   must be DISPATCHED, and nothing can come back to a warehouse that did not
 *   send it. The one that brings the last of the order's goods back makes it
 *   RETURNED.
 * Lines must be products on the order; one with variants names which variant
 * moved, since stock is held per variant. Everything is checked before
 * anything is written, so a refused movement changes nothing.
 */
export async function mockRecordStockMovement(
  request: RecordStockMovementRequest,
): Promise<StockMovementView> {
  await delay();
  const current = state();

  const orderIndex = current.orders.findIndex((order) => order.id === request.orderId);
  if (orderIndex === -1) throw notFound(`Order ${request.orderId} not found`);
  const order = current.orders[orderIndex];

  const outward = request.direction === "OUTWARD";
  if (!outward && request.direction !== "INWARD") {
    throw businessRule("Direction must be OUTWARD or INWARD");
  }
  if (outward && order.status !== "CONFIRMED" && order.status !== "DISPATCHED") {
    throw businessRule(`${order.orderNumber} is ${order.status} and cannot be dispatched`);
  }
  if (!outward && order.status !== "DISPATCHED") {
    throw businessRule(
      `${order.orderNumber} is ${order.status}; only a dispatched order can take a return`,
    );
  }

  const warehouseId = typeof request.warehouseId === "string" ? request.warehouseId.trim() : "";
  if (!warehouseId) throw businessRule("Choose the warehouse the goods move from or to");
  const warehouse = current.warehouses.find((candidate) => candidate.id === warehouseId);
  if (!warehouse) throw notFound(`Warehouse ${warehouseId} not found`);

  // The controller substitutes today when movedOn is absent, so this does too
  // rather than storing a null the view would have to render as "unknown".
  const movedOn = request.movedOn?.trim()
    ? request.movedOn.trim()
    : new Date().toISOString().slice(0, 10);
  if (!isIsoDate(movedOn)) throw businessRule(`'${movedOn}' is not a valid date`);

  if (!Array.isArray(request.lines) || request.lines.length === 0) {
    throw businessRule("A stock movement must have at least one line");
  }

  const ordered = new Map<string, number>();
  for (const line of order.lines) {
    ordered.set(line.productId, (ordered.get(line.productId) ?? 0) + line.quantity);
  }
  const { dispatched, outstanding } = orderMovementTotals(current, order.id);

  const seen = new Set<string>();
  const requested = new Map<string, number>();
  const lines = request.lines.map((line) => {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw businessRule("Movement quantity must be a whole number of at least 1");
    }
    const product = current.products.find((candidate) => candidate.id === line.productId);
    if (!product) throw notFound(`Product ${line.productId} not found`);
    if (!ordered.has(product.id)) {
      throw businessRule(`'${product.name}' is not on ${order.orderNumber}`);
    }

    const variantId = line.variantId || null;
    let label = product.name;
    if (product.hasVariants) {
      if (!variantId) throw businessRule(`Choose which variant of '${product.name}' moves`);
      const variant = current.productVariants.find(
        (candidate) => candidate.id === variantId && candidate.productId === product.id,
      );
      if (!variant) throw notFound(`Variant ${variantId} not found on '${product.name}'`);
      label = `${product.name} (${variant.name})`;
    } else if (variantId) {
      throw businessRule(`'${product.name}' has no variants`);
    }

    const key = stockKey(warehouse.id, product.id, variantId);
    if (seen.has(key)) throw businessRule(`'${label}' is listed twice`);
    seen.add(key);
    requested.set(product.id, (requested.get(product.id) ?? 0) + line.quantity);

    const entry = current.warehouseProducts.find(
      (candidate) =>
        candidate.warehouseId === warehouse.id &&
        candidate.productId === product.id &&
        candidate.variantId === variantId,
    );
    return { productId: product.id, variantId, quantity: line.quantity, entry, key, label };
  });

  // What the order allows comes before what the warehouse holds: "already sent
  // in full" says more than "none on this shelf".
  if (outward) {
    for (const [productId, quantity] of requested) {
      const left = (ordered.get(productId) ?? 0) - (dispatched.get(productId) ?? 0);
      if (quantity > left) {
        const name = current.products.find((candidate) => candidate.id === productId)?.name;
        throw businessRule(
          left === 0
            ? `'${name}' has already been dispatched in full on ${order.orderNumber}`
            : `Only ${left} of '${name}' left to dispatch on ${order.orderNumber}; ${quantity} requested`,
        );
      }
    }
  }

  for (const line of lines) {
    if (outward && line.quantity > (line.entry?.quantity ?? 0)) {
      throw businessRule(
        `Only ${line.entry?.quantity ?? 0} of '${line.label}' in stock at ${warehouse.name}; ${line.quantity} requested`,
      );
    }
    const out = outstanding.get(line.key) ?? 0;
    if (!outward && line.quantity > out) {
      throw businessRule(
        `Only ${out} of '${line.label}' ${out === 1 ? "is" : "are"} out from ${warehouse.name} on ${order.orderNumber}; ${line.quantity} cannot come back`,
      );
    }
  }

  // Every check has passed; from here on it only writes.
  for (const line of lines) {
    if (line.entry) {
      // For an outward line the entry is there and holds enough, or the stock
      // check above would have thrown.
      line.entry.quantity += outward ? -line.quantity : line.quantity;
    } else {
      current.warehouseProducts.push({
        warehouseId: warehouse.id,
        productId: line.productId,
        variantId: line.variantId,
        quantity: line.quantity,
      });
    }
  }

  const id = crypto.randomUUID();
  const created: StockMovementView = {
    id,
    companyId: COMPANY_ID,
    orderId: order.id,
    movementNumber: nextMovementNumber(current),
    direction: request.direction,
    movedOn,
    warehouseId: warehouse.id,
    remarks: request.remarks?.trim() ? request.remarks.trim() : null,
    lines: lines.map((line, index) => ({
      id: `${id}-L${index + 1}`,
      productId: line.productId,
      variantId: line.variantId,
      quantity: line.quantity,
    })),
  };
  current.stockMovements.push(created);

  let status = order.status;
  if (outward) {
    status = "DISPATCHED";
  } else {
    const stillOut = [...orderMovementTotals(current, order.id).outstanding.values()].reduce(
      (sum, quantity) => sum + quantity,
      0,
    );
    if (stillOut === 0) status = "RETURNED";
  }
  // Replaced rather than mutated, for the same reason conversion replaces the
  // quotation: the order screen is holding this very object.
  if (status !== order.status) current.orders[orderIndex] = { ...order, status };

  persist();
  return created;
}

/** SM-<year>-<n>, continuing the seed; the real one is SM-000001 from the
 *  per-company document sequence. */
function nextMovementNumber(current: MockState): string {
  const highest = current.stockMovements.reduce((max, movement) => {
    const tail = /(\d+)$/.exec(movement.movementNumber);
    const value = tail ? Number(tail[1]) : 0;
    return value > max ? value : max;
  }, 0);
  return `SM-2026-${String(highest + 1).padStart(4, "0")}`;
}

/**
 * There is no availability endpoint to mock. In stock is the warehouse counts,
 * which movements keep current; on rent is outward minus inward across every
 * movement. Both are per product, summed over warehouses and variants.
 */
export async function mockDeriveAvailability(): Promise<AvailabilityRow[]> {
  await delay();
  const current = state();
  const onRent = new Map<string, number>();
  const inStock = new Map<string, number>();

  for (const movement of current.stockMovements) {
    const sign = movement.direction === "OUTWARD" ? 1 : -1;
    for (const line of movement.lines) {
      onRent.set(line.productId, (onRent.get(line.productId) ?? 0) + sign * line.quantity);
    }
  }
  for (const entry of current.warehouseProducts) {
    inStock.set(entry.productId, (inStock.get(entry.productId) ?? 0) + entry.quantity);
  }

  return current.products
    .filter((product) => product.active)
    .map((product) => ({
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      inStock: inStock.get(product.id) ?? 0,
      onRent: onRent.get(product.id) ?? 0,
    }))
    .sort((a, b) => b.onRent - a.onRent || a.productName.localeCompare(b.productName));
}

// ---------------------------------------------------------------------------
// Credit notes
// ---------------------------------------------------------------------------

export async function mockListCreditNotesByCustomer(
  customerId: string,
): Promise<CreditNoteView[]> {
  await delay();
  return state()
    .creditNotes.filter((note) => note.customerId === customerId)
    .sort((a, b) => Date.parse(b.issuedOn) - Date.parse(a.issuedOn));
}

/** Sums amount - appliedAmount across LIVE_STATUSES only, as the service does. */
export async function mockGetCustomerCreditBalance(
  customerId: string,
): Promise<CustomerCreditBalance> {
  await delay();
  const available = state()
    .creditNotes.filter(
      (note) =>
        note.customerId === customerId &&
        (note.status === "ISSUED" || note.status === "REVERSED"),
    )
    .reduce((sum, note) => sum + Number(note.amount.amount) - Number(note.appliedAmount.amount), 0);

  return { availableCredit: { amount: available, currency: "INR" } };
}

export async function mockIssueCreditNote(
  request: IssueCreditNoteRequest,
): Promise<CreditNoteView> {
  await delay();
  const current = state();

  if (!(request.amount > 0)) {
    throw businessRule("A credit note amount must be positive");
  }

  const created: CreditNoteView = {
    id: crypto.randomUUID(),
    companyId: COMPANY_ID,
    creditNoteNumber: `CN-2026-${String(current.creditNotes.length + 20).padStart(4, "0")}`,
    customerId: request.customerId,
    againstOrderId: request.againstOrderId?.trim() ? request.againstOrderId : null,
    amount: { amount: request.amount, currency: "INR" },
    appliedAmount: { amount: 0, currency: "INR" },
    status: "ISSUED",
    issuedOn: new Date().toISOString().slice(0, 10),
    reason: request.reason?.trim() ? request.reason : null,
  };

  current.creditNotes.push(created);
  persist();
  return created;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/** Built field by field rather than by omitting `password`, so anything added
 *  to MockUser later has to be opted in rather than leaking by default. */
const toUserView = (user: MockUser): AdminUserView => ({
  id: user.id,
  companyId: user.companyId,
  username: user.username,
  email: user.email,
  role: user.role,
  active: user.active,
});

export async function mockListUsers(): Promise<AdminUserView[]> {
  await delay();
  return state().users.map(toUserView);
}

export async function mockCreateUser(request: CreateAdminUserRequest): Promise<AdminUserView> {
  await delay();
  const current = state();

  if (current.users.some((u) => u.username.toLowerCase() === request.username.toLowerCase())) {
    throw businessRule(`A user named '${request.username}' already exists for this company`);
  }

  const created: MockUser = {
    id: crypto.randomUUID(),
    companyId: COMPANY_ID,
    username: request.username,
    email: request.email,
    role: request.role,
    active: true,
    password: request.password,
  };

  current.users.push(created);
  persist();
  return toUserView(created);
}

function requireUser(userId: string): MockUser {
  const found = state().users.find((user) => user.id === userId);
  if (!found) throw notFound(`Admin user ${userId} not found`);
  return found;
}

function requireAnotherAdminRemains(userId: string, action: string): void {
  const others = state().users.filter(
    (user) => user.active && user.role === "ADMIN" && user.id !== userId,
  );
  if (others.length === 0) {
    throw businessRule(
      `Cannot ${action} the only active ADMIN for this company; create another first`,
    );
  }
}

export async function mockChangeUserRole(userId: string, role: Role): Promise<AdminUserView> {
  await delay();
  const acting = caller();
  const user = requireUser(userId);

  if (user.role === "ADMIN" && role !== "ADMIN") requireAnotherAdminRemains(userId, "demote");
  if (userId === acting.userId && role !== "ADMIN") {
    throw businessRule("You cannot change your own role; ask another administrator");
  }

  user.role = role;
  persist();
  return toUserView(user);
}

export async function mockDeactivateUser(userId: string): Promise<AdminUserView> {
  await delay();
  const acting = caller();

  if (userId === acting.userId) throw businessRule("You cannot deactivate your own account");

  const user = requireUser(userId);
  if (user.role === "ADMIN") requireAnotherAdminRemains(userId, "deactivate");

  user.active = false;
  persist();
  return toUserView(user);
}

export async function mockResetUserPassword(userId: string, password: string): Promise<void> {
  await delay();
  requireUser(userId).password = password;
  persist();
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

export async function mockGetDashboard(): Promise<AdminDashboardView> {
  await delay();
  const stored = state().quotations;

  /**
   * The counts have two sources and neither is sufficient alone.
   *
   * SEED_QUOTATIONS is a long list of id/number/status rows that exists only to
   * give the dashboard plausible volume; SEED_QUOTATION_DETAILS is the handful
   * of full records the lookup screen can open. Editing a quotation writes to
   * the second, so counting only the first would miss it, and counting only the
   * second would show four quotations where the business has eighty-seven.
   *
   * So: every seeded row counts, at whatever status the stored copy has reached
   * if there is one, plus every quotation that was created here. Converting a
   * seeded quotation moves it from draft to converted; raising a new one adds
   * to draft. Both are what the real endpoint, counting rows in one table,
   * would do.
   */
  const countOf = (status: string) => {
    const seeded = SEED_QUOTATIONS.filter((seed) => {
      const current = stored.find((quotation) => quotation.id === seed.id);
      return (current?.status ?? seed.status) === status;
    }).length;

    const created = stored.filter(
      (quotation) =>
        quotation.status === status &&
        !SEED_QUOTATIONS.some((seed) => seed.id === quotation.id),
    ).length;

    return seeded + created;
  };

  // Orders converted in this session are counted the same way. Value is read
  // off the full order wherever the mock holds one, so a seeded order counts
  // at the total its detail screen shows; the stub total covers the rest.
  const orders = state().orders;
  const addedOrders = orders.filter(
    (order) => !SEED_ORDERS.some((seed) => seed.id === order.id),
  );
  const seededValue = (seed: (typeof SEED_ORDERS)[number]) => {
    const detail = orders.find((order) => order.id === seed.id);
    return detail ? Number(detail.totalAmount.amount) : seed.total;
  };

  return {
    draftQuotations: countOf("DRAFT"),
    sentQuotations: countOf("SENT"),
    acceptedQuotations: countOf("ACCEPTED"),
    convertedQuotations: countOf("CONVERTED"),
    totalOrders: SEED_ORDERS.length + addedOrders.length,
    totalOrderValue: {
      amount:
        SEED_ORDERS.reduce((sum, order) => sum + seededValue(order), 0) +
        addedOrders.reduce((sum, order) => sum + Number(order.totalAmount.amount), 0),
      currency: "INR",
    },
  };
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

const byNewest = (a: NotificationLogView, b: NotificationLogView) =>
  Date.parse(b.attemptedAt) - Date.parse(a.attemptedAt);

export async function mockListNotifications(limit: number): Promise<NotificationLogView[]> {
  await delay();
  // MAX_LIMIT is 200 on the real service, and it clamps rather than rejects.
  const capped = Math.min(Math.max(limit, 1), 200);
  return [...state().notifications].sort(byNewest).slice(0, capped);
}

export async function mockListNotificationsBySubject(
  subjectReference: string,
): Promise<NotificationLogView[]> {
  await delay();
  return state()
    .notifications.filter((row) => row.subjectReference === subjectReference)
    .sort(byNewest);
}

// ---------------------------------------------------------------------------
// Deposits
// ---------------------------------------------------------------------------

function requireDeposit(orderId: string): DepositLedgerView {
  const found = state().deposits.find((deposit) => deposit.orderId === orderId);
  if (!found) throw notFound(`No deposit held against order ${orderId}`);
  return found;
}

export async function mockGetDepositByOrder(orderId: string): Promise<DepositLedgerView> {
  await delay();
  return requireDeposit(orderId);
}

function transition(
  deposit: DepositLedgerView,
  next: DepositLedgerView["status"],
  reason?: string,
): void {
  if (!ALLOWED_NEXT[deposit.status].includes(next)) {
    throw businessRule(
      `Cannot move deposit for order ${deposit.orderId} from ${deposit.status} to ${next}`,
    );
  }
  deposit.status = next;
  if (reason) deposit.reason = reason;
  if (next === "REFUNDED" || next === "FORFEITED") deposit.settledAt = new Date().toISOString();
}

/**
 * Applies a change to a copy and stores the copy. The order and deposit
 * screens both hold the stored object in their query caches, so mutating it in
 * place would change what they show without giving React a new reference.
 * A transition that throws leaves the stored ledger untouched.
 */
function updateDeposit(
  deposit: DepositLedgerView,
  change: (next: DepositLedgerView) => void,
): DepositLedgerView {
  const next = { ...deposit };
  change(next);
  const deposits = state().deposits;
  deposits[deposits.indexOf(deposit)] = next;
  return next;
}

export async function mockRequestRefund(orderId: string, reason?: string) {
  await delay();
  const updated = updateDeposit(requireDeposit(orderId), (deposit) =>
    transition(deposit, "REFUND_PENDING", reason),
  );
  persist();
  return updated;
}

export async function mockConfirmRefunded(orderId: string, amount: number) {
  await delay();
  const updated = updateDeposit(requireDeposit(orderId), (deposit) => {
    transition(deposit, "REFUNDED");
    // Faithful to the backend: recordRefund does NOT check the amount against
    // what is held, so an over-refund is accepted here too. The UI warns; this
    // does not, on purpose — otherwise the mock would hide the real gap.
    deposit.amountRefunded = { amount, currency: "INR" };
  });
  persist();
  return updated;
}

export async function mockForfeit(orderId: string, amount: number, reason?: string) {
  await delay();
  const updated = updateDeposit(requireDeposit(orderId), (deposit) => {
    transition(deposit, "FORFEITED", reason);
    deposit.amountForfeited = { amount, currency: "INR" };
  });
  persist();
  return updated;
}

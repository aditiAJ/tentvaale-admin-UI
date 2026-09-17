import { ApiError } from "@/services/api-client";
import { getAuthToken } from "@/services/auth-token";
import { readSession } from "@/services/jwt";
import type { Role } from "@/services/permissions";
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
import type {
  CreateQuotationRequest,
  QuotationLineView,
  QuotationView,
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
  SEED_NOTIFICATIONS,
  SEED_ORDERS,
  SEED_ORDER_DETAILS,
  SEED_PRODUCTS,
  SEED_QUOTATIONS,
  SEED_QUOTATION_DETAILS,
  SEED_STOCK_MOVEMENTS,
  SEED_TRUCKS,
  SEED_WAREHOUSES,
  SEED_USERS,
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

const STORAGE_KEY = "tentvaale.admin.mock.v2";

/** Enough delay to make loading states real, little enough to feel instant. */
const LATENCY_MS = 220;

interface MockUser extends AdminUserView {
  password: string;
}

interface MockState {
  users: MockUser[];
  products: ProductView[];
  categories: CategoryView[];
  customers: CustomerView[];
  bundles: BundleView[];
  warehouses: WarehouseView[];
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
    categories: SEED_CATEGORIES,
    customers: SEED_CUSTOMERS,
    bundles: SEED_BUNDLES,
    warehouses: SEED_WAREHOUSES,
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
    cache = stored ? (JSON.parse(stored) as MockState) : seedState();
  } catch {
    // Corrupt or unreadable storage is not worth failing over in a mock.
    cache = seedState();
  }
  return cache;
}

function persist(): void {
  if (typeof window === "undefined" || !cache) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Quota or private-mode failures leave the in-memory copy authoritative.
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

export async function mockListProducts(): Promise<ProductView[]> {
  await delay();
  // findByCompanyIdAndActiveTrueOrderByNameAsc — active only, sorted by name.
  return state()
    .products.filter((product) => product.active)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function mockCreateProduct(request: CreateProductRequest): Promise<ProductView> {
  await delay();
  const current = state();

  if (current.products.some((p) => p.sku.toLowerCase() === request.sku.toLowerCase())) {
    throw businessRule(`A product with SKU ${request.sku} already exists for this company`);
  }

  const created: ProductView = {
    id: crypto.randomUUID(),
    companyId: COMPANY_ID,
    sku: request.sku,
    name: request.name,
    description: request.description?.trim() ? request.description : null,
    // Category ids are not foreign keys and nothing lists categories, so a
    // supplied id resolves to no name — exactly what the real view does.
    categoryName: null,
    rentalRate: { amount: request.rentalRate, currency: "INR" },
    securityDeposit: { amount: request.securityDeposit, currency: "INR" },
    active: true,
  };

  current.products.push(created);
  persist();
  return created;
}

export async function mockListCategories(): Promise<CategoryView[]> {
  await delay();
  return state()
    .categories.filter((category) => category.active)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function mockCreateCategory(request: CreateCategoryRequest): Promise<CategoryView> {
  await delay();
  const current = state();

  if (current.categories.some((c) => c.name.toLowerCase() === request.name.toLowerCase())) {
    throw businessRule(`A category named '${request.name}' already exists for this company`);
  }

  const created: CategoryView = {
    id: crypto.randomUUID(),
    companyId: COMPANY_ID,
    name: request.name,
    active: true,
  };

  current.categories.push(created);
  persist();
  return created;
}

/**
 * Customers, bundles, warehouses and trucks are read-only here because they
 * are read-only everywhere: none of them has a create endpoint to stand in
 * for. Customers at least have a real entity (identity's StorefrontAccount),
 * but it is created by storefront signup, not by the back office.
 */
export async function mockListCustomers(): Promise<CustomerView[]> {
  await delay();
  return [...state().customers].sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function mockListBundles(): Promise<BundleView[]> {
  await delay();
  return [...state().bundles].sort((a, b) => a.name.localeCompare(b.name));
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

  const updated: CategoryView = { ...current.categories[index], name: request.name };
  current.categories[index] = updated;
  persist();
  return updated;
}

export async function mockDeactivateCategory(categoryId: string): Promise<CategoryView> {
  await delay();
  const current = state();

  const index = current.categories.findIndex((category) => category.id === categoryId);
  if (index === -1) throw notFound(`Category ${categoryId} not found`);
  if (!current.categories[index].active) {
    throw businessRule(`Category '${current.categories[index].name}' is already inactive`);
  }

  const updated: CategoryView = { ...current.categories[index], active: false };
  current.categories[index] = updated;
  persist();
  return updated;
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
  persist();
}

export async function mockCreateTruck(request: CreateTruckRequest): Promise<TruckView> {
  await delay();
  const current = state();

  // Registrations are the one genuinely unique thing a truck has.
  if (nameTaken(current.trucks.map((truck) => truck.registration), request.registration)) {
    throw businessRule(`Truck ${request.registration} is already on the fleet`);
  }

  const created: TruckView = {
    id: crypto.randomUUID(),
    companyId: COMPANY_ID,
    registration: request.registration,
    capacityKg: request.capacityKg,
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

  const others = current.trucks.filter((truck) => truck.id !== truckId);
  if (nameTaken(others.map((truck) => truck.registration), request.registration)) {
    throw businessRule(`Truck ${request.registration} is already on the fleet`);
  }

  const updated: TruckView = {
    ...current.trucks[index],
    registration: request.registration,
    capacityKg: request.capacityKg,
  };
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

export async function mockCreateBundle(request: CreateBundleRequest): Promise<BundleView> {
  await delay();
  const current = state();

  if (request.contents.length === 0) {
    throw businessRule("A bundle must contain at least one product");
  }
  if (nameTaken(current.bundles.map((bundle) => bundle.name), request.name)) {
    throw businessRule(`A bundle named '${request.name}' already exists for this company`);
  }

  const created: BundleView = {
    id: crypto.randomUUID(),
    companyId: COMPANY_ID,
    name: request.name,
    contents: request.contents,
    rentalRate: { amount: request.rentalRate, currency: "INR" },
  };

  current.bundles.push(created);
  persist();
  return created;
}

export async function mockUpdateBundle(
  bundleId: string,
  request: UpdateBundleRequest,
): Promise<BundleView> {
  await delay();
  const current = state();

  const index = current.bundles.findIndex((bundle) => bundle.id === bundleId);
  if (index === -1) throw notFound(`Bundle ${bundleId} not found`);

  if (request.contents.length === 0) {
    throw businessRule("A bundle must contain at least one product");
  }

  const others = current.bundles.filter((bundle) => bundle.id !== bundleId);
  if (nameTaken(others.map((bundle) => bundle.name), request.name)) {
    throw businessRule(`A bundle named '${request.name}' already exists for this company`);
  }

  const updated: BundleView = {
    ...current.bundles[index],
    name: request.name,
    contents: request.contents,
    rentalRate: { amount: request.rentalRate, currency: "INR" },
  };
  current.bundles[index] = updated;
  persist();
  return updated;
}

/**
 * Removed outright. A bundle is a pricing convenience that has never been
 * quoted from — nothing in quotation or order references one, because a
 * quotation line carries a product id — so there is nothing to orphan.
 */
export async function mockDeleteBundle(bundleId: string): Promise<void> {
  await delay();
  const current = state();

  if (!current.bundles.some((bundle) => bundle.id === bundleId)) {
    throw notFound(`Bundle ${bundleId} not found`);
  }

  current.bundles = current.bundles.filter((bundle) => bundle.id !== bundleId);
  persist();
}

export async function mockCreateCustomer(
  request: CreateCustomerRequest,
): Promise<CustomerView> {
  await delay();
  const current = state();

  // Email is the storefront account's natural key — it is what login uses.
  if (nameTaken(current.customers.map((customer) => customer.email), request.email)) {
    throw businessRule(`An account already exists for ${request.email}`);
  }

  const created: CustomerView = {
    id: crypto.randomUUID(),
    email: request.email,
    fullName: request.fullName,
    phone: request.phone?.trim() ? request.phone : null,
    accountType: request.accountType,
  };

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

  const others = current.customers.filter((customer) => customer.id !== customerId);
  if (nameTaken(others.map((customer) => customer.email), request.email)) {
    throw businessRule(`An account already exists for ${request.email}`);
  }

  const updated: CustomerView = {
    ...current.customers[index],
    email: request.email,
    fullName: request.fullName,
    phone: request.phone?.trim() ? request.phone : null,
    accountType: request.accountType,
  };
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
 * approximated: line total is rate x quantity x days, but the deposit is per
 * unit and is NOT multiplied by days, because a deposit is held against the
 * goods, not rented. QuotationItem#priced carries a TODO saying the legacy slab
 * and seasonal rules live in unread stored procedures, so this is the simplest
 * defensible formula on both sides — and wrong in the same way if it is wrong.
 *
 * The status is always DRAFT and the source is always "admin-ui": the
 * controller supplies both, so neither is the client's to choose.
 */
export async function mockCreateQuotation(
  request: CreateQuotationRequest,
): Promise<QuotationView> {
  await delay();
  const current = state();

  if (request.lines.length === 0) {
    throw businessRule("A quotation must have at least one line");
  }

  const id = crypto.randomUUID();
  const lines: QuotationLineView[] = [];
  let totalAmount = 0;
  let totalSecurityDeposit = 0;

  request.lines.forEach((line, index) => {
    if (line.quantity <= 0 || line.rentalDays <= 0) {
      throw businessRule("Quantity and rental days must both be at least 1");
    }

    // The real service calls masterData.getProduct, which throws when the id
    // belongs to another company — that is what stops a forged product id
    // crossing tenants, so an unknown id is a failure here too rather than a
    // silently skipped line.
    const product = current.products.find((candidate) => candidate.id === line.productId);
    if (!product) throw notFound(`Product ${line.productId} not found`);

    const rate = Number(product.rentalRate.amount);
    const lineTotal = rate * line.quantity * line.rentalDays;

    lines.push({
      id: `${id}-L${index + 1}`,
      productId: product.id,
      productName: product.name,
      quantity: line.quantity,
      rentalDays: line.rentalDays,
      unitRatePerDay: { amount: rate, currency: "INR" },
      lineTotal: { amount: lineTotal, currency: "INR" },
    });

    totalAmount += lineTotal;
    totalSecurityDeposit += Number(product.securityDeposit.amount) * line.quantity;
  });

  const created: QuotationView = {
    id,
    companyId: COMPANY_ID,
    quotationNumber: nextQuotationNumber(current),
    customerId: request.customerId ?? null,
    customerName: request.customerName,
    customerEmail: request.customerEmail?.trim() ? request.customerEmail : null,
    eventDate: request.eventDate?.trim() ? request.eventDate : null,
    status: "DRAFT",
    totalAmount: { amount: totalAmount, currency: "INR" },
    totalSecurityDeposit: { amount: totalSecurityDeposit, currency: "INR" },
    sourceReference: "admin-ui",
    lines,
  };

  current.quotations.push(created);
  persist();
  return created;
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
    // The only status anything in the rebuild ever sets.
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

/**
 * Stands in for InventoryService#recordMovement.
 *
 * The checks are the real ones and only the real ones: at least one line, an
 * order that exists in this company, and every quantity at least 1. The service
 * carries an explicit TODO saying the legacy validation — the movement against
 * what the order contains, and against current availability — lives in stored
 * procedures nobody has read, so a movement here can dispatch a product the
 * order never included and twenty of something there are three of. Adding those
 * rules to the mock would invent a guard the backend does not have and hide a
 * real gap.
 */
export async function mockRecordStockMovement(
  request: RecordStockMovementRequest,
): Promise<StockMovementView> {
  await delay();
  const current = state();

  if (request.lines.length === 0) {
    throw businessRule("A stock movement must have at least one line");
  }

  // orders.orderExists(companyId, orderId) — the one thing that is checked.
  if (!current.orders.some((order) => order.id === request.orderId)) {
    throw notFound(`Order ${request.orderId} not found`);
  }

  for (const line of request.lines) {
    if (line.quantity <= 0) throw businessRule("Movement quantity must be at least 1");
  }

  const id = crypto.randomUUID();

  const created: StockMovementView = {
    id,
    companyId: COMPANY_ID,
    orderId: request.orderId,
    movementNumber: nextMovementNumber(current),
    direction: request.direction,
    // The controller substitutes today when movedOn is absent, so this does too
    // rather than storing a null the view would have to render as "unknown".
    movedOn: request.movedOn?.trim() ? request.movedOn : new Date().toISOString().slice(0, 10),
    warehouseId: request.warehouseId?.trim() ? request.warehouseId : null,
    remarks: request.remarks?.trim() ? request.remarks : null,
    lines: request.lines.map((line, index) => ({
      id: `${id}-L${index + 1}`,
      productId: line.productId,
      quantity: line.quantity,
    })),
  };

  current.stockMovements.push(created);
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
 * There is no availability endpoint to mock, so this derives what it can from
 * the movements the mock does hold: outward quantities minus inward ones, per
 * product. That is emphatically NOT the real rule — the legacy calculation
 * also weighs confirmed orders and lives in stored procedures nobody has
 * read — and the screen says so rather than presenting this as authoritative.
 */
export async function mockDeriveAvailability(): Promise<AvailabilityRow[]> {
  await delay();
  const current = state();
  const onRent = new Map<string, number>();

  for (const movement of current.stockMovements) {
    const sign = movement.direction === "OUTWARD" ? 1 : -1;
    for (const line of movement.lines) {
      onRent.set(line.productId, (onRent.get(line.productId) ?? 0) + sign * line.quantity);
    }
  }

  return current.products
    .filter((product) => product.active)
    .map((product) => ({
      productId: product.id,
      productName: product.name,
      sku: product.sku,
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

  // Orders converted in this session are counted the same way, and their value
  // read off the order itself — SEED_ORDERS carries a plain total, converted
  // ones carry the quotation's.
  const addedOrders = state().orders.filter(
    (order) => !SEED_ORDERS.some((seed) => seed.id === order.id),
  );

  return {
    draftQuotations: countOf("DRAFT"),
    sentQuotations: countOf("SENT"),
    acceptedQuotations: countOf("ACCEPTED"),
    convertedQuotations: countOf("CONVERTED"),
    totalOrders: SEED_ORDERS.length + addedOrders.length,
    totalOrderValue: {
      amount:
        SEED_ORDERS.reduce((sum, order) => sum + order.total, 0) +
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

export async function mockRequestRefund(orderId: string, reason?: string) {
  await delay();
  const deposit = requireDeposit(orderId);
  transition(deposit, "REFUND_PENDING", reason);
  persist();
  return deposit;
}

export async function mockConfirmRefunded(orderId: string, amount: number) {
  await delay();
  const deposit = requireDeposit(orderId);
  transition(deposit, "REFUNDED");
  // Faithful to the backend: recordRefund does NOT check the amount against
  // what is held, so an over-refund is accepted here too. The UI warns; this
  // does not, on purpose — otherwise the mock would hide the real gap.
  deposit.amountRefunded = { amount, currency: "INR" };
  persist();
  return deposit;
}

export async function mockForfeit(orderId: string, amount: number, reason?: string) {
  await delay();
  const deposit = requireDeposit(orderId);
  transition(deposit, "FORFEITED", reason);
  deposit.amountForfeited = { amount, currency: "INR" };
  persist();
  return deposit;
}

/** Order ids that have a deposit, so the lookup screen can offer real examples. */
export function mockDepositOrderIds(): { orderId: string; status: string }[] {
  return state().deposits.map((deposit) => ({
    orderId: deposit.orderId,
    status: deposit.status,
  }));
}

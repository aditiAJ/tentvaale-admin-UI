import { ApiError } from "@/services/api-client";
import { getAuthToken } from "@/services/auth-token";
import { readSession } from "@/services/jwt";
import type { Role } from "@/services/permissions";
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
import type { QuotationView } from "@/features/quotations/types";
import type { OrderView } from "@/features/orders/types";
import type { AvailabilityRow, StockMovementView } from "@/features/inventory/types";
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
// Quotations and orders
// ---------------------------------------------------------------------------

export async function mockGetQuotation(quotationId: string): Promise<QuotationView> {
  await delay();
  const found = state().quotations.find((quotation) => quotation.id === quotationId);
  if (!found) throw notFound(`Quotation ${quotationId} not found`);
  return found;
}

export async function mockGetOrder(orderId: string): Promise<OrderView> {
  await delay();
  const found = state().orders.find((order) => order.id === orderId);
  if (!found) throw notFound(`Order ${orderId} not found`);
  return found;
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
  const countOf = (status: string) =>
    SEED_QUOTATIONS.filter((quotation) => quotation.status === status).length;

  return {
    draftQuotations: countOf("DRAFT"),
    sentQuotations: countOf("SENT"),
    acceptedQuotations: countOf("ACCEPTED"),
    convertedQuotations: countOf("CONVERTED"),
    totalOrders: SEED_ORDERS.length,
    totalOrderValue: {
      amount: SEED_ORDERS.reduce((sum, order) => sum + order.total, 0),
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

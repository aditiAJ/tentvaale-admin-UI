import type {
  BundleView,
  CategoryView,
  CustomerView,
  ProductView,
  TruckView,
  WarehouseView,
} from "@/features/master-data/types";
import type { AdminUserView } from "@/features/users/types";
import type { NotificationLogView } from "@/features/notifications/types";
import type { DepositLedgerView } from "@/features/deposits/types";
import type { QuotationView } from "@/features/quotations/types";
import type { OrderView } from "@/features/orders/types";
import type { StockMovementView } from "@/features/inventory/types";
import type { CreditNoteView } from "@/features/credit-notes/types";
import type { Role } from "@/services/permissions";

/**
 * Seed data for the mock build.
 *
 * Shapes match the backend's view records exactly, so when the real API is
 * switched on nothing downstream changes — the same types flow through the same
 * components. Values are picked to exercise the awkward cases the happy path
 * hides: a product with no category, a zero deposit, a failed and a skipped
 * notification, a deposit already settled, an inactive user.
 */

export const COMPANY_ID = "22222222-2222-2222-2222-222222222222";

/** One password for every seeded account. This build has no real security. */
export const DEMO_PASSWORD = "tentvaale";

interface SeedUser extends AdminUserView {
  password: string;
}

export const SEED_USERS: SeedUser[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    companyId: COMPANY_ID,
    username: "asha.k",
    email: "asha@tentvaale.example",
    role: "ADMIN",
    active: true,
    password: DEMO_PASSWORD,
  },
  {
    id: "11111111-1111-1111-1111-111111111112",
    companyId: COMPANY_ID,
    username: "rohit.m",
    email: "rohit@tentvaale.example",
    role: "SALES",
    active: true,
    password: DEMO_PASSWORD,
  },
  {
    id: "11111111-1111-1111-1111-111111111113",
    companyId: COMPANY_ID,
    username: "vikram.s",
    email: "vikram@tentvaale.example",
    role: "WAREHOUSE",
    active: true,
    password: DEMO_PASSWORD,
  },
  {
    id: "11111111-1111-1111-1111-111111111114",
    companyId: COMPANY_ID,
    username: "priya.n",
    email: "priya@tentvaale.example",
    role: "ACCOUNTS",
    active: true,
    password: DEMO_PASSWORD,
  },
  {
    id: "11111111-1111-1111-1111-111111111115",
    companyId: COMPANY_ID,
    username: "old.account",
    email: "former@tentvaale.example",
    role: "SALES",
    active: false,
    password: DEMO_PASSWORD,
  },
];

/** Which role a visitor can sign in as, for the login screen's shortcuts. */
export const DEMO_LOGINS: { username: string; role: Role; blurb: string }[] = [
  { username: "asha.k", role: "ADMIN", blurb: "Everything, including users" },
  { username: "rohit.m", role: "SALES", blurb: "Catalogue and reporting; no user admin" },
  { username: "vikram.s", role: "WAREHOUSE", blurb: "Stock only — the sparsest menu" },
  { username: "priya.n", role: "ACCOUNTS", blurb: "Deposits, reporting, notifications" },
];

const inr = (amount: number) => ({ amount, currency: "INR" });

export const SEED_PRODUCTS: ProductView[] = [
  { id: "p-01", companyId: COMPANY_ID, sku: "TENT-20X40", name: "20x40 Frame Tent", description: "Heavy-duty frame tent, seats 80 banquet style", categoryName: "Tents", rentalRate: inr(12500), securityDeposit: inr(5000), active: true },
  { id: "p-02", companyId: COMPANY_ID, sku: "TENT-30X60", name: "30x60 Pole Tent", description: "Large pole tent for open ground", categoryName: "Tents", rentalRate: inr(24000), securityDeposit: inr(9000), active: true },
  { id: "p-03", companyId: COMPANY_ID, sku: "TENT-10X10", name: "10x10 Canopy", description: null, categoryName: "Tents", rentalRate: inr(1800), securityDeposit: inr(500), active: true },
  { id: "p-04", companyId: COMPANY_ID, sku: "CHR-GOLD", name: "Gold Chiavari Chair", description: "Banquet seating, stackable", categoryName: "Seating", rentalRate: inr(120.5), securityDeposit: inr(0), active: true },
  { id: "p-05", companyId: COMPANY_ID, sku: "CHR-WHITE", name: "White Folding Chair", description: null, categoryName: "Seating", rentalRate: inr(45), securityDeposit: inr(0), active: true },
  { id: "p-06", companyId: COMPANY_ID, sku: "SOFA-VELVET", name: "Velvet Lounge Sofa", description: "Three-seater, ivory velvet", categoryName: "Seating", rentalRate: inr(3200), securityDeposit: inr(2000), active: true },
  { id: "p-07", companyId: COMPANY_ID, sku: "TBL-ROUND-6", name: "6ft Round Table", description: "Seats 10", categoryName: "Tables", rentalRate: inr(400), securityDeposit: inr(0), active: true },
  { id: "p-08", companyId: COMPANY_ID, sku: "TBL-COCKTAIL", name: "Cocktail Table", description: null, categoryName: "Tables", rentalRate: inr(250), securityDeposit: inr(0), active: true },
  // Deliberately uncategorised: md_product.category_id is not a foreign key, so
  // orphans are normal and the UI must render them without complaint.
  { id: "p-09", companyId: COMPANY_ID, sku: "STAGE-8X12", name: "8x12 Stage Deck", description: "Modular decking, 600mm rise", categoryName: null, rentalRate: inr(7500), securityDeposit: inr(3000), active: true },
  { id: "p-10", companyId: COMPANY_ID, sku: "LIGHT-FAIRY", name: "Fairy Light Curtain", description: "4m x 3m warm white", categoryName: "Lighting", rentalRate: inr(900), securityDeposit: inr(250), active: true },
  { id: "p-11", companyId: COMPANY_ID, sku: "LIGHT-UPLIGHT", name: "LED Uplight", description: "Battery, colour selectable", categoryName: "Lighting", rentalRate: inr(350), securityDeposit: inr(400), active: true },
  { id: "p-12", companyId: COMPANY_ID, sku: "GEN-15KVA", name: "15 kVA Silent Generator", description: "Diesel, includes 40m cabling", categoryName: "Power", rentalRate: inr(6500), securityDeposit: inr(10000), active: true },
  // Inactive, so it should NOT appear in the list: the real endpoint is
  // findByCompanyIdAndActiveTrue.
  { id: "p-13", companyId: COMPANY_ID, sku: "TENT-RETIRED", name: "15x30 Frame Tent (retired)", description: "Withdrawn after storm damage", categoryName: "Tents", rentalRate: inr(9000), securityDeposit: inr(4000), active: false },
];

/**
 * Named to match the categoryName strings already baked into SEED_PRODUCTS
 * above (products store the name directly in the mock rather than resolving
 * it through categoryId, so the two lists are not joined — same as the real
 * schema, where category_id is deliberately not a foreign key).
 */
export const SEED_CATEGORIES: CategoryView[] = [
  { id: "cat-01", companyId: COMPANY_ID, name: "Tents", active: true },
  { id: "cat-02", companyId: COMPANY_ID, name: "Seating", active: true },
  { id: "cat-03", companyId: COMPANY_ID, name: "Tables", active: true },
  { id: "cat-04", companyId: COMPANY_ID, name: "Lighting", active: true },
  { id: "cat-05", companyId: COMPANY_ID, name: "Power", active: true },
];

export interface SeedQuotation {
  id: string;
  number: string;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "CONVERTED" | "EXPIRED";
}

/** UUID-shaped for the same reason order ids are: the quotation screen looks
 *  one up by id, and nothing else in the app would accept `q-d0`. */
const quotationId = (group: number, index: number) =>
  `66666666-6666-6666-6666-6666${String(group).padStart(2, "0")}${String(index).padStart(6, "0")}`;

/**
 * The dashboard counts are derived from these rather than hardcoded, so the
 * figures stay consistent with anything added later. Rejected and expired are
 * present on purpose: the real endpoint does not return them, and the dashboard
 * says so rather than quietly folding them into a win rate.
 */
export const SEED_QUOTATIONS: SeedQuotation[] = [
  ...Array.from({ length: 14 }, (_, i) => ({ id: quotationId(1, i), number: `QT-2026-${300 + i}`, status: "DRAFT" as const })),
  ...Array.from({ length: 23 }, (_, i) => ({ id: quotationId(2, i), number: `QT-2026-${200 + i}`, status: "SENT" as const })),
  ...Array.from({ length: 9 }, (_, i) => ({ id: quotationId(3, i), number: `QT-2026-${150 + i}`, status: "ACCEPTED" as const })),
  ...Array.from({ length: 31 }, (_, i) => ({ id: quotationId(4, i), number: `QT-2026-${100 + i}`, status: "CONVERTED" as const })),
  ...Array.from({ length: 6 }, (_, i) => ({ id: quotationId(5, i), number: `QT-2026-${80 + i}`, status: "REJECTED" as const })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: quotationId(6, i), number: `QT-2026-${70 + i}`, status: "EXPIRED" as const })),
];

/**
 * Customers are StorefrontAccounts, which have no companyId — they are not
 * owned by a tenant, so these are deliberately not stamped with COMPANY_ID
 * the way every other seed here is. One EVENT_PLANNER is included because the
 * account type is the only thing that distinguishes the two.
 */
export const SEED_CUSTOMERS: CustomerView[] = [
  { id: "44444444-4444-4444-4444-444444444401", email: "amit.shah@example.com", fullName: "Amit Shah", phone: "+91 98200 11223", accountType: "CUSTOMER" },
  { id: "44444444-4444-4444-4444-444444444402", email: "neha.r@example.com", fullName: "Neha Raghavan", phone: "+91 99300 44556", accountType: "CUSTOMER" },
  { id: "44444444-4444-4444-4444-444444444403", email: "events@grandpalace.example", fullName: "Grand Palace Banquets", phone: "+91 22 4455 6677", accountType: "EVENT_PLANNER" },
  { id: "44444444-4444-4444-4444-444444444404", email: "rhea.kapoor@example.com", fullName: "Rhea Kapoor", phone: null, accountType: "CUSTOMER" },
  { id: "44444444-4444-4444-4444-444444444405", email: "vendor.desk@example.com", fullName: "Mehta Event Co.", phone: "+91 98110 77889", accountType: "EVENT_PLANNER" },
];

/** Invented outright — no bundle table or endpoint exists to be faithful to. */
export const SEED_BUNDLES: BundleView[] = [
  { id: "b-01", companyId: COMPANY_ID, name: "Wedding Mandap Set", contents: ["20x40 Frame Tent", "Gold Chiavari Chair", "6ft Round Table"], rentalRate: inr(28000) },
  { id: "b-02", companyId: COMPANY_ID, name: "Corporate Conference Kit", contents: ["30x60 Pole Tent", "White Folding Chair", "8x12 Stage Deck"], rentalRate: inr(41000) },
  { id: "b-03", companyId: COMPANY_ID, name: "Garden Party Package", contents: ["10x10 Canopy", "Cocktail Table", "Fairy Light Curtain"], rentalRate: inr(6400) },
];

/** Invented outright — warehouses are an opaque UUID on StockMovement only. */
export const SEED_WAREHOUSES: WarehouseView[] = [
  { id: "55555555-5555-5555-5555-555555555501", companyId: COMPANY_ID, name: "Andheri Main Store", city: "Mumbai" },
  { id: "55555555-5555-5555-5555-555555555502", companyId: COMPANY_ID, name: "Pune Satellite Depot", city: "Pune" },
  { id: "55555555-5555-5555-5555-555555555503", companyId: COMPANY_ID, name: "Nashik Overflow Yard", city: "Nashik" },
];

/** Invented outright — no truck table, and volume attributes for load
 *  calculation are not modelled on products either. */
export const SEED_TRUCKS: TruckView[] = [
  { id: "t-01", companyId: COMPANY_ID, registration: "MH 01 AB 4471", capacityKg: 3500 },
  { id: "t-02", companyId: COMPANY_ID, registration: "MH 12 CD 9920", capacityKg: 7500 },
  { id: "t-03", companyId: COMPANY_ID, registration: "MH 04 EF 1183", capacityKg: 1200 },
];

export interface SeedOrder {
  id: string;
  number: string;
  total: number;
}

/** Order ids are real UUIDs because the deposits screen is looked up by one. */
export const SEED_ORDERS: SeedOrder[] = [
  { id: "33333333-3333-3333-3333-333333333301", number: "ORD-2026-0088", total: 186400 },
  { id: "33333333-3333-3333-3333-333333333302", number: "ORD-2026-0089", total: 94250 },
  { id: "33333333-3333-3333-3333-333333333303", number: "ORD-2026-0090", total: 312000 },
  { id: "33333333-3333-3333-3333-333333333304", number: "ORD-2026-0091", total: 58700 },
  { id: "33333333-3333-3333-3333-333333333305", number: "ORD-2026-0092", total: 141900 },
  ...Array.from({ length: 26 }, (_, i) => ({
    id: `33333333-3333-3333-3333-3333333334${String(i).padStart(2, "0")}`,
    number: `ORD-2026-${String(50 + i).padStart(4, "0")}`,
    total: 45000 + i * 11500,
  })),
];

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const daysFromNow = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const productBySku = (sku: string): ProductView => {
  const found = SEED_PRODUCTS.find((product) => product.sku === sku);
  if (!found) throw new Error(`Seed error: no product with SKU ${sku}`);
  return found;
};

interface SeedLine {
  sku: string;
  quantity: number;
  rentalDays: number;
}

/**
 * Full quotation and order records for the screens that look one up by id.
 *
 * These are built FROM the count seeds above rather than written out beside
 * them: the id, number and status all come from the SeedQuotation entry, so
 * a quotation the dashboard counts as SENT can never open as something else.
 * Line totals are computed from the real product rates for the same reason —
 * the backend stores totals at creation time, so they are materialised here
 * too rather than derived on read.
 */
function quotationDetail(
  source: SeedQuotation,
  customer: CustomerView,
  eventInDays: number,
  lines: SeedLine[],
  sourceReference: string | null,
): QuotationView {
  const built = lines.map((line, index) => {
    const product = productBySku(line.sku);
    const rate = Number(product.rentalRate.amount);
    return {
      id: `${source.id}-L${index + 1}`,
      productId: product.id,
      productName: product.name,
      quantity: line.quantity,
      rentalDays: line.rentalDays,
      unitRatePerDay: inr(rate),
      lineTotal: inr(rate * line.quantity * line.rentalDays),
    };
  });

  const deposit = lines.reduce(
    (sum, line) => sum + Number(productBySku(line.sku).securityDeposit.amount) * line.quantity,
    0,
  );

  return {
    id: source.id,
    companyId: COMPANY_ID,
    quotationNumber: source.number,
    customerId: customer.id,
    customerName: customer.fullName,
    customerEmail: customer.email,
    eventDate: daysFromNow(eventInDays),
    status: source.status,
    totalAmount: inr(built.reduce((sum, line) => sum + Number(line.lineTotal.amount), 0)),
    totalSecurityDeposit: inr(deposit),
    sourceReference,
    lines: built,
  };
}

const quotationByNumber = (number: string): SeedQuotation => {
  const found = SEED_QUOTATIONS.find((quotation) => quotation.number === number);
  if (!found) throw new Error(`Seed error: no quotation numbered ${number}`);
  return found;
};

export const SEED_QUOTATION_DETAILS: QuotationView[] = [
  quotationDetail(
    quotationByNumber("QT-2026-100"),
    SEED_CUSTOMERS[0],
    12,
    [
      { sku: "TENT-20X40", quantity: 1, rentalDays: 2 },
      { sku: "CHR-GOLD", quantity: 80, rentalDays: 2 },
      { sku: "TBL-ROUND-6", quantity: 8, rentalDays: 2 },
    ],
    "admin-ui",
  ),
  quotationDetail(
    quotationByNumber("QT-2026-200"),
    SEED_CUSTOMERS[2],
    26,
    [
      { sku: "TENT-30X60", quantity: 1, rentalDays: 3 },
      { sku: "STAGE-8X12", quantity: 2, rentalDays: 3 },
      { sku: "LIGHT-UPLIGHT", quantity: 12, rentalDays: 3 },
    ],
    "storefront-plan:99999999-9999-9999-9999-999999999901",
  ),
  quotationDetail(
    quotationByNumber("QT-2026-300"),
    SEED_CUSTOMERS[3],
    40,
    [{ sku: "LIGHT-FAIRY", quantity: 6, rentalDays: 1 }],
    "admin-ui",
  ),
  quotationDetail(
    quotationByNumber("QT-2026-150"),
    SEED_CUSTOMERS[4],
    19,
    [
      { sku: "GEN-15KVA", quantity: 1, rentalDays: 2 },
      { sku: "CHR-WHITE", quantity: 150, rentalDays: 2 },
    ],
    "admin-ui",
  ),
];

/**
 * Orders are converted quotations, so each detail here is built from one of
 * the quotation details above: lines, customer and totals are copied across
 * exactly as OrderMgmtService copies them, rather than being invented a
 * second time. Status is always CONFIRMED because that is the only status
 * anything in the rebuild ever sets.
 */
function orderFromQuotation(source: SeedOrder, quotation: QuotationView): OrderView {
  return {
    id: source.id,
    companyId: COMPANY_ID,
    orderNumber: source.number,
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
      id: `${source.id}-${line.id}`,
      productId: line.productId,
      productName: line.productName,
      quantity: line.quantity,
      rentalDays: line.rentalDays,
      lineTotal: line.lineTotal,
    })),
  };
}

export const SEED_ORDER_DETAILS: OrderView[] = [
  orderFromQuotation(SEED_ORDERS[0], SEED_QUOTATION_DETAILS[0]),
  orderFromQuotation(SEED_ORDERS[2], SEED_QUOTATION_DETAILS[1]),
  orderFromQuotation(SEED_ORDERS[4], SEED_QUOTATION_DETAILS[3]),
];

/**
 * Movements are recorded against a whole order. The first order has gone out
 * and come back; the third has only gone out, so it still reads as on rent —
 * which is the one thing the availability screen can show.
 */
export const SEED_STOCK_MOVEMENTS: StockMovementView[] = [
  {
    id: "sm-01",
    companyId: COMPANY_ID,
    orderId: SEED_ORDERS[0].id,
    movementNumber: "SM-2026-0041",
    direction: "OUTWARD",
    movedOn: new Date(Date.now() - 86_400_000 * 6).toISOString().slice(0, 10),
    warehouseId: SEED_WAREHOUSES[0].id,
    remarks: "Loaded 06:30, two trips",
    lines: SEED_QUOTATION_DETAILS[0].lines.map((line, index) => ({
      id: `sm-01-L${index + 1}`,
      productId: line.productId,
      quantity: line.quantity,
    })),
  },
  {
    id: "sm-02",
    companyId: COMPANY_ID,
    orderId: SEED_ORDERS[0].id,
    movementNumber: "SM-2026-0048",
    direction: "INWARD",
    movedOn: new Date(Date.now() - 86_400_000 * 3).toISOString().slice(0, 10),
    warehouseId: SEED_WAREHOUSES[0].id,
    remarks: "All returned, two chairs scuffed",
    lines: SEED_QUOTATION_DETAILS[0].lines.map((line, index) => ({
      id: `sm-02-L${index + 1}`,
      productId: line.productId,
      quantity: line.quantity,
    })),
  },
  {
    id: "sm-03",
    companyId: COMPANY_ID,
    orderId: SEED_ORDERS[2].id,
    movementNumber: "SM-2026-0052",
    direction: "OUTWARD",
    movedOn: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
    warehouseId: SEED_WAREHOUSES[1].id,
    remarks: null,
    lines: SEED_QUOTATION_DETAILS[1].lines.map((line, index) => ({
      id: `sm-03-L${index + 1}`,
      productId: line.productId,
      quantity: line.quantity,
    })),
  },
];

/**
 * Credit notes are read per customer, never company-wide. appliedAmount is
 * zero on every one of them because nothing in the rebuild applies a credit —
 * the apply/cancel/reverse transitions live in stored procedures that have
 * not been read, so ISSUED is the only status any of these can be in.
 */
export const SEED_CREDIT_NOTES: CreditNoteView[] = [
  {
    id: "cn-01",
    companyId: COMPANY_ID,
    creditNoteNumber: "CN-2026-0012",
    customerId: SEED_CUSTOMERS[0].id,
    againstOrderId: SEED_ORDERS[0].id,
    amount: inr(4500),
    appliedAmount: inr(0),
    status: "ISSUED",
    issuedOn: new Date(Date.now() - 86_400_000 * 11).toISOString().slice(0, 10),
    reason: "Two uplights failed on the night; partial credit agreed",
  },
  {
    id: "cn-02",
    companyId: COMPANY_ID,
    creditNoteNumber: "CN-2026-0015",
    customerId: SEED_CUSTOMERS[0].id,
    againstOrderId: null,
    amount: inr(2000),
    appliedAmount: inr(0),
    status: "ISSUED",
    issuedOn: new Date(Date.now() - 86_400_000 * 4).toISOString().slice(0, 10),
    reason: "Goodwill credit after late dispatch",
  },
  {
    id: "cn-03",
    companyId: COMPANY_ID,
    creditNoteNumber: "CN-2026-0009",
    customerId: SEED_CUSTOMERS[2].id,
    againstOrderId: SEED_ORDERS[2].id,
    amount: inr(11750),
    appliedAmount: inr(0),
    status: "ISSUED",
    issuedOn: new Date(Date.now() - 86_400_000 * 22).toISOString().slice(0, 10),
    reason: "Stage deck shortfall, one section never delivered",
  },
];

export const SEED_NOTIFICATIONS: NotificationLogView[] = [
  { id: "n-01", companyId: COMPANY_ID, channel: "EMAIL", templateKey: "quotation.sent", recipient: "rhea.kapoor@example.com", subjectReference: "QT-2026-0184", status: "SENT", attemptedAt: minutesAgo(8) },
  { id: "n-02", companyId: COMPANY_ID, channel: "EMAIL", templateKey: "deposit.refunded", recipient: "amit.shah@example.com", subjectReference: "ORD-2026-0088", status: "PENDING", attemptedAt: minutesAgo(21) },
  { id: "n-03", companyId: COMPANY_ID, channel: "WHATSAPP", templateKey: "order.confirmed", recipient: "+91 98200 11223", subjectReference: "ORD-2026-0091", status: "SKIPPED", attemptedAt: minutesAgo(54) },
  { id: "n-04", companyId: COMPANY_ID, channel: "EMAIL", templateKey: "quotation.reminder", recipient: "no-such-host@invalid.example", subjectReference: "QT-2026-0177", status: "FAILED", failureReason: "550 5.1.2 Domain not found", attemptedAt: minutesAgo(96) },
  { id: "n-05", companyId: COMPANY_ID, channel: "EMAIL", templateKey: "order.dispatched", recipient: "events@grandpalace.example", subjectReference: "ORD-2026-0090", status: "SENT", attemptedAt: minutesAgo(140) },
  { id: "n-06", companyId: COMPANY_ID, channel: "WHATSAPP", templateKey: "order.dispatched", recipient: "+91 99300 44556", subjectReference: "ORD-2026-0090", status: "SKIPPED", attemptedAt: minutesAgo(141) },
  { id: "n-07", companyId: COMPANY_ID, channel: "EMAIL", templateKey: "quotation.sent", recipient: "rhea.kapoor@example.com", subjectReference: "QT-2026-0184", status: "FAILED", failureReason: "Connection timed out after 30s", attemptedAt: minutesAgo(260) },
  { id: "n-08", companyId: COMPANY_ID, channel: "EMAIL", templateKey: "quotation.accepted", recipient: "sales@tentvaale.example", subjectReference: "QT-2026-0169", status: "SENT", attemptedAt: minutesAgo(430) },
  { id: "n-09", companyId: COMPANY_ID, channel: "EMAIL", templateKey: "deposit.forfeited", recipient: "neha.r@example.com", subjectReference: "ORD-2026-0089", status: "SENT", attemptedAt: minutesAgo(900) },
  { id: "n-10", companyId: COMPANY_ID, channel: "WHATSAPP", templateKey: "quotation.sent", recipient: "+91 98110 77889", subjectReference: "QT-2026-0180", status: "FAILED", failureReason: "Recipient has not opted in to WhatsApp messages", attemptedAt: minutesAgo(1320) },
  { id: "n-11", companyId: COMPANY_ID, channel: "EMAIL", templateKey: "order.confirmed", recipient: "amit.shah@example.com", subjectReference: "ORD-2026-0088", status: "SENT", attemptedAt: minutesAgo(1800) },
  { id: "n-12", companyId: COMPANY_ID, channel: "EMAIL", templateKey: "quotation.expired", recipient: "vendor.desk@example.com", subjectReference: "QT-2026-0071", status: "SENT", attemptedAt: minutesAgo(2600) },
];

export const SEED_DEPOSITS: DepositLedgerView[] = [
  {
    id: "dep-01", companyId: COMPANY_ID,
    orderId: "33333333-3333-3333-3333-333333333301",
    accountId: SEED_CUSTOMERS[0].id,
    amountHeld: inr(15000), amountRefunded: inr(0), amountForfeited: inr(0),
    status: "HELD",
    heldAt: minutesAgo(60 * 24 * 9),
  },
  {
    id: "dep-02", companyId: COMPANY_ID,
    orderId: "33333333-3333-3333-3333-333333333302",
    accountId: SEED_CUSTOMERS[1].id,
    amountHeld: inr(9000), amountRefunded: inr(0), amountForfeited: inr(3500),
    status: "FORFEITED",
    reason: "Two stage decks returned water-damaged",
    heldAt: minutesAgo(60 * 24 * 26), settledAt: minutesAgo(60 * 24 * 2),
  },
  {
    id: "dep-03", companyId: COMPANY_ID,
    orderId: "33333333-3333-3333-3333-333333333303",
    accountId: SEED_CUSTOMERS[2].id,
    amountHeld: inr(24000), amountRefunded: inr(0), amountForfeited: inr(0),
    status: "REFUND_PENDING",
    reason: "Event completed, nothing damaged",
    heldAt: minutesAgo(60 * 24 * 14),
  },
  {
    id: "dep-04", companyId: COMPANY_ID,
    orderId: "33333333-3333-3333-3333-333333333304",
    accountId: SEED_CUSTOMERS[3].id,
    amountHeld: inr(5000), amountRefunded: inr(5000), amountForfeited: inr(0),
    status: "REFUNDED",
    heldAt: minutesAgo(60 * 24 * 40), settledAt: minutesAgo(60 * 24 * 31),
  },
  {
    id: "dep-05", companyId: COMPANY_ID,
    orderId: "33333333-3333-3333-3333-333333333305",
    accountId: SEED_CUSTOMERS[4].id,
    amountHeld: inr(10000), amountRefunded: inr(0), amountForfeited: inr(0),
    status: "HELD",
    heldAt: minutesAgo(60 * 24 * 3),
  },
];

/**
 * Deposit lookups take an order id, and nobody can type a UUID from memory, so
 * the screen offers these as one-click examples in the mock build.
 *
 * Built from the seed rather than from live state on purpose: it is static, so
 * it renders identically on the server and the client. The live status is shown
 * by the page itself once a deposit is loaded.
 */
export const DEMO_DEPOSIT_EXAMPLES = SEED_DEPOSITS.map((deposit) => ({
  orderId: deposit.orderId,
  orderNumber:
    SEED_ORDERS.find((order) => order.id === deposit.orderId)?.number ??
    deposit.orderId.slice(0, 8),
}));

/** The same one-click affordance for every other screen that looks up by id:
 *  only the records the mock actually holds in full are offered. */
export const DEMO_QUOTATION_EXAMPLES = SEED_QUOTATION_DETAILS.map((quotation) => ({
  id: quotation.id,
  label: `${quotation.quotationNumber} · ${quotation.status}`,
}));

export const DEMO_ORDER_EXAMPLES = SEED_ORDER_DETAILS.map((order) => ({
  id: order.id,
  label: order.orderNumber,
}));

export const DEMO_MOVEMENT_ORDER_EXAMPLES = [
  ...new Set(SEED_STOCK_MOVEMENTS.map((movement) => movement.orderId)),
].map((orderId) => ({
  id: orderId,
  label: SEED_ORDERS.find((order) => order.id === orderId)?.number ?? orderId.slice(0, 8),
}));

export const DEMO_CREDIT_CUSTOMER_EXAMPLES = [
  ...new Set(SEED_CREDIT_NOTES.map((note) => note.customerId)),
].map((customerId) => ({
  id: customerId,
  label: SEED_CUSTOMERS.find((customer) => customer.id === customerId)?.fullName ?? customerId,
}));

import type { ProductView } from "@/features/master-data/types";
import type { AdminUserView } from "@/features/users/types";
import type { NotificationLogView } from "@/features/notifications/types";
import type { DepositLedgerView } from "@/features/deposits/types";
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

export interface SeedQuotation {
  id: string;
  number: string;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "CONVERTED" | "EXPIRED";
}

/**
 * The dashboard counts are derived from these rather than hardcoded, so the
 * figures stay consistent with anything added later. Rejected and expired are
 * present on purpose: the real endpoint does not return them, and the dashboard
 * says so rather than quietly folding them into a win rate.
 */
export const SEED_QUOTATIONS: SeedQuotation[] = [
  ...Array.from({ length: 14 }, (_, i) => ({ id: `q-d${i}`, number: `QT-2026-${300 + i}`, status: "DRAFT" as const })),
  ...Array.from({ length: 23 }, (_, i) => ({ id: `q-s${i}`, number: `QT-2026-${200 + i}`, status: "SENT" as const })),
  ...Array.from({ length: 9 }, (_, i) => ({ id: `q-a${i}`, number: `QT-2026-${150 + i}`, status: "ACCEPTED" as const })),
  ...Array.from({ length: 31 }, (_, i) => ({ id: `q-c${i}`, number: `QT-2026-${100 + i}`, status: "CONVERTED" as const })),
  ...Array.from({ length: 6 }, (_, i) => ({ id: `q-r${i}`, number: `QT-2026-${80 + i}`, status: "REJECTED" as const })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `q-e${i}`, number: `QT-2026-${70 + i}`, status: "EXPIRED" as const })),
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
    accountId: "acct-amit",
    amountHeld: inr(15000), amountRefunded: inr(0), amountForfeited: inr(0),
    status: "HELD",
    heldAt: minutesAgo(60 * 24 * 9),
  },
  {
    id: "dep-02", companyId: COMPANY_ID,
    orderId: "33333333-3333-3333-3333-333333333302",
    accountId: "acct-neha",
    amountHeld: inr(9000), amountRefunded: inr(0), amountForfeited: inr(3500),
    status: "FORFEITED",
    reason: "Two stage decks returned water-damaged",
    heldAt: minutesAgo(60 * 24 * 26), settledAt: minutesAgo(60 * 24 * 2),
  },
  {
    id: "dep-03", companyId: COMPANY_ID,
    orderId: "33333333-3333-3333-3333-333333333303",
    accountId: "acct-grandpalace",
    amountHeld: inr(24000), amountRefunded: inr(0), amountForfeited: inr(0),
    status: "REFUND_PENDING",
    reason: "Event completed, nothing damaged",
    heldAt: minutesAgo(60 * 24 * 14),
  },
  {
    id: "dep-04", companyId: COMPANY_ID,
    orderId: "33333333-3333-3333-3333-333333333304",
    accountId: "acct-rhea",
    amountHeld: inr(5000), amountRefunded: inr(5000), amountForfeited: inr(0),
    status: "REFUNDED",
    heldAt: minutesAgo(60 * 24 * 40), settledAt: minutesAgo(60 * 24 * 31),
  },
  {
    id: "dep-05", companyId: COMPANY_ID,
    orderId: "33333333-3333-3333-3333-333333333305",
    accountId: "acct-mehta",
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

import type { Money } from "@/lib/money";

/**
 * Mirrors com.tentvaale.quotation.api.QuotationStatus.
 *
 * Unlike DepositStatus there is no allowedNext() on the backend: the enum's
 * own javadoc says the legacy transition rules "have not been read" and need
 * business confirmation. The only rule enforced in code is that markConverted
 * refuses a quotation that is already CONVERTED. So this UI shows status but
 * offers no transitions — there is no server contract to drive them from.
 */
export const QUOTATION_STATUSES = [
  // NEW, REVIEWED and DISCARDED are this UI's own, for the quotation
  // workspace's filters; the backend enum does not have them, and nothing here
  // moves a quotation into them — only seeded data carries them.
  "NEW",
  "REVIEWED",
  "DISCARDED",
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "CONVERTED",
  "EXPIRED",
] as const;

export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

/** Mirrors com.tentvaale.quotation.api.QuotationLineView. */
export interface QuotationLineView {
  id: string;
  productId: string;
  /** Absent for the base (Standard) product. */
  variantId?: string | null;
  /** Whether the rate came from the customer's trade price list. */
  tradePrice?: boolean;
  productName: string;
  quantity: number;
  rentalDays: number;
  unitRatePerDay: Money;
  lineTotal: Money;
  /** What the quotation document groups and pictures the line by; absent on a quotation written before they were kept. */
  categoryName?: string | null;
  imageUrl?: string | null;
  functionName?: string | null;
  /** yyyy-MM-dd */
  functionDate?: string | null;
  /** HH:mm */
  functionStartTime?: string | null;
  functionVenue?: string | null;
}

/**
 * Mirrors com.tentvaale.quotation.api.QuotationView.
 *
 * customerName and customerEmail are denormalised copies taken at creation
 * time rather than looked up live, and totals are stored rather than
 * recomputed on read — so a rate change after quoting does not retroactively
 * alter a quote that was already sent.
 */
export interface QuotationView {
  id: string;
  companyId: string;
  quotationNumber: string;
  customerId: string | null;
  customerName: string;
  customerEmail: string | null;
  eventDate: string | null;
  status: QuotationStatus;
  totalAmount: Money;
  totalSecurityDeposit: Money;
  /** Free-text provenance, e.g. "storefront-plan:<uuid>" or "admin-ui". */
  sourceReference: string | null;
  /** Last day the quotation can be offered; it expires after this. */
  validUntil?: string | null;
  subtotalAmount?: Money;
  deliveryCharge?: Money;
  discountAmount?: Money;
  /** One line per bundle on the quotation: its percentage off what its items add up to. */
  bundleDiscounts?: { name: string; percent: number; amount: Money }[];
  /** GST on the items after discounts: CGST + SGST in the company's state, IGST elsewhere. */
  tax?: QuotationTax;
  /** A deposit the administrator chose not to collect, with the reason. */
  depositWaiver?: { waived: boolean; amount: Money; reason: string | null; waivedBy: string | null };
  /** The policy versions the quotation was sent with. */
  policies?: { kind: string; version: number }[];
  /** Where the event is, copied from the customer's plan. */
  venue?: QuotationVenue | null;
  /** What the customer last asked to change; the quotation is a draft until it is re-sent. */
  changeRequestNote?: string | null;
  changeRequestedAt?: string | null;
  createdAt?: string | null;
  sentAt?: string | null;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  lines: QuotationLineView[];
}

/** One requested line. Mirrors QuotationAdminController.LineRequest. */
export interface CreateQuotationLineRequest {
  productId: string;
  /** Required by the backend for a product that has variants. */
  variantId?: string;
  quantity: number;
  rentalDays: number;
}

/**
 * Mirrors QuotationAdminController.CreateQuotationRequest.
 *
 * No line prices are sent. QuotationService reads each product's rate out of
 * master data at pricing time and stores the result, which is the same reason
 * QuotationView's totals are stored rather than recomputed on read. The
 * security deposit is the exception, and this UI's addition to the real
 * request: products no longer carry one, so it is set for the booking as a
 * whole and sent as a single amount.
 * sourceReference is not sent either — the controller stamps "admin-ui" itself,
 * so a quotation raised here is distinguishable from a storefront one without
 * the client being trusted to say so.
 */
export interface CreateQuotationRequest {
  /**
   * The customer the quotation is for — the stable reference orders, deposits
   * and credit notes follow. Optional on the real controller, which predates a
   * customer list; this UI always sends one, and the mock requires it.
   */
  customerId: string;
  /**
   * Copies taken when the quotation is saved. The real controller stores what
   * it is sent; the mock takes both from the customer record instead, so the
   * copy can never disagree with the id it sits beside.
   */
  customerName: string;
  customerEmail?: string;
  /** ISO yyyy-MM-dd, or omitted. Java parses it as a LocalDate. */
  eventDate?: string;
  /** In INR, zero or more. Stored as the quotation's totalSecurityDeposit. */
  securityDeposit: number;
  /** Actual delivery cost in INR, entered by staff; part of the total. Omitted: none. */
  deliveryCharge?: number;
  /** A flat amount off in INR. Omitted: none. */
  discountAmount?: number;
  /** ISO yyyy-MM-dd. Omitted: the backend's default validity (15 days) applies. */
  validUntil?: string;
  lines: CreateQuotationLineRequest[];
}

/**
 * One line of an edit. `lineId` names an existing line, which keeps the
 * per-day rate it was priced at; a line without one is new and is priced from
 * the product's current retail rate. An existing line's product cannot change —
 * that is a different line, so it is sent without a lineId.
 */
export interface UpdateQuotationLineRequest {
  lineId?: string;
  productId: string;
  variantId?: string;
  quantity: number;
  rentalDays: number;
}

/**
 * Edits a quotation that has not been converted. There is no update endpoint
 * on the real controller; this is this UI's proposal, and the complete line
 * list — a line left out is removed.
 */
export interface UpdateQuotationRequest {
  customerId: string;
  /** ISO yyyy-MM-dd, or omitted to clear it. */
  eventDate?: string;
  securityDeposit: number;
  deliveryCharge?: number;
  discountAmount?: number;
  lines: UpdateQuotationLineRequest[];
}

/** One version sent to the customer (QuotationVersionView on the backend). */
export interface QuotationVersionView {
  versionNo: number;
  sentAt: string;
  validUntil?: string | null;
  subtotalAmount: Money;
  deliveryCharge: Money;
  discountAmount: Money;
  totalAmount: Money;
  securityDeposit: Money;
  lines: { productName: string; quantity: number; rentalDays: number; lineTotal: Money }[];
}

export interface QuotationTax {
  rate: number | null;
  taxableAmount: Money;
  cgst: Money;
  sgst: Money;
  igst: Money;
  placeOfSupply: string | null;
  intraState: boolean;
}

export interface QuotationVenue {
  text: string;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
}

/** The customer's plan as staff read it (read-only). */
export interface QuotationPlan {
  subEvents: {
    id: string;
    name: string;
    scheduledOn?: string | null;
    venueDetail?: { label: string; addressText: string } | null;
    items: { id: string; productName: string; quantity: number; rentalDays: number; subEventIds: string[] }[];
  }[];
  generalItems: { id: string; productName: string; quantity: number; rentalDays: number; subEventIds: string[] }[];
}

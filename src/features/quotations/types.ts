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
  productName: string;
  quantity: number;
  rentalDays: number;
  unitRatePerDay: Money;
  lineTotal: Money;
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
  lines: QuotationLineView[];
}

/** One requested line. Mirrors QuotationAdminController.LineRequest. */
export interface CreateQuotationLineRequest {
  productId: string;
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
  lines: UpdateQuotationLineRequest[];
}

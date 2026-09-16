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

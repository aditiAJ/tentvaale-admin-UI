import type { QuotationStatus, QuotationView } from "@/features/quotations/types";

/** Quotations raised from a customer's plan on the storefront carry this reference prefix. */
const STOREFRONT_PREFIX = "storefront-plan:";

export const isFromStorefront = (quotation: Pick<QuotationView, "sourceReference">) =>
  quotation.sourceReference?.startsWith(STOREFRONT_PREFIX) ?? false;

/**
 * The list a quotation sits in. A storefront request that staff have not sent yet (new, or sent back
 * by the customer asking for changes) is "Received": it is waiting on the team, not a draft anyone
 * started. Staff-raised drafts stay "Draft".
 */
export type QuotationBucket = QuotationStatus | "RECEIVED";

export const bucketOf = (quotation: QuotationView): QuotationBucket =>
  quotation.status === "DRAFT" && isFromStorefront(quotation) ? "RECEIVED" : quotation.status;

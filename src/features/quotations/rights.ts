"use client";

import { useCan } from "@/features/auth";
import type { QuotationStatus } from "@/features/quotations/types";

/**
 * Who may change a quotation depends on where it has got to; the server decides the same way. A draft and a quotation
 * the customer already has are different rights, and once there is an order, moving its venue or date is changing the
 * order.
 */
export function useQuotationRights() {
  const draft = useCan("QUOTATION_EDIT_DRAFT");
  const sent = useCan("QUOTATION_EDIT_SENT");
  const order = useCan("ORDER_EDIT");
  return {
    /** Items, prices and charges. The status rules (only a draft or sent quotation) are checked separately. */
    mayEditLines: (status: QuotationStatus) => (status === "DRAFT" ? draft : sent),
    /** Venue and event date, which stay correctable for longer. */
    mayMove: (status: QuotationStatus) => (status === "CONVERTED" ? order : status === "DRAFT" ? draft : sent),
  };
}

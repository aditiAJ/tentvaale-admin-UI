import type { Money } from "@/lib/money";

/**
 * Mirrors com.tentvaale.creditnote.api.CreditNoteStatus.
 *
 * Only ISSUED is ever actually set: CreditNote.issue() writes it and nothing
 * else transitions. Apply, cancel and reverse live in stored procedures that
 * have not been read, so appliedAmount never moves off zero in the rebuild
 * and the other three states are unreachable today.
 */
export const CREDIT_NOTE_STATUSES = ["ISSUED", "APPLIED", "CANCELLED", "REVERSED"] as const;
export type CreditNoteStatus = (typeof CREDIT_NOTE_STATUSES)[number];

/**
 * The statuses that count toward a customer's available credit, copied from
 * CreditNoteService.LIVE_STATUSES. APPLIED and CANCELLED notes do not count.
 */
export const LIVE_STATUSES: CreditNoteStatus[] = ["ISSUED", "REVERSED"];

/** Mirrors com.tentvaale.creditnote.api.CreditNoteView. `remaining` is computed
 *  on the backend record rather than stored, so it is derived here too. */
export interface CreditNoteView {
  id: string;
  companyId: string;
  creditNoteNumber: string;
  customerId: string;
  /** A note may be issued against an order, or stand alone as goodwill credit. */
  againstOrderId: string | null;
  amount: Money;
  appliedAmount: Money;
  status: CreditNoteStatus;
  issuedOn: string;
  reason: string | null;
}

export interface CustomerCreditBalance {
  availableCredit: Money;
}

export interface IssueCreditNoteRequest {
  customerId: string;
  againstOrderId?: string;
  amount: number;
  reason?: string;
}

import type { Money } from "@/lib/money";

/**
 * Mirrors com.tentvaale.creditnote.api.CreditNoteStatus.
 *
 * ISSUED is live credit, and stays ISSUED while it is partly applied. It
 * becomes APPLIED once nothing remains. CANCELLED voids a note nothing was
 * applied from; REVERSED voids whatever remains of one, leaving what was
 * already applied where it went.
 */
export const CREDIT_NOTE_STATUSES = ["ISSUED", "APPLIED", "CANCELLED", "REVERSED"] as const;
export type CreditNoteStatus = (typeof CREDIT_NOTE_STATUSES)[number];

/**
 * The statuses whose remaining credit counts toward a customer's available
 * credit. CreditNoteService.LIVE_STATUSES also lists REVERSED; here a reversal
 * invalidates the unused remainder, so a reversed note contributes nothing and
 * only ISSUED is live. APPLIED would contribute nothing either way.
 */
export const LIVE_STATUSES: CreditNoteStatus[] = ["ISSUED"];

/** One use of a note's credit against an order. */
export interface CreditNoteApplicationView {
  id: string;
  orderId: string;
  amount: Money;
  appliedOn: string;
}

/** Mirrors com.tentvaale.creditnote.api.CreditNoteView, plus the applications
 *  that make up `appliedAmount`. */
export interface CreditNoteView {
  id: string;
  companyId: string;
  creditNoteNumber: string;
  customerId: string;
  /** A note may be issued against an order, or stand alone as goodwill credit. */
  againstOrderId: string | null;
  amount: Money;
  /** The sum of `applications`. Never more than `amount`. */
  appliedAmount: Money;
  applications: CreditNoteApplicationView[];
  status: CreditNoteStatus;
  issuedOn: string;
  reason: string | null;
}

/** What is still available on a note: the unapplied amount while it is live, otherwise nothing. */
export function remainingCredit(note: CreditNoteView): number {
  if (!LIVE_STATUSES.includes(note.status)) return 0;
  return Math.max(Number(note.amount.amount) - Number(note.appliedAmount.amount), 0);
}

/** What a reversal took out of circulation: the part that had not been applied. */
export function reversedCredit(note: CreditNoteView): number {
  if (note.status !== "REVERSED") return 0;
  return Math.max(Number(note.amount.amount) - Number(note.appliedAmount.amount), 0);
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

export interface ApplyCreditNoteRequest {
  orderId: string;
  amount: number;
}

import * as backend from "@/features/credit-notes/api/backend";
import { IS_MOCK } from "@/services/data-source";
import {
  mockApplyCreditNote,
  mockCancelCreditNote,
  mockGetCustomerCreditBalance,
  mockIssueCreditNote,
  mockListAllCreditNotes,
  mockListCreditNotesByCustomer,
  mockReverseCreditNote,
} from "@/mock-data/store";
import type {
  ApplyCreditNoteRequest,
  CreditNoteStatus,
  CreditNoteView,
  CustomerCreditBalance,
  IssueCreditNoteRequest,
} from "@/features/credit-notes/types";


/**
 * Every credit note of the company, newest first, optionally narrowed by status and by text
 * (note number, customer name, reason or order number). One request, not one per customer.
 */
export function listCreditNotes(
  options: { status?: CreditNoteStatus; q?: string } = {},
  signal?: AbortSignal,
): Promise<CreditNoteView[]> {
  if (IS_MOCK) return mockListAllCreditNotes();
  return backend.listCreditNotes(options, signal);
}

/** One customer's notes, newest first. */
export function listCreditNotesByCustomer(
  customerId: string,
  signal?: AbortSignal,
): Promise<CreditNoteView[]> {
  if (IS_MOCK) return mockListCreditNotesByCustomer(customerId);
  return backend.listCreditNotesByCustomer(customerId, signal);
}

/** Sums what remains on the customer's ISSUED notes. */
export function getCustomerCreditBalance(
  customerId: string,
  signal?: AbortSignal,
): Promise<CustomerCreditBalance> {
  if (IS_MOCK) return mockGetCustomerCreditBalance(customerId);
  return backend.getCustomerCreditBalance(customerId, signal);
}

/**
 * 404 for an unknown customer or order; 422 for an order of another customer, or an amount above
 * the total of the order it is issued against (goodwill credit has no limit).
 */
export function issueCreditNote(request: IssueCreditNoteRequest): Promise<CreditNoteView> {
  if (IS_MOCK) return mockIssueCreditNote(request);
  return backend.issueCreditNote(request);
}

/**
 * Apply: 422 unless the note is ISSUED, the order is the same customer's and open (not cancelled,
 * not completed), and the amount is no more than what remains on the note nor more than the room
 * left on the order's total once all credit already applied to it is counted.
 */
export function applyCreditNote(
  creditNoteId: string,
  request: ApplyCreditNoteRequest,
): Promise<CreditNoteView> {
  if (IS_MOCK) return mockApplyCreditNote(creditNoteId, request);
  return backend.applyCreditNote(creditNoteId, request);
}

/** 422 unless the note is ISSUED with nothing applied. */
export function cancelCreditNote(creditNoteId: string): Promise<CreditNoteView> {
  if (IS_MOCK) return mockCancelCreditNote(creditNoteId);
  return backend.cancelCreditNote(creditNoteId);
}

/** 422 unless the note is ISSUED; what was applied stays applied. Administrators only (403 otherwise). */
export function reverseCreditNote(creditNoteId: string): Promise<CreditNoteView> {
  if (IS_MOCK) return mockReverseCreditNote(creditNoteId);
  return backend.reverseCreditNote(creditNoteId);
}

export const creditNoteKeys = {
  list: ["credit-notes", "list"] as const,
  byCustomer: (customerId: string) => ["credit-notes", "by-customer", customerId] as const,
  balance: (customerId: string) => ["credit-notes", "balance", customerId] as const,
};

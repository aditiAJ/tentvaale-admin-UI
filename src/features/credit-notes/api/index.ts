import { apiFetch } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";
import {
  mockApplyCreditNote,
  mockCancelCreditNote,
  mockGetCustomerCreditBalance,
  mockIssueCreditNote,
  mockListCreditNotesByCustomer,
  mockReverseCreditNote,
} from "@/mock-data/store";
import type {
  ApplyCreditNoteRequest,
  CreditNoteView,
  CustomerCreditBalance,
  IssueCreditNoteRequest,
} from "@/features/credit-notes/types";

const base = (customerId: string) =>
  `/admin/credit-notes/by-customer/${encodeURIComponent(customerId)}`;

/**
 * Real, and works in api mode — but only per customer. There is no
 * company-wide list, so "what credit is outstanding across the business?" is
 * a question the back office cannot ask; you look a customer up.
 */
export function listCreditNotesByCustomer(
  customerId: string,
  signal?: AbortSignal,
): Promise<CreditNoteView[]> {
  if (IS_MOCK) return mockListCreditNotesByCustomer(customerId);
  return apiFetch<CreditNoteView[]>(base(customerId), { signal });
}

/** Sums what remains on the customer's ISSUED notes. */
export function getCustomerCreditBalance(
  customerId: string,
  signal?: AbortSignal,
): Promise<CustomerCreditBalance> {
  if (IS_MOCK) return mockGetCustomerCreditBalance(customerId);
  return apiFetch<CustomerCreditBalance>(`${base(customerId)}/balance`, { signal });
}

/**
 * 404 for an unknown customer or order; 422 for an amount that is not
 * positive with at most two decimals, or an order of another customer.
 */
export function issueCreditNote(request: IssueCreditNoteRequest): Promise<CreditNoteView> {
  if (IS_MOCK) return mockIssueCreditNote(request);
  return apiFetch<CreditNoteView>("/admin/credit-notes", { method: "POST", body: request });
}

const note = (creditNoteId: string) => `/admin/credit-notes/${encodeURIComponent(creditNoteId)}`;

/**
 * Apply, cancel and reverse have no endpoint on the real controller — they
 * follow the POST /{resource}/{id}/{action} shape of the deposit transitions
 * and 404 in api mode.
 *
 * Apply: 422 unless the note is ISSUED, the order is the same customer's and
 * not cancelled, and the amount is no more than what remains.
 */
export function applyCreditNote(
  creditNoteId: string,
  request: ApplyCreditNoteRequest,
): Promise<CreditNoteView> {
  if (IS_MOCK) return mockApplyCreditNote(creditNoteId, request);
  return apiFetch<CreditNoteView>(`${note(creditNoteId)}/apply`, { method: "POST", body: request });
}

/** 422 unless the note is ISSUED with nothing applied. */
export function cancelCreditNote(creditNoteId: string): Promise<CreditNoteView> {
  if (IS_MOCK) return mockCancelCreditNote(creditNoteId);
  return apiFetch<CreditNoteView>(`${note(creditNoteId)}/cancel`, { method: "POST" });
}

/** 422 unless the note is ISSUED; what was applied stays applied. */
export function reverseCreditNote(creditNoteId: string): Promise<CreditNoteView> {
  if (IS_MOCK) return mockReverseCreditNote(creditNoteId);
  return apiFetch<CreditNoteView>(`${note(creditNoteId)}/reverse`, { method: "POST" });
}

export const creditNoteKeys = {
  byCustomer: (customerId: string) => ["credit-notes", "by-customer", customerId] as const,
  balance: (customerId: string) => ["credit-notes", "balance", customerId] as const,
};

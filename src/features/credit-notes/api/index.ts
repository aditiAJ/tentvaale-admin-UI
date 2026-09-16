import { apiFetch } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";
import {
  mockGetCustomerCreditBalance,
  mockIssueCreditNote,
  mockListCreditNotesByCustomer,
} from "@/mock-data/store";
import type {
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

/** Sums amount - appliedAmount across ISSUED and REVERSED notes only. */
export function getCustomerCreditBalance(
  customerId: string,
  signal?: AbortSignal,
): Promise<CustomerCreditBalance> {
  if (IS_MOCK) return mockGetCustomerCreditBalance(customerId);
  return apiFetch<CustomerCreditBalance>(`${base(customerId)}/balance`, { signal });
}

/** 422 if the amount is not positive. */
export function issueCreditNote(request: IssueCreditNoteRequest): Promise<CreditNoteView> {
  if (IS_MOCK) return mockIssueCreditNote(request);
  return apiFetch<CreditNoteView>("/admin/credit-notes", { method: "POST", body: request });
}

export const creditNoteKeys = {
  byCustomer: (customerId: string) => ["credit-notes", "by-customer", customerId] as const,
  balance: (customerId: string) => ["credit-notes", "balance", customerId] as const,
};

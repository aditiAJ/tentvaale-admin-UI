import { apiFetch } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";
import { mockCreateQuotation, mockGetQuotation, mockUpdateQuotation } from "@/mock-data/store";
import type {
  CreateQuotationRequest,
  QuotationView,
  UpdateQuotationRequest,
} from "@/features/quotations/types";

/**
 * Get-by-id is real — QuotationAdminController exposes it and this call works
 * in api mode. What does not exist is a list: QuotationRepository has no
 * company-scoped find-all, only findByIdAndCompanyId and a status count for
 * the dashboard. So this screen looks one up rather than browsing, the same
 * shape the deposits screen settled on for the same reason.
 *
 * 404 when the id is unknown or belongs to another company.
 */
export function getQuotation(quotationId: string, signal?: AbortSignal): Promise<QuotationView> {
  if (IS_MOCK) return mockGetQuotation(quotationId);
  return apiFetch<QuotationView>(`/admin/quotations/${encodeURIComponent(quotationId)}`, {
    signal,
  });
}

/**
 * Create is real, and has been since before this screen existed — the storefront
 * reaches the same QuotationService through ordering. It needs QUOTATION_WRITE
 * and answers 201 with the priced quotation, so the response is the record
 * itself rather than an id to go and fetch.
 *
 * 422 when there are no lines, a quantity or day count is below 1, or a product
 * id does not belong to this company.
 */
export function createQuotation(request: CreateQuotationRequest): Promise<QuotationView> {
  if (IS_MOCK) return mockCreateQuotation(request);
  return apiFetch<QuotationView>("/admin/quotations", { method: "POST", body: request });
}

/**
 * Editing has no endpoint on the real controller — this follows the same
 * PUT /{resource}/{id} shape as the other proposed writes and 404s in api mode.
 * Existing lines keep the rate they were priced at; new lines are priced now.
 * 422 once the quotation has been converted to an order.
 */
export function updateQuotation(
  quotationId: string,
  request: UpdateQuotationRequest,
): Promise<QuotationView> {
  if (IS_MOCK) return mockUpdateQuotation(quotationId, request);
  return apiFetch<QuotationView>(`/admin/quotations/${encodeURIComponent(quotationId)}`, {
    method: "PUT",
    body: request,
  });
}

export const quotationKeys = {
  byId: (quotationId: string) => ["quotations", quotationId] as const,
};

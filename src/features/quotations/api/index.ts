import { apiFetch } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";
import { mockGetQuotation } from "@/mock-data/store";
import type { QuotationView } from "@/features/quotations/types";

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

export const quotationKeys = {
  byId: (quotationId: string) => ["quotations", quotationId] as const,
};

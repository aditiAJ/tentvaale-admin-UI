import { apiFetch } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";
import { mockCreateOrderFromQuotation, mockGetOrder } from "@/mock-data/store";
import type { OrderView } from "@/features/orders/types";

/**
 * As with quotations, get-by-id is real and works in api mode; there is no
 * list endpoint. SalesOrderRepository can count orders and sum their value —
 * which is what the dashboard uses — but cannot return them.
 *
 * 404 when the id is unknown or belongs to another company.
 */
export function getOrder(orderId: string, signal?: AbortSignal): Promise<OrderView> {
  if (IS_MOCK) return mockGetOrder(orderId);
  return apiFetch<OrderView>(`/admin/orders/${encodeURIComponent(orderId)}`, { signal });
}

/**
 * Converts a quotation into a confirmed order. Needs ORDER_WRITE, and answers
 * 201 with the order itself.
 *
 * It also marks the quotation CONVERTED, in the same transaction — so the
 * caller's copy of that quotation is stale the moment this resolves, and the
 * screen that triggered it has to refetch rather than trust what it is holding.
 *
 * 422 when the quotation already has an order, 404 when it does not exist or
 * belongs to another company.
 */
export function createOrderFromQuotation(quotationId: string): Promise<OrderView> {
  if (IS_MOCK) return mockCreateOrderFromQuotation(quotationId);
  return apiFetch<OrderView>("/admin/orders/from-quotation", {
    method: "POST",
    body: { quotationId },
  });
}

export const orderKeys = {
  byId: (orderId: string) => ["orders", orderId] as const,
};

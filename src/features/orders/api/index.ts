import { apiFetch } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";
import { mockGetOrder } from "@/mock-data/store";
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

export const orderKeys = {
  byId: (orderId: string) => ["orders", orderId] as const,
};

import { apiFetch } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";
import {
  mockCancelOrder,
  mockCompleteOrder,
  mockCreateOrderFromQuotation,
  mockGetOrder,
  mockListOrders,
  mockListOrdersByCustomer,
} from "@/mock-data/store";
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
 * It also marks the quotation CONVERTED and opens a HELD deposit for the
 * order's security deposit, in the same transaction — so the caller's copy of
 * that quotation is stale the moment this resolves, and the screen that
 * triggered it has to refetch rather than trust what it is holding.
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

/**
 * Cancelling has no endpoint on the real controller — this follows the same
 * POST /{resource}/{id}/{action} shape as the deposit transitions and 404s in
 * api mode. Only a CONFIRMED order can be cancelled; its held deposit moves to
 * REFUND_PENDING, and nothing moves in stock because nothing was dispatched.
 */
export function cancelOrder(orderId: string): Promise<OrderView> {
  if (IS_MOCK) return mockCancelOrder(orderId);
  return apiFetch<OrderView>(`/admin/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: "POST",
  });
}

/**
 * Proposed, like cancel. 422 unless the order is RETURNED and its deposit is
 * REFUNDED or FORFEITED.
 */
export function completeOrder(orderId: string): Promise<OrderView> {
  if (IS_MOCK) return mockCompleteOrder(orderId);
  return apiFetch<OrderView>(`/admin/orders/${encodeURIComponent(orderId)}/complete`, {
    method: "POST",
  });
}

/**
 * Proposed: there is no list endpoint, so this 404s in api mode. One
 * customer's orders, for the screens that pick an order for a customer.
 */
export function listOrdersByCustomer(customerId: string, signal?: AbortSignal): Promise<OrderView[]> {
  if (IS_MOCK) return mockListOrdersByCustomer(customerId);
  return apiFetch<OrderView[]>(`/admin/orders/by-customer/${encodeURIComponent(customerId)}`, {
    signal,
  });
}

/**
 * Proposed: there is no list endpoint, so this 404s in api mode. Every order
 * for the company, for the order workspace to browse.
 */
export function listOrders(signal?: AbortSignal): Promise<OrderView[]> {
  if (IS_MOCK) return mockListOrders();
  return apiFetch<OrderView[]>("/admin/orders/list", { signal });
}

export const orderKeys = {
  byId: (orderId: string) => ["orders", orderId] as const,
  list: ["orders", "list"] as const,
  byCustomer: (customerId: string) => ["orders", "by-customer", customerId] as const,
};

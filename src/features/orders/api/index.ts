import { IS_MOCK } from "@/services/data-source";
import {
  mockCancelOrder,
  mockCompleteOrder,
  mockCreateOrderFromQuotation,
  mockGetOrder,
  mockListOrders,
  mockListOrdersByCustomer,
} from "@/mock-data/store";
import * as backend from "@/features/orders/api/backend";
import type { OrderView } from "@/features/orders/types";

/**
 * Orders. In api mode every call goes to OrderAdminController through `./backend`.
 *
 * Statuses are never set by hand: dispatches and returns (inventory) move an order to DISPATCHED
 * and RETURNED, and these calls cover the manual steps, convert, cancel and complete. The backend
 * decides what is allowed and answers 422 with a sentence for the user, 403 without permission and
 * 409 when someone changed the record at the same time.
 *
 * 404 when the id is unknown or belongs to another company.
 */
export function getOrder(orderId: string, signal?: AbortSignal): Promise<OrderView> {
  if (IS_MOCK) return mockGetOrder(orderId);
  return backend.getOrder(orderId, signal);
}

/**
 * Converts a quotation into a confirmed order. Needs ORDER_WRITE, and only an ACCEPTED quotation
 * converts (422 otherwise). It also marks the quotation CONVERTED and holds the deposit in the
 * same step, so the caller's copy of the quotation is stale as soon as this resolves.
 */
export function createOrderFromQuotation(quotationId: string): Promise<OrderView> {
  if (IS_MOCK) return mockCreateOrderFromQuotation(quotationId);
  return backend.createOrderFromQuotation(quotationId);
}

/**
 * Only a CONFIRMED order (nothing dispatched) can be cancelled; its held deposit moves to REFUND
 * PENDING. The reason is optional.
 */
export function cancelOrder(orderId: string, reason?: string): Promise<OrderView> {
  if (IS_MOCK) return mockCancelOrder(orderId);
  return backend.cancelOrder(orderId, reason);
}

/** 422 unless the order is RETURNED and its deposit is settled (or it has none). */
export function completeOrder(orderId: string): Promise<OrderView> {
  if (IS_MOCK) return mockCompleteOrder(orderId);
  return backend.completeOrder(orderId);
}

/** One customer's orders: the same list endpoint, filtered by customer. */
export function listOrdersByCustomer(customerId: string, signal?: AbortSignal): Promise<OrderView[]> {
  if (IS_MOCK) return mockListOrdersByCustomer(customerId);
  return backend.listOrders(customerId, signal);
}

/** Every order for the company, newest first. */
export function listOrders(signal?: AbortSignal): Promise<OrderView[]> {
  if (IS_MOCK) return mockListOrders();
  return backend.listOrders(undefined, signal);
}

export const orderKeys = {
  byId: (orderId: string) => ["orders", orderId] as const,
  list: ["orders", "list"] as const,
  byCustomer: (customerId: string) => ["orders", "by-customer", customerId] as const,
};

import { apiFetch } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";
import {
  mockDeriveAvailability,
  mockListStockMovementsByOrder,
  mockRecordStockMovement,
} from "@/mock-data/store";
import type {
  AvailabilityRow,
  RecordStockMovementRequest,
  StockMovementView,
} from "@/features/inventory/types";

/**
 * Real, and works in api mode: movements can be recorded and read back per
 * order. What is missing is any way to browse them — StockMovementRepository
 * has only findByCompanyIdAndOrderIdOrderByMovedOnDesc, so "what went out
 * this week?" has no query behind it.
 *
 * An order with no movements returns an empty list, not a 404.
 */
export function listStockMovementsByOrder(
  orderId: string,
  signal?: AbortSignal,
): Promise<StockMovementView[]> {
  if (IS_MOCK) return mockListStockMovementsByOrder(orderId);
  return apiFetch<StockMovementView[]>(
    `/admin/inventory/stock-movements/by-order/${encodeURIComponent(orderId)}`,
    { signal },
  );
}

/**
 * Records a dispatch or a return. Needs INVENTORY_WRITE, and answers 201 with
 * the movement.
 *
 * 404 when the order, warehouse, product or variant does not exist; 422 when
 * the order's status does not allow the direction, a line is not on the
 * order, or the warehouse cannot supply (outward) or did not send (inward) the
 * quantity. It moves the order to DISPATCHED or RETURNED — see
 * RecordStockMovementRequest — so the caller's copy of the order is stale.
 */
export function recordStockMovement(
  request: RecordStockMovementRequest,
): Promise<StockMovementView> {
  if (IS_MOCK) return mockRecordStockMovement(request);
  return apiFetch<StockMovementView>("/admin/inventory/stock-movements", {
    method: "POST",
    body: request,
  });
}

/**
 * Availability has no endpoint and no table — it is derived, and the legacy
 * derivation lives in stored procedures that have not been read. There is
 * nothing to call in api mode, so this is mock-only by construction rather
 * than by a missing route: calling it against a real backend would only
 * produce a 404 for a path nobody has designed yet.
 */
export function deriveAvailability(): Promise<AvailabilityRow[]> {
  if (IS_MOCK) return mockDeriveAvailability();
  return Promise.reject(
    new Error("Availability is not implemented on the backend — there is no endpoint to call."),
  );
}

export const inventoryKeys = {
  movementsByOrder: (orderId: string) => ["inventory", "movements", orderId] as const,
  availability: ["inventory", "availability"] as const,
};

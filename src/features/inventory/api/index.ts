import * as backend from "@/features/inventory/api/backend";
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
 * Movements read back per order, newest first. There is still no way to browse them across
 * orders ("what went out this week?" has no query behind it).
 *
 * An order with no movements returns an empty list, not a 404.
 */
export function listStockMovementsByOrder(
  orderId: string,
  signal?: AbortSignal,
): Promise<StockMovementView[]> {
  if (IS_MOCK) return mockListStockMovementsByOrder(orderId);
  return backend.listStockMovementsByOrder(orderId, signal);
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
  return backend.recordStockMovement(request);
}

/**
 * Current stock per product: on the shelf now, and out on rent. Counts only: nothing here is
 * date-based or holds stock back for orders that have not been dispatched yet (PRD §9).
 */
export function deriveAvailability(signal?: AbortSignal): Promise<AvailabilityRow[]> {
  if (IS_MOCK) return mockDeriveAvailability();
  return backend.deriveAvailability(signal);
}

export const inventoryKeys = {
  movementsByOrder: (orderId: string) => ["inventory", "movements", orderId] as const,
  availability: ["inventory", "availability"] as const,
};

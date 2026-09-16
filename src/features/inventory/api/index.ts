import { apiFetch } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";
import { mockDeriveAvailability, mockListStockMovementsByOrder } from "@/mock-data/store";
import type { AvailabilityRow, StockMovementView } from "@/features/inventory/types";

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

import { apiFetch } from "@/services/api-client";
import type {
  AvailabilityRow,
  MovedLineView,
  RecordStockMovementRequest,
  StockMovementFilters,
  StockMovementRow,
  StockMovementView,
} from "@/features/inventory/types";

/**
 * Real-backend side of inventory: the wire shapes of StockMovementAdminController and the mapping to
 * the shapes the screens were built on.
 *
 * The backend speaks numeric ids for products, variants, warehouses and companies; the screens
 * compare string ids (an order line's productId against a movement line's), so every id is turned
 * into a string here. Without that, nothing on an order screen matches its movements and an order
 * that has been fully dispatched still reads "0 / 12 dispatched".
 */

const BASE = "/admin/inventory";

interface WireMovedLine {
  id: string;
  productId: number;
  variantId?: number | null;
  quantity: number;
}

interface WireMovement {
  id: string;
  companyId: number;
  orderId: string;
  movementNumber: string;
  direction: StockMovementView["direction"];
  movedOn: string;
  warehouseId?: number | null;
  remarks?: string | null;
  lines: WireMovedLine[];
}

interface WireMovementRow extends WireMovement {
  orderNumber?: string | null;
}

interface WireAvailability {
  productId: number;
  sku: string;
  productName: string;
  inStock: number;
  onRent: number;
  variants: { variantId: number; variantName: string; inStock: number; onRent: number }[];
}

function lineFromWire(line: WireMovedLine): MovedLineView {
  return {
    id: line.id,
    productId: String(line.productId),
    variantId: line.variantId == null ? null : String(line.variantId),
    quantity: line.quantity,
  };
}

function movementFromWire(movement: WireMovement): StockMovementView {
  return {
    id: movement.id,
    companyId: String(movement.companyId),
    orderId: movement.orderId,
    movementNumber: movement.movementNumber,
    direction: movement.direction,
    movedOn: movement.movedOn,
    warehouseId: movement.warehouseId == null ? null : String(movement.warehouseId),
    remarks: movement.remarks ?? null,
    lines: movement.lines.map(lineFromWire),
  };
}

/**
 * Movements across every order, newest first, narrowed by direction, order, or text (movement or
 * order number). Nothing matching is an empty list, not an error.
 */
export async function listStockMovements(
  filters: StockMovementFilters,
  signal?: AbortSignal,
): Promise<StockMovementRow[]> {
  const params = new URLSearchParams({ limit: String(filters.limit) });
  if (filters.direction) params.set("direction", filters.direction);
  if (filters.orderId) params.set("orderId", filters.orderId);
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  const rows = await apiFetch<WireMovementRow[]>(`${BASE}/stock-movements?${params}`, { signal });
  return rows.map((row) => ({ ...movementFromWire(row), orderNumber: row.orderNumber ?? null }));
}

/** Newest first. An order with no movements returns an empty list, not a 404. */
export async function listStockMovementsByOrder(
  orderId: string,
  signal?: AbortSignal,
): Promise<StockMovementView[]> {
  const rows = await apiFetch<WireMovement[]>(
    `${BASE}/stock-movements/by-order/${encodeURIComponent(orderId)}`,
    { signal },
  );
  return rows.map(movementFromWire);
}

export async function recordStockMovement(
  request: RecordStockMovementRequest,
): Promise<StockMovementView> {
  const created = await apiFetch<WireMovement>(`${BASE}/stock-movements`, {
    method: "POST",
    body: {
      orderId: request.orderId,
      direction: request.direction,
      movedOn: request.movedOn || undefined,
      warehouseId: Number(request.warehouseId),
      remarks: request.remarks || undefined,
      lines: request.lines.map((line) => ({
        productId: Number(line.productId),
        variantId: line.variantId ? Number(line.variantId) : undefined,
        quantity: line.quantity,
      })),
    },
  });
  return movementFromWire(created);
}

/** Current counts per product: on the shelf now, and out on rent. Not date-based (PRD §9). */
export async function deriveAvailability(signal?: AbortSignal): Promise<AvailabilityRow[]> {
  const rows = await apiFetch<WireAvailability[]>(`${BASE}/availability`, { signal });
  return rows.map((row) => ({
    productId: String(row.productId),
    productName: row.productName,
    sku: row.sku,
    inStock: row.inStock,
    onRent: row.onRent,
  }));
}

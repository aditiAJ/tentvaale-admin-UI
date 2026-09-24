/** Mirrors com.tentvaale.inventory.api.MovementDirection. */
export const MOVEMENT_DIRECTIONS = ["OUTWARD", "INWARD"] as const;
export type MovementDirection = (typeof MOVEMENT_DIRECTIONS)[number];

export const DIRECTION_MEANING: Record<MovementDirection, string> = {
  OUTWARD: "Goods dispatched to the customer.",
  INWARD: "Goods returned to the warehouse.",
};

/**
 * Mirrors com.tentvaale.inventory.api.MovedLineView, plus the variant: stock
 * is held per warehouse + product + variant, so a line for a product with
 * variants says which one moved. Null for a product without them.
 */
export interface MovedLineView {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
}

/**
 * Mirrors com.tentvaale.inventory.api.StockMovementView.
 *
 * warehouseId is the warehouse the goods left or came back to. Every movement
 * recorded now names one; null survives only for legacy rows. There is also deliberately no sub-event id — a movement is recorded against
 * a whole order, so a multi-event order cannot attribute stock to one event.
 */
export interface StockMovementView {
  id: string;
  companyId: string;
  orderId: string;
  movementNumber: string;
  direction: MovementDirection;
  movedOn: string;
  warehouseId: string | null;
  remarks: string | null;
  lines: MovedLineView[];
}

/**
 * Availability has no backend at all — no entity, no table, no endpoint, so
 * this shape is this UI's invention. In mock mode, in stock is the warehouse
 * counts, which movements decrease and increase, and on rent is outward minus
 * inward from the same movements.
 */
export interface AvailabilityRow {
  productId: string;
  productName: string;
  sku: string;
  /** On the shelf, summed across warehouses and variants. */
  inStock: number;
  /** Dispatched and not yet returned. */
  onRent: number;
}

/**
 * One line of a movement. Mirrors StockMovementAdminController.MovementLineRequest,
 * plus the variant, which is required for a product with variants and must be
 * absent for one without.
 */
export interface RecordMovementLineRequest {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

/**
 * Mirrors StockMovementAdminController.RecordMovementRequest.
 *
 * `movedOn` is optional because the controller substitutes today when it is
 * absent. `warehouseId` is required: stock is taken from, or put back into,
 * that warehouse. There is still no sub-event id, deliberately — a movement
 * belongs to a whole order, so a multi-event order cannot say which event the
 * stock went to.
 *
 * The movement drives the order: an outward one dispatches a CONFIRMED order,
 * and the inward one that brings the last of its goods back makes it RETURNED.
 * Lines must be products on the order, outward never more than was ordered or
 * than the warehouse holds, inward never more than is out from that warehouse.
 */
export interface RecordStockMovementRequest {
  orderId: string;
  direction: MovementDirection;
  movedOn?: string;
  warehouseId: string;
  remarks?: string;
  lines: RecordMovementLineRequest[];
}

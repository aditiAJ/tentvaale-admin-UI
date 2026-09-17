/** Mirrors com.tentvaale.inventory.api.MovementDirection. */
export const MOVEMENT_DIRECTIONS = ["OUTWARD", "INWARD"] as const;
export type MovementDirection = (typeof MOVEMENT_DIRECTIONS)[number];

export const DIRECTION_MEANING: Record<MovementDirection, string> = {
  OUTWARD: "Goods dispatched to the customer.",
  INWARD: "Goods returned to the warehouse.",
};

/** Mirrors com.tentvaale.inventory.api.MovedLineView. */
export interface MovedLineView {
  id: string;
  productId: string;
  quantity: number;
}

/**
 * Mirrors com.tentvaale.inventory.api.StockMovementView.
 *
 * warehouseId is an opaque UUID the caller supplies: there is no Warehouse
 * entity behind it, no foreign key and nothing that resolves it to a name.
 * There is also deliberately no sub-event id — a movement is recorded against
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
 * Availability has no backend at all — no entity, no table, no endpoint.
 *
 * The inventory module's own TODO says availability "is derived from these
 * movements plus confirmed orders", and that the legacy calculation lives in
 * stored procedures that have not been read. This shape is therefore this
 * UI's invention, and the numbers behind it in mock mode are derived the
 * naive way (outward minus inward), which is explicitly NOT the real rule.
 */
export interface AvailabilityRow {
  productId: string;
  productName: string;
  sku: string;
  onRent: number;
}

/** One line of a movement. Mirrors StockMovementAdminController.MovementLineRequest. */
export interface RecordMovementLineRequest {
  productId: string;
  quantity: number;
}

/**
 * Mirrors StockMovementAdminController.RecordMovementRequest.
 *
 * `movedOn` is optional because the controller substitutes today when it is
 * absent; `warehouseId` is optional and opaque, since nothing resolves it.
 * There is still no sub-event id, deliberately — a movement belongs to a whole
 * order, so a multi-event order cannot say which event the stock went to.
 *
 * Note what is NOT checked: InventoryService validates the order exists and
 * that each quantity is at least 1, and nothing else. It does not compare the
 * lines against what the order contains, or against what is actually in the
 * warehouse — its own TODO says those rules live in unread stored procedures.
 * So a movement can dispatch a product the order never included.
 */
export interface RecordStockMovementRequest {
  orderId: string;
  direction: MovementDirection;
  movedOn?: string;
  warehouseId?: string;
  remarks?: string;
  lines: RecordMovementLineRequest[];
}

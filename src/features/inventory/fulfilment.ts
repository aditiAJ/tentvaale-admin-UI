import type { OrderView } from "@/features/orders/types";
import type { MovementDirection, StockMovementView } from "@/features/inventory/types";

export interface ProductFulfilment {
  ordered: number;
  dispatched: number;
  returned: number;
}

/** Goods still out from one warehouse, per product and variant. */
export interface OutstandingStock {
  warehouseId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
}

export interface OrderFulfilment {
  byProduct: Map<string, ProductFulfilment>;
  outstanding: OutstandingStock[];
  leftToDispatch: number;
  stillOut: number;
}

/**
 * Where an order's goods are, worked out from its movements the same way the
 * store checks a new one: dispatched against what was ordered per product,
 * and what is still out per warehouse + product + variant.
 */
export function orderFulfilment(order: OrderView, movements: StockMovementView[]): OrderFulfilment {
  const byProduct = new Map<string, ProductFulfilment>();
  for (const line of order.lines) {
    const entry = byProduct.get(line.productId) ?? { ordered: 0, dispatched: 0, returned: 0 };
    entry.ordered += line.quantity;
    byProduct.set(line.productId, entry);
  }

  const out = new Map<string, OutstandingStock>();
  for (const movement of movements) {
    const outward = movement.direction === "OUTWARD";
    for (const line of movement.lines) {
      const entry = byProduct.get(line.productId);
      if (entry) {
        if (outward) entry.dispatched += line.quantity;
        else entry.returned += line.quantity;
      }
      const warehouseId = movement.warehouseId ?? "";
      const key = `${warehouseId}|${line.productId}|${line.variantId ?? ""}`;
      const held = out.get(key) ?? {
        warehouseId,
        productId: line.productId,
        variantId: line.variantId ?? null,
        quantity: 0,
      };
      held.quantity += outward ? line.quantity : -line.quantity;
      out.set(key, held);
    }
  }

  const outstanding = [...out.values()].filter((entry) => entry.quantity > 0);
  return {
    byProduct,
    outstanding,
    leftToDispatch: [...byProduct.values()].reduce(
      (sum, entry) => sum + Math.max(entry.ordered - entry.dispatched, 0),
      0,
    ),
    stillOut: outstanding.reduce((sum, entry) => sum + entry.quantity, 0),
  };
}

/** The directions the order's status allows next; empty once nothing can move. */
export function allowedDirections(
  order: OrderView,
  fulfilment: OrderFulfilment,
): MovementDirection[] {
  if (order.status === "CONFIRMED") return ["OUTWARD"];
  if (order.status === "DISPATCHED") {
    return fulfilment.leftToDispatch > 0 ? ["INWARD", "OUTWARD"] : ["INWARD"];
  }
  return [];
}

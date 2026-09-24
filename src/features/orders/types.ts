import type { Money } from "@/lib/money";

/**
 * Mirrors com.tentvaale.ordermgmt.api.OrderStatus.
 *
 * Nothing sets a status directly. Conversion creates CONFIRMED; recording an
 * outward movement makes it DISPATCHED, and the inward movement that brings
 * the last of its goods back makes it RETURNED; completing needs RETURNED and a
 * refunded or forfeited deposit. Only a CONFIRMED order can be cancelled.
 */
export const ORDER_STATUSES = [
  "CONFIRMED",
  "DISPATCHED",
  "RETURNED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_MEANING: Record<OrderStatus, string> = {
  CONFIRMED: "Converted from a quotation. Nothing has been dispatched yet.",
  DISPATCHED: "Goods are out with the customer.",
  RETURNED: "Everything dispatched has come back. Settle the deposit to complete it.",
  COMPLETED: "Returned and the deposit settled. Terminal.",
  CANCELLED: "Cancelled before dispatch. Terminal.",
};

/** Mirrors com.tentvaale.ordermgmt.api.OrderLineView — copied verbatim from
 *  the quotation line it came from, with no independent pricing. */
export interface OrderLineView {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  rentalDays: number;
  lineTotal: Money;
}

/** Mirrors com.tentvaale.ordermgmt.api.OrderView. The entity is SalesOrder
 *  because ORDER is a SQL reserved word. */
export interface OrderView {
  id: string;
  companyId: string;
  orderNumber: string;
  /** The quotation this was converted from. One order per quotation. */
  quotationId: string | null;
  customerId: string | null;
  customerName: string;
  customerEmail: string | null;
  eventDate: string | null;
  status: OrderStatus;
  totalAmount: Money;
  securityDeposit: Money;
  sourceReference: string | null;
  lines: OrderLineView[];
}

/**
 * Mirrors OrderAdminController.CreateFromQuotationRequest, which is the whole
 * body: an order is assembled entirely from the quotation, so there is nothing
 * else for the caller to supply and nothing it could override.
 */
export interface CreateOrderFromQuotationRequest {
  quotationId: string;
}

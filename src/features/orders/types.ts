import type { Money } from "@/lib/money";

/**
 * Mirrors com.tentvaale.ordermgmt.api.OrderStatus.
 *
 * As with quotations there is no state machine in code: the enum's javadoc
 * says the legacy transition and cancellation rules live in stored procedures
 * that have not been read. Status is set to CONFIRMED at creation and nothing
 * in the rebuild moves it — dispatch and return are recorded as stock
 * movements without touching the order, so an order shown as CONFIRMED may
 * well have been dispatched.
 */
export const ORDER_STATUSES = [
  "CONFIRMED",
  "DISPATCHED",
  "RETURNED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

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

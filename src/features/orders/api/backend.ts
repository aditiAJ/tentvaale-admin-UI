import { apiFetch } from "@/services/api-client";
import type { Money } from "@/lib/money";
import type { OrderLineView, OrderStatus, OrderView } from "@/features/orders/types";

/**
 * Real-backend side of orders: the wire shape of OrderAdminController and the mapping to the
 * screens' shape. Customer, product and variant ids are numbers on the wire and strings on screen;
 * order and line ids are UUID strings and pass through.
 */

const BASE = "/admin/orders";

interface WireLine {
  id: string;
  productId: number;
  variantId?: number | null;
  productName: string;
  quantity: number;
  rentalDays: number;
  lineTotal: Money;
}

interface WireOrder {
  id: string;
  companyId: number;
  orderNumber: string;
  quotationId?: string | null;
  customerId?: number | null;
  customerName: string;
  customerEmail?: string | null;
  eventDate?: string | null;
  status: OrderStatus;
  totalAmount: Money;
  securityDeposit: Money;
  sourceReference?: string | null;
  createdAt?: string | null;
  dispatchedAt?: string | null;
  returnedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  lines: WireLine[];
}

function lineFromWire(line: WireLine): OrderLineView {
  return {
    id: line.id,
    productId: String(line.productId),
    variantId: line.variantId == null ? null : String(line.variantId),
    productName: line.productName,
    quantity: line.quantity,
    rentalDays: line.rentalDays,
    lineTotal: line.lineTotal,
  };
}

function fromWire(o: WireOrder): OrderView {
  return {
    id: o.id,
    companyId: String(o.companyId),
    orderNumber: o.orderNumber,
    quotationId: o.quotationId ?? null,
    customerId: o.customerId == null ? null : String(o.customerId),
    customerName: o.customerName,
    customerEmail: o.customerEmail ?? null,
    eventDate: o.eventDate ?? null,
    status: o.status,
    totalAmount: o.totalAmount,
    securityDeposit: o.securityDeposit,
    sourceReference: o.sourceReference ?? null,
    createdAt: o.createdAt ?? null,
    dispatchedAt: o.dispatchedAt ?? null,
    returnedAt: o.returnedAt ?? null,
    completedAt: o.completedAt ?? null,
    cancelledAt: o.cancelledAt ?? null,
    cancellationReason: o.cancellationReason ?? null,
    lines: o.lines.map(lineFromWire),
  };
}

const id = (value: string) => encodeURIComponent(value);

/** Every order for the company, newest first. `customerId` narrows it to one customer. */
export async function listOrders(customerId?: string, signal?: AbortSignal): Promise<OrderView[]> {
  const query = customerId ? `?customerId=${id(customerId)}` : "";
  const rows = await apiFetch<WireOrder[]>(`${BASE}${query}`, { signal });
  return rows.map(fromWire);
}

export async function getOrder(orderId: string, signal?: AbortSignal): Promise<OrderView> {
  return fromWire(await apiFetch<WireOrder>(`${BASE}/${id(orderId)}`, { signal }));
}

/** Only an ACCEPTED quotation converts. 422 otherwise, with the reason in the message. */
export async function createOrderFromQuotation(quotationId: string): Promise<OrderView> {
  return fromWire(
    await apiFetch<WireOrder>(`${BASE}/from-quotation`, { method: "POST", body: { quotationId } }),
  );
}

export async function cancelOrder(orderId: string, reason?: string): Promise<OrderView> {
  return fromWire(
    await apiFetch<WireOrder>(`${BASE}/${id(orderId)}/cancel`, {
      method: "POST",
      body: { reason: reason || undefined },
    }),
  );
}

export async function completeOrder(orderId: string): Promise<OrderView> {
  return fromWire(await apiFetch<WireOrder>(`${BASE}/${id(orderId)}/complete`, { method: "POST" }));
}

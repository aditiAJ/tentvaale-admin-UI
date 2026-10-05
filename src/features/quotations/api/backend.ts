import { apiFetch } from "@/services/api-client";
import type { Money } from "@/lib/money";
import type {
  QuotationVersionView,
  CreateQuotationRequest,
  QuotationLineView,
  QuotationStatus,
  QuotationView,
  UpdateQuotationRequest,
} from "@/features/quotations/types";

/**
 * Real-backend side of quotations: the wire shape of QuotationAdminController, and the mapping to
 * the shape the screens use.
 *
 * Differences handled here: the backend names the deposit `securityDeposit` (the screens say
 * `totalSecurityDeposit`), master-data ids (customer, product, variant) are numbers where the
 * screens carry strings, and Jackson leaves null fields out, so optional keys may be absent.
 * Quotation line and quotation ids are UUID strings and pass straight through.
 */

const BASE = "/admin/quotations";

interface WireLine {
  id: string;
  productId: number;
  variantId?: number | null;
  productName: string;
  quantity: number;
  rentalDays: number;
  unitRatePerDay: Money;
  lineTotal: Money;
  tradePrice?: boolean;
}

interface WireQuotation {
  id: string;
  companyId: number;
  quotationNumber: string;
  customerId?: number | null;
  customerName: string;
  customerEmail?: string | null;
  eventDate?: string | null;
  status: QuotationStatus;
  totalAmount: Money;
  securityDeposit: Money;
  sourceReference?: string | null;
  validUntil?: string | null;
  subtotalAmount?: Money;
  deliveryCharge?: Money;
  discountAmount?: Money;
  bundleDiscounts?: { name: string; percent: number; amount: Money }[];
  tax?: QuotationView["tax"];
  depositWaiver?: QuotationView["depositWaiver"];
  policies?: QuotationView["policies"];
  changeRequestNote?: string | null;
  changeRequestedAt?: string | null;
  createdAt?: string | null;
  sentAt?: string | null;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  lines: WireLine[];
}

function lineFromWire(line: WireLine): QuotationLineView {
  return {
    id: line.id,
    productId: String(line.productId),
    variantId: line.variantId == null ? null : String(line.variantId),
    productName: line.productName,
    quantity: line.quantity,
    rentalDays: line.rentalDays,
    unitRatePerDay: line.unitRatePerDay,
    lineTotal: line.lineTotal,
    tradePrice: line.tradePrice ?? false,
  };
}

function fromWire(q: WireQuotation): QuotationView {
  return {
    id: q.id,
    companyId: String(q.companyId),
    quotationNumber: q.quotationNumber,
    customerId: q.customerId == null ? null : String(q.customerId),
    customerName: q.customerName,
    customerEmail: q.customerEmail ?? null,
    eventDate: q.eventDate ?? null,
    status: q.status,
    totalAmount: q.totalAmount,
    totalSecurityDeposit: q.securityDeposit,
    sourceReference: q.sourceReference ?? null,
    validUntil: q.validUntil ?? null,
    subtotalAmount: q.subtotalAmount,
    deliveryCharge: q.deliveryCharge,
    discountAmount: q.discountAmount,
    bundleDiscounts: q.bundleDiscounts ?? [],
    tax: q.tax,
    depositWaiver: q.depositWaiver,
    policies: q.policies ?? [],
    changeRequestNote: q.changeRequestNote ?? null,
    changeRequestedAt: q.changeRequestedAt ?? null,
    createdAt: q.createdAt ?? null,
    sentAt: q.sentAt ?? null,
    acceptedAt: q.acceptedAt ?? null,
    rejectedAt: q.rejectedAt ?? null,
    rejectionReason: q.rejectionReason ?? null,
    lines: q.lines.map(lineFromWire),
  };
}

const id = (value: string) => encodeURIComponent(value);

export async function listQuotations(signal?: AbortSignal): Promise<QuotationView[]> {
  const rows = await apiFetch<WireQuotation[]>(BASE, { signal });
  return rows.map(fromWire);
}

export async function getQuotation(quotationId: string, signal?: AbortSignal): Promise<QuotationView> {
  return fromWire(await apiFetch<WireQuotation>(`${BASE}/${id(quotationId)}`, { signal }));
}

export async function createQuotation(request: CreateQuotationRequest): Promise<QuotationView> {
  const created = await apiFetch<WireQuotation>(BASE, {
    method: "POST",
    body: {
      customerId: Number(request.customerId),
      eventDate: request.eventDate || undefined,
      securityDeposit: request.securityDeposit,
      deliveryCharge: request.deliveryCharge || undefined,
      discountAmount: request.discountAmount || undefined,
      validUntil: request.validUntil || undefined,
      lines: request.lines.map((line) => ({
        productId: Number(line.productId),
        variantId: line.variantId ? Number(line.variantId) : undefined,
        quantity: line.quantity,
        rentalDays: line.rentalDays,
      })),
    },
  });
  return fromWire(created);
}

/**
 * Lines that carry `lineId` keep the rate they were priced at; the backend sends a SENT quotation
 * back to DRAFT when it is edited, and refuses once it is accepted, rejected, expired or converted.
 */
export async function updateQuotation(
  quotationId: string,
  request: UpdateQuotationRequest,
): Promise<QuotationView> {
  const updated = await apiFetch<WireQuotation>(`${BASE}/${id(quotationId)}`, {
    method: "PUT",
    body: {
      customerId: Number(request.customerId),
      eventDate: request.eventDate || undefined,
      securityDeposit: request.securityDeposit,
      deliveryCharge: request.deliveryCharge || undefined,
      discountAmount: request.discountAmount || undefined,
      lines: request.lines.map((line) => ({
        id: line.lineId,
        productId: Number(line.productId),
        variantId: line.variantId ? Number(line.variantId) : undefined,
        quantity: line.quantity,
        rentalDays: line.rentalDays,
      })),
    },
  });
  return fromWire(updated);
}

/** DRAFT to SENT. The customer is emailed (once notification delivery exists). */
export async function sendQuotation(quotationId: string): Promise<QuotationView> {
  return fromWire(await apiFetch<WireQuotation>(`${BASE}/${id(quotationId)}/send`, { method: "POST" }));
}

/** SENT to ACCEPTED. Needs QUOTATION_APPROVE, which only an Admin holds. */
export async function acceptQuotation(quotationId: string): Promise<QuotationView> {
  return fromWire(await apiFetch<WireQuotation>(`${BASE}/${id(quotationId)}/accept`, { method: "POST" }));
}

/** SENT to REJECTED, with a reason. Needs QUOTATION_APPROVE. */
export async function rejectQuotation(quotationId: string, reason: string): Promise<QuotationView> {
  return fromWire(
    await apiFetch<WireQuotation>(`${BASE}/${id(quotationId)}/reject`, {
      method: "POST",
      body: { reason },
    }),
  );
}

/** A new DRAFT with the same customer, deposit and lines, priced at current rates. */
export async function duplicateQuotation(quotationId: string): Promise<QuotationView> {
  return fromWire(
    await apiFetch<WireQuotation>(`${BASE}/${id(quotationId)}/duplicate`, { method: "POST" }),
  );
}

/** Every version sent to the customer, oldest first. */
export function listQuotationVersions(quotationId: string, signal?: AbortSignal): Promise<QuotationVersionView[]> {
  return apiFetch<QuotationVersionView[]>(`${BASE}/${id(quotationId)}/versions`, { signal });
}

/** The deposit is not collected; the reason is kept. Needs DEPOSIT_WAIVE (Admin). */
export async function waiveDeposit(quotationId: string, reason: string): Promise<QuotationView> {
  return fromWire(
    await apiFetch<WireQuotation>(`${BASE}/${id(quotationId)}/waive-deposit`, { method: "POST", body: { reason } }),
  );
}

/** Accepts a sent quotation for the customer and creates the order at once. Needs QUOTATION_APPROVE. */
export async function acceptOnBehalf(quotationId: string): Promise<{ id: string; orderNumber: string }> {
  return apiFetch<{ id: string; orderNumber: string }>("/admin/orders/accept-on-behalf", {
    method: "POST",
    body: { quotationId },
  });
}

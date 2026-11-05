import { apiFetch } from "@/services/api-client";
import type { Money } from "@/lib/money";

const BASE = "/admin/billing";

/** RAZORPAY is a customer paying online on the storefront: recorded and verified automatically, never chosen by staff. */
export type PaymentMode = "BANK_TRANSFER" | "UPI" | "CASH" | "CARD" | "CHEQUE" | "RAZORPAY";
export type PaymentPurpose = "RENTAL" | "DEPOSIT";
/** VOIDED: a verified payment entered wrongly. It stays on record, with its receipt shown as cancelled, and no longer counts. */
export type PaymentStatus = "RECORDED" | "VERIFIED" | "REJECTED" | "VOIDED";
export type PaymentEventType = "RECORDED" | "EDITED" | "ATTACHED_TO_ORDER" | "VERIFIED" | "REJECTED" | "VOIDED";
export type DocumentKind = "TAX_INVOICE" | "FINAL_INVOICE" | "RECEIPT";

export const PAYMENT_MODES: PaymentMode[] = ["BANK_TRANSFER", "UPI", "CASH", "CARD", "CHEQUE"];

export interface Payment {
  id: string;
  /** Absent while the money sits on a quotation that is not an order yet. */
  orderId?: string | null;
  orderNumber?: string | null;
  quotationId?: string | null;
  quotationNumber?: string | null;
  purpose: PaymentPurpose;
  mode: PaymentMode;
  amount: Money;
  reference: string | null;
  paidOn: string;
  proofUrl: string | null;
  status: PaymentStatus;
  recordedBy: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectReason: string | null;
  receiptNumber: string | null;
  recordedAt: string;
  voidedBy: string | null;
  voidedAt: string | null;
  voidReason: string | null;
}

/** One line of a payment's history. `changes` is {field: {from, to}} for an edit, otherwise null. */
export interface PaymentEvent {
  id: number;
  paymentId: string;
  type: PaymentEventType;
  actor: string;
  occurredAt: string;
  /** The reason (reject, void), the receipt number (verify) or the order number (moved onto an order). */
  note: string | null;
  changes: Record<string, { from: string | null; to: string | null }> | null;
}

export interface PaymentLedger {
  items: Payment[];
  total: number;
  /** Counts from 0. */
  page: number;
  size: number;
}

export interface LedgerFilter {
  status?: PaymentStatus;
  mode?: PaymentMode;
  from?: string;
  to?: string;
  q?: string;
  /** Counts from 0. */
  page: number;
  size: number;
}

export interface EditPaymentInput {
  mode: PaymentMode;
  amount: number;
  reference?: string;
  paidOn?: string;
  /** Leave out to keep the proof on file. */
  proofUrl?: string;
}

export interface ScheduleLine {
  id: string;
  label: string;
  dueOn: string;
  amount: Money;
  paid: boolean;
}

/** What an order is worth, what has been received (verified only) and what is left. */
export interface OrderBalance {
  /** Absent for a quotation. */
  orderId?: string | null;
  /** The order number, or the quotation number for a quotation. */
  orderNumber: string;
  total: Money;
  creditApplied: Money;
  verifiedPaid: Money;
  pendingVerification: Money;
  balance: Money;
  depositRequired: Money;
  depositReceived: Money;
  payments: Payment[];
  schedule: ScheduleLine[];
  /** Goods are released once any payment is recorded: AWAITED until then, NOT_REQUIRED when the company does not hold them back. */
  paymentStage?: "NOT_REQUIRED" | "AWAITED" | "CONFIRMED";
}

/** The snapshot printed on a document. Every part is optional: receipts and invoices carry different parts. */
export interface DocumentBody {
  documentNumber?: string;
  orderNumber?: string;
  quotationNumber?: string;
  eventDate?: string | null;
  seller?: {
    name?: string;
    gstin?: string | null;
    pan?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    phone?: string | null;
    email?: string | null;
    bankName?: string | null;
    bankAccount?: string | null;
    bankIfsc?: string | null;
    upiId?: string | null;
    logoUrl?: string | null;
    signatureUrl?: string | null;
  };
  buyer?: { name?: string; email?: string | null; gstin?: string | null; state?: string | null; phone?: string | null };
  lines?: { description: string; remark?: string; quantity: number; days: number; amount: number }[];
  itemsTotal?: number;
  discounts?: number;
  delivery?: number;
  tax?: {
    rate: number;
    taxableAmount: number;
    cgst: number;
    sgst: number;
    igst: number;
    placeOfSupply: string | null;
    intraState: boolean;
  };
  total?: number;
  securityDeposit?: number;
  creditNotesApplied?: number;
  paymentsReceived?: { receiptNumber: string | null; purpose: string; mode: string; paidOn: string; amount: number }[];
  rentalReceived?: number;
  balanceDue?: number;
  deposit?: { held: number; received: number; refunded: number; forfeited: number; status: string };
  payment?: { purpose: string; mode: string; reference: string | null; paidOn: string; amount: number };
  orderTotal?: number;
  receivedToDate?: number;
  balanceAfter?: number;
}

export interface BillingDocument {
  id: string;
  kind: DocumentKind;
  number: string;
  orderId?: string | null;
  orderNumber?: string | null;
  paymentId: string | null;
  issuedOn: string;
  total: Money;
  body: DocumentBody;
  /** A receipt whose payment was voided: it and its number stay, shown as cancelled. */
  cancelled: boolean;
}

export interface RecordPaymentInput {
  purpose: PaymentPurpose;
  mode: PaymentMode;
  amount: number;
  reference?: string;
  paidOn?: string;
  proofUrl?: string;
  /** Record and verify in one step (needs the verify permission). */
  verifyNow?: boolean;
}

export interface ScheduleInput {
  label: string;
  dueOn: string;
  amount: number;
}

export const getOrderBalance = (orderId: string, signal?: AbortSignal) =>
  apiFetch<OrderBalance>(`${BASE}/orders/${orderId}`, { signal });

export const getQuotationBalance = (quotationId: string, signal?: AbortSignal) =>
  apiFetch<OrderBalance>(`${BASE}/quotations/${quotationId}`, { signal });

/** Money received on a sent quotation; once Accounts verify it the quotation is accepted. */
export const recordQuotationPayment = (quotationId: string, input: RecordPaymentInput) =>
  apiFetch<Payment>(`${BASE}/quotations/${quotationId}/payments`, { method: "POST", body: input });

export const listQuotationDocuments = (quotationId: string, signal?: AbortSignal) =>
  apiFetch<BillingDocument[]>(`${BASE}/quotations/${quotationId}/documents`, { signal });

/** Every payment of the company, newest first, with optional filters. */
export const getLedger = (filter: LedgerFilter, signal?: AbortSignal) => {
  const params = new URLSearchParams({ page: String(filter.page), size: String(filter.size) });
  if (filter.status) params.set("status", filter.status);
  if (filter.mode) params.set("mode", filter.mode);
  if (filter.from) params.set("from", filter.from);
  if (filter.to) params.set("to", filter.to);
  if (filter.q?.trim()) params.set("q", filter.q.trim());
  return apiFetch<PaymentLedger>(`${BASE}/payments/ledger?${params.toString()}`, { signal });
};

/** Corrects a payment nobody has checked yet. */
export const editPayment = (paymentId: string, input: EditPaymentInput) =>
  apiFetch<Payment>(`${BASE}/payments/${paymentId}`, { method: "PUT", body: input });

/** Undoes a verified payment entered wrongly. Refused once the order has been dispatched. */
export const voidPayment = (paymentId: string, reason: string) =>
  apiFetch<Payment>(`${BASE}/payments/${paymentId}/void`, { method: "POST", body: { reason } });

export const getPaymentHistory = (paymentId: string, signal?: AbortSignal) =>
  apiFetch<PaymentEvent[]>(`${BASE}/payments/${paymentId}/history`, { signal });

export const getOrderPaymentHistory = (orderId: string, signal?: AbortSignal) =>
  apiFetch<PaymentEvent[]>(`${BASE}/orders/${orderId}/payment-history`, { signal });

export const getQuotationPaymentHistory = (quotationId: string, signal?: AbortSignal) =>
  apiFetch<PaymentEvent[]>(`${BASE}/quotations/${quotationId}/payment-history`, { signal });

export const recordPayment = (orderId: string, input: RecordPaymentInput) =>
  apiFetch<Payment>(`${BASE}/orders/${orderId}/payments`, { method: "POST", body: input });

export const verifyPayment = (paymentId: string) =>
  apiFetch<Payment>(`${BASE}/payments/${paymentId}/verify`, { method: "POST" });

export const rejectPayment = (paymentId: string, reason: string) =>
  apiFetch<Payment>(`${BASE}/payments/${paymentId}/reject`, { method: "POST", body: { reason } });

export const saveSchedule = (orderId: string, lines: ScheduleInput[]) =>
  apiFetch<ScheduleLine[]>(`${BASE}/orders/${orderId}/schedule`, { method: "PUT", body: { lines } });

export const listDocuments = (orderId: string, signal?: AbortSignal) =>
  apiFetch<BillingDocument[]>(`${BASE}/orders/${orderId}/documents`, { signal });

export const getDocument = (documentId: string, signal?: AbortSignal) =>
  apiFetch<BillingDocument>(`${BASE}/documents/${documentId}`, { signal });

export const issueTaxInvoice = (orderId: string) =>
  apiFetch<BillingDocument>(`${BASE}/orders/${orderId}/tax-invoice`, { method: "POST" });

export const issueFinalInvoice = (orderId: string) =>
  apiFetch<BillingDocument>(`${BASE}/orders/${orderId}/final-invoice`, { method: "POST" });

export const billingKeys = {
  order: (orderId: string) => ["billing", "order", orderId] as const,
  quotation: (quotationId: string) => ["billing", "quotation", quotationId] as const,
  quotationDocuments: (quotationId: string) => ["billing", "quotation-documents", quotationId] as const,
  documents: (orderId: string) => ["billing", "documents", orderId] as const,
  document: (id: string) => ["billing", "document", id] as const,
  ledger: (filter: LedgerFilter) => ["billing", "ledger", filter] as const,
  paymentHistory: (paymentId: string) => ["billing", "payment-history", paymentId] as const,
  orderHistory: (targetId: string) => ["billing", "target-history", targetId] as const,
};

export const STATUS_LABEL: Record<PaymentStatus, string> = {
  RECORDED: "Waiting to be verified",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  VOIDED: "Voided",
};

export const EVENT_LABEL: Record<PaymentEventType, string> = {
  RECORDED: "Recorded",
  EDITED: "Edited",
  ATTACHED_TO_ORDER: "Moved onto the order",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  VOIDED: "Voided",
};

export const DOCUMENT_LABEL: Record<DocumentKind, string> = {
  TAX_INVOICE: "Tax invoice",
  FINAL_INVOICE: "Final invoice",
  RECEIPT: "Receipt",
};

export const MODE_LABEL: Record<PaymentMode, string> = {
  BANK_TRANSFER: "Bank transfer",
  UPI: "UPI",
  CASH: "Cash",
  CARD: "Card",
  CHEQUE: "Cheque",
  RAZORPAY: "Paid online (Razorpay)",
};

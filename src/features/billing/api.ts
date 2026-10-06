import { apiFetch } from "@/services/api-client";
import type { Money } from "@/lib/money";

const BASE = "/admin/billing";

export type PaymentMode = "BANK_TRANSFER" | "UPI" | "CASH" | "CARD" | "CHEQUE";
export type PaymentPurpose = "RENTAL" | "DEPOSIT";
export type PaymentStatus = "RECORDED" | "VERIFIED" | "REJECTED";
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
  lines?: { description: string; quantity: number; days: number; amount: number }[];
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
}

export interface RecordPaymentInput {
  purpose: PaymentPurpose;
  mode: PaymentMode;
  amount: number;
  reference?: string;
  paidOn?: string;
  proofUrl?: string;
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

export const listPayments = (status: PaymentStatus, signal?: AbortSignal) =>
  apiFetch<Payment[]>(`${BASE}/payments?status=${status}`, { signal });

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
  queue: (status: PaymentStatus) => ["billing", "queue", status] as const,
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
};

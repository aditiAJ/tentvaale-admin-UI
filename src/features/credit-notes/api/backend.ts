import { apiFetch } from "@/services/api-client";
import type { Money } from "@/lib/money";
import type {
  ApplyCreditNoteRequest,
  CreditNoteApplicationView,
  CreditNoteStatus,
  CreditNoteView,
  CustomerCreditBalance,
  IssueCreditNoteRequest,
} from "@/features/credit-notes/types";

/**
 * Real-backend side of credit notes: the wire shapes of CreditNoteAdminController and the mapping to
 * the shapes the screens were built on.
 *
 * The backend speaks a numeric customer id and company id; the screens compare string ids (a note's
 * customer against the customer list, an order's customer against the note's), so those ids become
 * strings here. Order and note ids are already UUID strings.
 */

const BASE = "/admin/credit-notes";

interface WireApplication {
  id: string;
  orderId: string;
  orderNumber?: string | null;
  amount: Money;
  remainingAfter?: Money | null;
  appliedAt: string;
  appliedBy?: string | null;
}

interface WireCreditNote {
  id: string;
  companyId: number;
  creditNoteNumber: string;
  customerId: number;
  customerName?: string | null;
  againstOrderId?: string | null;
  againstOrderNumber?: string | null;
  amount: Money;
  appliedAmount: Money;
  reversedAmount: Money;
  remaining: Money;
  status: CreditNoteStatus;
  issuedOn: string;
  reason?: string | null;
  applications: WireApplication[];
}

function applicationFromWire(application: WireApplication): CreditNoteApplicationView {
  return {
    id: application.id,
    orderId: application.orderId,
    orderNumber: application.orderNumber ?? undefined,
    amount: application.amount,
    // The screens show a date; the backend records the moment.
    appliedOn: application.appliedAt,
    appliedBy: application.appliedBy ?? undefined,
  };
}

function noteFromWire(note: WireCreditNote): CreditNoteView {
  return {
    id: note.id,
    companyId: String(note.companyId),
    creditNoteNumber: note.creditNoteNumber,
    customerId: String(note.customerId),
    customerName: note.customerName ?? undefined,
    againstOrderId: note.againstOrderId ?? null,
    againstOrderNumber: note.againstOrderNumber ?? null,
    amount: note.amount,
    appliedAmount: note.appliedAmount,
    reversedAmount: note.reversedAmount,
    remaining: note.remaining,
    applications: note.applications.map(applicationFromWire),
    status: note.status,
    issuedOn: note.issuedOn,
    reason: note.reason ?? null,
  };
}

/** Every credit note of the company, newest first, optionally by status and text (number, customer, reason, order). */
export async function listCreditNotes(
  options: { status?: CreditNoteStatus; q?: string } = {},
  signal?: AbortSignal,
): Promise<CreditNoteView[]> {
  const params = new URLSearchParams();
  if (options.status) params.set("status", options.status);
  if (options.q) params.set("q", options.q);
  const query = params.toString();
  const rows = await apiFetch<WireCreditNote[]>(`${BASE}${query ? `?${query}` : ""}`, { signal });
  return rows.map(noteFromWire);
}

export async function getCreditNote(creditNoteId: string, signal?: AbortSignal): Promise<CreditNoteView> {
  return noteFromWire(await apiFetch<WireCreditNote>(`${BASE}/${encodeURIComponent(creditNoteId)}`, { signal }));
}

export async function listCreditNotesByCustomer(
  customerId: string,
  signal?: AbortSignal,
): Promise<CreditNoteView[]> {
  const rows = await apiFetch<WireCreditNote[]>(`${BASE}/by-customer/${encodeURIComponent(customerId)}`, {
    signal,
  });
  return rows.map(noteFromWire);
}

/** What remains on the customer's ISSUED notes. */
export function getCustomerCreditBalance(
  customerId: string,
  signal?: AbortSignal,
): Promise<CustomerCreditBalance> {
  return apiFetch<CustomerCreditBalance>(`${BASE}/by-customer/${encodeURIComponent(customerId)}/balance`, {
    signal,
  });
}

export async function issueCreditNote(request: IssueCreditNoteRequest): Promise<CreditNoteView> {
  const created = await apiFetch<WireCreditNote>(BASE, {
    method: "POST",
    body: {
      customerId: Number(request.customerId),
      againstOrderId: request.againstOrderId || undefined,
      amount: request.amount,
      reason: request.reason || undefined,
    },
  });
  return noteFromWire(created);
}

export async function applyCreditNote(
  creditNoteId: string,
  request: ApplyCreditNoteRequest,
): Promise<CreditNoteView> {
  const updated = await apiFetch<WireCreditNote>(`${BASE}/${encodeURIComponent(creditNoteId)}/apply`, {
    method: "POST",
    body: { orderId: request.orderId, amount: request.amount },
  });
  return noteFromWire(updated);
}

export async function cancelCreditNote(creditNoteId: string): Promise<CreditNoteView> {
  return noteFromWire(
    await apiFetch<WireCreditNote>(`${BASE}/${encodeURIComponent(creditNoteId)}/cancel`, { method: "POST" }),
  );
}

export async function reverseCreditNote(creditNoteId: string): Promise<CreditNoteView> {
  return noteFromWire(
    await apiFetch<WireCreditNote>(`${BASE}/${encodeURIComponent(creditNoteId)}/reverse`, { method: "POST" }),
  );
}

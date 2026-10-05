import { ApiError } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";
import {
  mockCreateQuotation,
  mockGetQuotation,
  mockListQuotations,
  mockUpdateQuotation,
} from "@/mock-data/store";
import * as backend from "@/features/quotations/api/backend";
import type {
  CreateQuotationRequest,
  QuotationVersionView,
  QuotationView,
  UpdateQuotationRequest,
} from "@/features/quotations/types";

/**
 * Quotations. In api mode every call goes to QuotationAdminController through
 * `./backend`, which maps the wire shape to the screens' shape. Mock mode keeps the seeded
 * browser-local data for the calls it always had; the workflow actions (send, accept, reject,
 * duplicate) exist only on the real backend.
 *
 * Who may do what is the backend's call and the screens mirror it: sales drafts, edits and sends
 * (QUOTATION_WRITE); only an Admin accepts or rejects (QUOTATION_APPROVE); only an ACCEPTED
 * quotation converts to an order. Failures arrive as ApiError with the server's own sentence
 * (422 a rule, 403 not allowed, 409 someone changed it at the same time).
 */
const NEEDS_BACKEND = "This needs the real backend. Set NEXT_PUBLIC_DATA_SOURCE=api.";

/** 404 when the id is unknown or belongs to another company. */
export function getQuotation(quotationId: string, signal?: AbortSignal): Promise<QuotationView> {
  if (IS_MOCK) return mockGetQuotation(quotationId);
  return backend.getQuotation(quotationId, signal);
}

/** 422 for no lines, an inactive customer or product, or a validity date in the past. */
export function createQuotation(request: CreateQuotationRequest): Promise<QuotationView> {
  if (IS_MOCK) return mockCreateQuotation(request);
  return backend.createQuotation(request);
}

/**
 * Existing lines keep the rate they were priced at; new lines are priced now. Editing a SENT
 * quotation sends it back to DRAFT; 422 once it is accepted, rejected, expired or converted.
 */
export function updateQuotation(
  quotationId: string,
  request: UpdateQuotationRequest,
): Promise<QuotationView> {
  if (IS_MOCK) return mockUpdateQuotation(quotationId, request);
  return backend.updateQuotation(quotationId, request);
}

/** Every quotation for the company, newest first. */
export function listQuotations(signal?: AbortSignal): Promise<QuotationView[]> {
  if (IS_MOCK) return mockListQuotations();
  return backend.listQuotations(signal);
}

/** DRAFT to SENT. */
export function sendQuotation(quotationId: string): Promise<QuotationView> {
  if (IS_MOCK) return Promise.reject(new ApiError(NEEDS_BACKEND, 422));
  return backend.sendQuotation(quotationId);
}

/** SENT to ACCEPTED. 403 unless the caller holds QUOTATION_APPROVE (Admin). */
export function acceptQuotation(quotationId: string): Promise<QuotationView> {
  if (IS_MOCK) return Promise.reject(new ApiError(NEEDS_BACKEND, 422));
  return backend.acceptQuotation(quotationId);
}

/** SENT to REJECTED. The reason is required. 403 unless the caller holds QUOTATION_APPROVE. */
export function rejectQuotation(quotationId: string, reason: string): Promise<QuotationView> {
  if (IS_MOCK) return Promise.reject(new ApiError(NEEDS_BACKEND, 422));
  return backend.rejectQuotation(quotationId, reason);
}

/** A new DRAFT copying this one's customer, deposit and lines, priced at today's rates. */
export function duplicateQuotation(quotationId: string): Promise<QuotationView> {
  if (IS_MOCK) return Promise.reject(new ApiError(NEEDS_BACKEND, 422));
  return backend.duplicateQuotation(quotationId);
}

/** Every version sent to the customer. Real backend only. */
export function listQuotationVersions(quotationId: string, signal?: AbortSignal): Promise<QuotationVersionView[]> {
  if (IS_MOCK) return Promise.resolve([]);
  return backend.listQuotationVersions(quotationId, signal);
}

export const quotationKeys = {
  byId: (quotationId: string) => ["quotations", quotationId] as const,
  list: ["quotations", "list"] as const,
};

/** Needs DEPOSIT_WAIVE (Admin): the deposit is not collected and the reason is on record. */
export function waiveDeposit(quotationId: string, reason: string): Promise<QuotationView> {
  if (IS_MOCK) return Promise.reject(new ApiError(NEEDS_BACKEND, 422));
  return backend.waiveDeposit(quotationId, reason);
}

/** SENT to an order in one step, for the customer. Needs QUOTATION_APPROVE (Admin). */
export function acceptOnBehalf(quotationId: string): Promise<{ id: string; orderNumber: string }> {
  if (IS_MOCK) return Promise.reject(new ApiError(NEEDS_BACKEND, 422));
  return backend.acceptOnBehalf(quotationId);
}

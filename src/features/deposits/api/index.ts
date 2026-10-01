import { ApiError } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";
import {
  mockConfirmRefunded,
  mockForfeit,
  mockGetDepositByOrder,
  mockRequestRefund,
} from "@/mock-data/store";
import * as backend from "@/features/deposits/api/backend";
import type { DepositLedgerView, DepositStatus } from "@/features/deposits/types";

const NEEDS_BACKEND = "This needs the real backend. Set NEXT_PUBLIC_DATA_SOURCE=api.";

export type { DepositSummary } from "@/features/deposits/api/backend";

/** 404 when no deposit is held against the order (an order with a zero deposit has none). */
export function getDepositByOrder(orderId: string, signal?: AbortSignal) {
  if (IS_MOCK) return mockGetDepositByOrder(orderId);
  return backend.getDepositByOrder(orderId, signal);
}

/** Every deposit for the company, optionally by status and by order number. Real backend only. */
export function listDeposits(
  filters: { status?: DepositStatus; q?: string } = {},
  signal?: AbortSignal,
): Promise<DepositLedgerView[]> {
  if (IS_MOCK) return Promise.reject(new ApiError(NEEDS_BACKEND, 422));
  return backend.listDeposits(filters, signal);
}

/** What is held and what is waiting to be paid back. Real backend only. */
export function getDepositSummary(signal?: AbortSignal) {
  if (IS_MOCK) return Promise.reject(new ApiError(NEEDS_BACKEND, 422));
  return backend.getDepositSummary(signal);
}

export function requestRefund(orderId: string, reason?: string) {
  if (IS_MOCK) return mockRequestRefund(orderId, reason);
  return backend.requestRefund(orderId, reason);
}

export function confirmRefunded(orderId: string, amount: number) {
  if (IS_MOCK) return mockConfirmRefunded(orderId, amount);
  return backend.confirmRefunded(orderId, amount);
}

export function forfeit(orderId: string, amount: number, reason?: string) {
  if (IS_MOCK) return mockForfeit(orderId, amount, reason);
  return backend.forfeit(orderId, amount, reason);
}

export const depositKeys = {
  byOrder: (orderId: string) => ["deposits", "by-order", orderId] as const,
  list: (status?: DepositStatus, q?: string) => ["deposits", "list", status ?? "", q ?? ""] as const,
  summary: ["deposits", "summary"] as const,
};

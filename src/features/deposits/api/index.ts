import { apiFetch } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";
import {
  mockConfirmRefunded,
  mockForfeit,
  mockGetDepositByOrder,
  mockRequestRefund,
} from "@/mock-data/store";
import type { DepositLedgerView } from "@/features/deposits/types";

const base = (orderId: string) => `/admin/deposits/by-order/${encodeURIComponent(orderId)}`;

/** 404 when no deposit is held against the order. */
export function getDepositByOrder(orderId: string, signal?: AbortSignal) {
  if (IS_MOCK) return mockGetDepositByOrder(orderId);
  return apiFetch<DepositLedgerView>(base(orderId), { signal });
}

export function requestRefund(orderId: string, reason?: string) {
  if (IS_MOCK) return mockRequestRefund(orderId, reason);
  return apiFetch<DepositLedgerView>(`${base(orderId)}/request-refund`, {
    method: "POST",
    body: { reason: reason || null },
  });
}

export function confirmRefunded(orderId: string, amount: number) {
  if (IS_MOCK) return mockConfirmRefunded(orderId, amount);
  return apiFetch<DepositLedgerView>(`${base(orderId)}/confirm-refunded`, {
    method: "POST",
    body: { amount },
  });
}

export function forfeit(orderId: string, amount: number, reason?: string) {
  if (IS_MOCK) return mockForfeit(orderId, amount, reason);
  return apiFetch<DepositLedgerView>(`${base(orderId)}/forfeit`, {
    method: "POST",
    body: { amount, reason: reason || null },
  });
}

export const depositKeys = {
  byOrder: (orderId: string) => ["deposits", "by-order", orderId] as const,
};

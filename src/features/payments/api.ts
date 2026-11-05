import { apiFetch } from "@/services/api-client";
import type { Money } from "@/lib/money";

const BASE = "/admin/payments/online";

export type OnlinePaymentStatus = "CREATED" | "PENDING_CONFIRMATION" | "CAPTURED" | "FAILED" | "REFUNDED" | "EXPIRED";

/** One Razorpay payment attempt (com.tentvaale.payment.api.PaymentRecordView). */
export interface OnlinePayment {
  id: string;
  orderId?: string | null;
  quotationId?: string | null;
  gatewayOrderId: string;
  gatewayPaymentId?: string | null;
  amount: Money;
  status: OnlinePaymentStatus;
  method?: string | null;
  needsReview: boolean;
  reviewReason?: string | null;
  failureReason?: string | null;
  createdAt: string;
}

/** A payment staff should look at, with why. */
export interface AttentionRow {
  payment: OnlinePayment;
  quotationNumber?: string | null;
  problem: string;
}

/** OFF when Razorpay is not switched on; TEST or LIVE from the key the server holds (the key itself is never sent). */
export interface OnlineStatus {
  enabled: boolean;
  mode: "OFF" | "TEST" | "LIVE";
}

export const onlineKeys = {
  status: ["online-payments", "status"] as const,
  attention: ["online-payments", "attention"] as const,
};

export const getOnlineStatus = (signal?: AbortSignal) => apiFetch<OnlineStatus>(`${BASE}/status`, { signal });
export const listAttention = (signal?: AbortSignal) => apiFetch<AttentionRow[]>(`${BASE}/attention`, { signal });
export const convertToOrder = (id: string) => apiFetch<{ ordered: boolean }>(`${BASE}/${id}/convert`, { method: "POST" });
export const dismissPayment = (id: string) => apiFetch<OnlinePayment>(`${BASE}/${id}/dismiss`, { method: "POST" });
export const refundPayment = (id: string, reason: string) =>
  apiFetch<OnlinePayment>(`${BASE}/${id}/refund`, { method: "POST", body: { reason } });
export const checkNow = () => apiFetch<{ done: boolean }>(`${BASE}/check-now`, { method: "POST" });

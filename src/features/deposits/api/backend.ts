import { apiFetch } from "@/services/api-client";
import type { Money } from "@/lib/money";
import type { DepositLedgerView, DepositStatus } from "@/features/deposits/types";

/**
 * Real-backend side of deposits (DepositAdminController). The wire shape already matches the
 * screens' type except that the company id is a number and optional fields are absent rather than
 * null, so the mapping only normalises those.
 */

const BASE = "/admin/deposits";

interface WireDeposit {
  id: string;
  companyId: number;
  orderId: string;
  orderNumber?: string | null;
  amountHeld: Money;
  amountRefunded: Money;
  amountForfeited: Money;
  status: DepositStatus;
  reason?: string | null;
  heldAt: string;
  settledAt?: string | null;
  settled?: boolean;
  refundExceedsHeld?: boolean;
}

export interface DepositSummary {
  heldCount: number;
  heldAmount: Money;
  refundPendingCount: number;
  refundPendingAmount: Money;
}

function fromWire(d: WireDeposit): DepositLedgerView {
  return {
    id: d.id,
    companyId: String(d.companyId),
    orderId: d.orderId,
    orderNumber: d.orderNumber ?? undefined,
    amountHeld: d.amountHeld,
    amountRefunded: d.amountRefunded,
    amountForfeited: d.amountForfeited,
    status: d.status,
    reason: d.reason ?? undefined,
    heldAt: d.heldAt,
    settledAt: d.settledAt ?? undefined,
    settled: d.settled ?? false,
    refundExceedsHeld: d.refundExceedsHeld ?? false,
  };
}

const byOrder = (orderId: string) => `${BASE}/by-order/${encodeURIComponent(orderId)}`;

/** 404 when the order has no deposit (a zero deposit creates no ledger entry). */
export async function getDepositByOrder(orderId: string, signal?: AbortSignal): Promise<DepositLedgerView> {
  return fromWire(await apiFetch<WireDeposit>(byOrder(orderId), { signal }));
}

/** Every deposit for the company, newest first. */
export async function listDeposits(
  filters: { status?: DepositStatus; q?: string } = {},
  signal?: AbortSignal,
): Promise<DepositLedgerView[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.q) params.set("q", filters.q);
  const query = params.toString();
  const rows = await apiFetch<WireDeposit[]>(`${BASE}${query ? `?${query}` : ""}`, { signal });
  return rows.map(fromWire);
}

export function getDepositSummary(signal?: AbortSignal): Promise<DepositSummary> {
  return apiFetch<DepositSummary>(`${BASE}/summary`, { signal });
}

export async function requestRefund(orderId: string, reason?: string): Promise<DepositLedgerView> {
  return fromWire(
    await apiFetch<WireDeposit>(`${byOrder(orderId)}/request-refund`, {
      method: "POST",
      body: { reason: reason || undefined },
    }),
  );
}

export async function confirmRefunded(orderId: string, amount: number): Promise<DepositLedgerView> {
  return fromWire(
    await apiFetch<WireDeposit>(`${byOrder(orderId)}/confirm-refunded`, {
      method: "POST",
      body: { amount },
    }),
  );
}

export async function forfeit(orderId: string, amount: number, reason?: string): Promise<DepositLedgerView> {
  return fromWire(
    await apiFetch<WireDeposit>(`${byOrder(orderId)}/forfeit`, {
      method: "POST",
      body: { amount, reason: reason || undefined },
    }),
  );
}

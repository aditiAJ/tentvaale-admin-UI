import type { Money } from "@/lib/money";

/** Mirrors com.tentvaale.deposit.api.DepositStatus. */
export const DEPOSIT_STATUSES = ["HELD", "REFUND_PENDING", "FORFEITED", "REFUNDED"] as const;
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];

export const DEPOSIT_STATUS_MEANING: Record<DepositStatus, string> = {
  HELD: "Money taken and held against damage or loss.",
  REFUND_PENDING: "The event is over and a refund is approved, but not yet paid out.",
  FORFEITED: "Kept by the vendor, in whole or in part. Terminal.",
  REFUNDED: "Returned to the customer. Terminal.",
};

/**
 * The transitions the backend allows, copied from DepositStatus#allowedNext.
 *
 * Duplicated here on purpose, unlike the role→permission mapping: this is a
 * state machine the user drives, and offering a button the server will refuse
 * is a worse failure than the small risk of the two drifting. The server still
 * rejects anything invalid, so a drift shows up as a 422, not as corrupt data.
 */
export const ALLOWED_NEXT: Record<DepositStatus, DepositStatus[]> = {
  HELD: ["REFUND_PENDING", "FORFEITED"],
  REFUND_PENDING: ["REFUNDED"],
  FORFEITED: [],
  REFUNDED: [],
};

/** Mirrors com.tentvaale.deposit.api.DepositLedgerView. One deposit, one order. */
export interface DepositLedgerView {
  id: string;
  companyId: string;
  orderId: string;
  accountId: string;
  amountHeld: Money;
  amountRefunded: Money;
  amountForfeited: Money;
  status: DepositStatus;
  /** Absent rather than null when unset — Jackson non_null inclusion. */
  reason?: string;
  heldAt: string;
  settledAt?: string;
}

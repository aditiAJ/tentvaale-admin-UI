import type { OrderStatus } from "@/features/orders/types";
import type { DepositStatus } from "@/features/deposits/types";

type Tone = "default" | "success" | "warning" | "destructive";

/** Badge tones the order list and detail share. */
export const ORDER_STATUS_VARIANT: Record<OrderStatus, Tone> = {
  CONFIRMED: "default",
  DISPATCHED: "warning",
  RETURNED: "warning",
  COMPLETED: "success",
  CANCELLED: "destructive",
};

export const DEPOSIT_VARIANT: Record<DepositStatus, Tone> = {
  HELD: "default",
  REFUND_PENDING: "warning",
  REFUNDED: "success",
  FORFEITED: "destructive",
};

const eventDateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** An event date is a calendar date, so it is read and shown in UTC to stay on its day. */
export function formatEventDate(value: string | null): string {
  if (!value) return "Not set";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : eventDateFormat.format(date);
}

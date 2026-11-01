"use client";

import type { DateStockResult } from "@/features/inventory";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** What the Inventory column needs to say for one line, whichever screen draws it. */
export interface LineStock {
  /** Typed in by name and rate: no stock, so never checked and always available. */
  oneTime?: boolean;
  /** Whether a product (and, where it has variants, a variant) has been chosen to check. */
  checkable: boolean;
  result?: DateStockResult;
  /** There is no date to check against. */
  needsDate: boolean;
  pending: boolean;
  failed: boolean;
}

/** The hover text: the three figures, then the orders holding the rest. */
function detail(result: DateStockResult): string {
  const held = result.blockedBy.length
    ? `Held by ${result.blockedBy.map((b) => `${b.orderNumber} (${b.quantity})`).join(", ")}`
    : "Nothing else is holding it";
  return result.note ?? `Total ${result.total} · Held by other events ${result.blocked} · Free for this line ${result.free}. ${held}.`;
}

/**
 * One line's stock status: light green Available, light yellow "Need 20 · In stock 10", light red Not available. A
 * one-time line is always Available. While a new answer is on its way the old one stays, dimmed, so the column does not
 * flicker as the quantity is typed.
 */
export function InventoryChip({ stock }: { stock: LineStock }) {
  if (stock.oneTime) return <Badge variant="success">Available</Badge>;
  if (!stock.checkable) return <span className="text-xs text-muted-foreground">—</span>;
  if (stock.needsDate) return <Badge>Add event date</Badge>;

  const result = stock.result;
  if (!result) {
    return <span className="text-xs text-muted-foreground">{stock.failed ? "Could not check" : "Checking…"}</span>;
  }

  const dim = stock.pending ? "opacity-60" : undefined;
  switch (result.status) {
    case "AVAILABLE":
      return (
        <Badge variant="success" className={dim} title={detail(result)}>
          Available
        </Badge>
      );
    case "PARTIAL":
      return (
        <Badge variant="warning" className={cn("whitespace-normal", dim)} title={detail(result)}>
          Need {result.needed} · In stock {result.free}
        </Badge>
      );
    case "UNAVAILABLE":
      return (
        <Badge variant="destructive" className={dim} title={detail(result)}>
          Not available
        </Badge>
      );
    default:
      return <Badge>Add event date</Badge>;
  }
}

/** One line under the lines when any are short: how many, and for which date (already formatted). Nothing when all is well. */
export function StockSummary({ stocks, dateLabel }: { stocks: LineStock[]; dateLabel?: string }) {
  const short = stocks.filter(
    (s) => !s.oneTime && s.result && (s.result.status === "PARTIAL" || s.result.status === "UNAVAILABLE"),
  ).length;
  if (!short) return null;
  return (
    <p className="px-4 py-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">
        {short} {short === 1 ? "line is" : "lines are"} short
      </span>
      {dateLabel ? ` for ${dateLabel}` : ""}. Hover a status to see which events hold the stock.
    </p>
  );
}

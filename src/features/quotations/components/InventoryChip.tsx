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

/** "20 Nov" from a yyyy-MM-dd date. */
function dayLabel(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? iso
    : new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}

/** "20 Nov", or "20 Nov – 22 Nov" for an order that holds the goods for several days. */
function daysLabel(from: string, to: string): string {
  return from === to ? dayLabel(from) : `${dayLabel(from)} – ${dayLabel(to)}`;
}

/** The two tints a short line can have; the card, its figures and its divider all take the one colour. */
const TONES = {
  warning:
    "border-[color-mix(in_srgb,var(--warning)_32%,transparent)] bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] text-[var(--warning)]",
  destructive:
    "border-[color-mix(in_srgb,var(--destructive)_32%,transparent)] bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] text-destructive",
} as const;

/** A label on the left and its figure on the right, in the card's own colour. */
function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-medium">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

/** Where the missing stock has gone: each order holding some of it, how many, and on which days. */
function Holders({ result }: { result: DateStockResult }) {
  if (result.note) return <p className="border-t border-current/20 pt-1.5 text-foreground/80">{result.note}</p>;
  if (!result.blockedBy.length) return null;
  const shown = result.blockedBy.slice(0, 3);
  const more = result.blockedBy.length - shown.length;
  return (
    <div className="space-y-1 border-t border-current/20 pt-1.5">
      <p className="text-[10px] font-semibold tracking-wide uppercase opacity-80">Held by</p>
      <ul className="space-y-1">
        {shown.map((holder) => (
          <li
            key={`${holder.orderNumber}-${holder.from}`}
            className="flex items-baseline justify-between gap-3 text-foreground"
          >
            <span className="font-medium">{holder.orderNumber}</span>
            <span className="tabular-nums text-foreground/75">
              {holder.quantity} · {daysLabel(holder.from, holder.to)}
            </span>
          </li>
        ))}
        {more > 0 ? <li className="text-foreground/75">+{more} more</li> : null}
      </ul>
    </div>
  );
}

/**
 * One line's stock status. Light green Available. When only some is free, one light yellow card: Shortage and In stock as
 * two rows of the same colour, then the orders holding the rest under a divider. None free is the same card in light red,
 * headed Not available. A one-time line is always Available. While a new answer is on its way the old one stays, dimmed,
 * so the column does not flicker as the quantity is typed.
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
        <div
          className={cn("w-full min-w-44 space-y-1.5 rounded-lg border px-3 py-2 text-xs", TONES.warning, dim)}
          title={detail(result)}
        >
          <Figure label="Shortage" value={result.needed - result.free} />
          <Figure label="In stock" value={result.free} />
          <Holders result={result} />
        </div>
      );
    case "UNAVAILABLE":
      return (
        <div
          className={cn("w-full min-w-44 space-y-1.5 rounded-lg border px-3 py-2 text-xs", TONES.destructive, dim)}
          title={detail(result)}
        >
          <p className="text-sm font-semibold">Not available</p>
          <Holders result={result} />
        </div>
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
      {dateLabel ? ` for ${dateLabel}` : ""}. The orders holding the stock are listed under each status.
    </p>
  );
}

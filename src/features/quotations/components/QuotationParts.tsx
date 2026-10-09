"use client";

import { Check, CalendarDays, Clock, ExternalLink, MapPin, Users } from "lucide-react";
import type { QuotationLineView, QuotationPlan, QuotationStatus, QuotationVenue, QuotationView } from "@/features/quotations/types";
import type { QuotationBucket } from "@/features/quotations/source";
import { MediaThumb, useProductMedia } from "@/features/master-data";
import { formatMoney, type Money } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const STATUS_VARIANT: Record<QuotationBucket, "default" | "success" | "warning" | "destructive" | "outline"> = {
  RECEIVED: "warning",
  NEW: "outline",
  REVIEWED: "warning",
  DISCARDED: "destructive",
  DRAFT: "default",
  SENT: "warning",
  ACCEPTED: "success",
  CONVERTED: "success",
  REJECTED: "destructive",
  EXPIRED: "destructive",
};

export const STATUS_LABEL: Record<QuotationBucket, string> = {
  RECEIVED: "Received",
  NEW: "New",
  REVIEWED: "Reviewed",
  DISCARDED: "Discarded",
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  CONVERTED: "Converted",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
};

export function StatusBadge({ bucket }: { bucket: QuotationBucket }) {
  return <Badge variant={STATUS_VARIANT[bucket]}>{STATUS_LABEL[bucket]}</Badge>;
}

const dayFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const weekdayFormat = new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" });

/** An event date is a calendar date, so it is read and shown in UTC to stay on its day. */
export function formatEventDate(value: string | null | undefined, withWeekday = false): string {
  if (!value) return "Not set";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return withWeekday ? `${weekdayFormat.format(date)} ${dayFormat.format(date)}` : dayFormat.format(date);
}

/** "19:00" or "19:00:00" as "7:00 PM". */
export function formatTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h)) return null;
  return `${h % 12 || 12}:${String(m || 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** A Google Maps link for a venue: the exact point when the customer picked one, else a search on the text. */
export function mapLink(venue: Pick<QuotationVenue, "text" | "latitude" | "longitude">): string {
  const query = venue.latitude != null && venue.longitude != null ? `${venue.latitude},${venue.longitude}` : encodeURIComponent(venue.text);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export const isPositive = (money?: Money | null) => money != null && Number(money.amount) > 0;

/** "Round Table (Red)" is the product "Round Table" in the variant "Red". */
function splitVariant(productName: string): { name: string; variant: string | null } {
  const match = /^(.*?)\s*\(([^()]+)\)$/.exec(productName);
  return match ? { name: match[1], variant: match[2] } : { name: productName, variant: null };
}

// ---- where the quotation is in its life ------------------------------------------------------

const STEPS: { status: QuotationStatus; label: string }[] = [
  { status: "DRAFT", label: "Draft" },
  { status: "SENT", label: "Sent" },
  { status: "ACCEPTED", label: "Accepted" },
  { status: "CONVERTED", label: "Order placed" },
];

/** Draft, Sent, Accepted, Order placed: where this quotation is, and the end it came to if it did not finish. */
export function StatusStepper({ status }: { status: QuotationStatus }) {
  const ended = status === "REJECTED" || status === "EXPIRED";
  // A quotation that ended was sent first.
  const current = ended ? 1 : Math.max(0, STEPS.findIndex((s) => s.status === status));
  return (
    <ol className="flex items-center gap-1.5 overflow-x-auto" aria-label="Quotation progress">
      {STEPS.map((step, index) => {
        const done = !ended && index < current;
        const active = index === current && !ended;
        return (
          <li key={step.status} className="flex items-center gap-1.5">
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap",
                done && "border-success/40 bg-success/10 text-success",
                active && "border-primary bg-primary/10 font-medium text-primary",
                !done && !active && "border-border text-muted-foreground",
                ended && index <= 1 && "border-border text-foreground",
              )}
            >
              {done ? <Check className="size-3" /> : <span className="tabular">{index + 1}</span>}
              {step.label}
            </span>
            {index < STEPS.length - 1 ? <span className="h-px w-4 bg-border" aria-hidden="true" /> : null}
          </li>
        );
      })}
      {ended ? (
        <>
          <span className="h-px w-4 bg-border" aria-hidden="true" />
          <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-destructive">
            {status === "REJECTED" ? "Rejected" : "Expired"}
          </span>
        </>
      ) : null}
    </ol>
  );
}

// ---- money -----------------------------------------------------------------------------------

/** The original breakdown: every figure as a labelled cell in a grid, the total large. The totals are the backend's. */
export function PriceGrid({ quotation: q }: { quotation: QuotationView }) {
  const tax = q.tax && q.tax.rate != null ? q.tax : null;
  const rows: { label: string; value: string; strong?: boolean; muted?: boolean }[] = [
    { label: "Items", value: formatMoney(q.subtotalAmount ?? q.totalAmount) },
    ...(q.bundleDiscounts ?? []).map((b) => ({ label: `${b.name} (${b.percent}% off)`, value: `− ${formatMoney(b.amount)}` })),
    { label: "Delivery", value: isPositive(q.deliveryCharge) ? formatMoney(q.deliveryCharge) : "None", muted: !isPositive(q.deliveryCharge) },
    { label: "Discount", value: isPositive(q.discountAmount) ? `− ${formatMoney(q.discountAmount)}` : "None", muted: !isPositive(q.discountAmount) },
    ...(tax
      ? [
          { label: "Taxable amount", value: formatMoney(tax.taxableAmount) },
          ...(tax.intraState
            ? [
                { label: `CGST (${(tax.rate ?? 0) / 2}%)`, value: formatMoney(tax.cgst) },
                { label: `SGST (${(tax.rate ?? 0) / 2}%)`, value: formatMoney(tax.sgst) },
              ]
            : [{ label: `IGST (${tax.rate}%)`, value: formatMoney(tax.igst) }]),
        ]
      : [{ label: "GST", value: "Not set", muted: true }]),
    { label: "Total", value: formatMoney(q.totalAmount), strong: true },
    q.depositWaiver?.waived
      ? { label: "Security deposit", value: `Waived (${formatMoney(q.depositWaiver.amount)})`, muted: true }
      : { label: "Security deposit (refundable, no GST)", value: formatMoney(q.totalSecurityDeposit) },
    { label: "Valid until", value: formatEventDate(q.validUntil) },
  ];
  return (
    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="text-xs text-muted-foreground">{row.label}</dt>
          <dd className={cn("tabular mt-0.5", row.strong ? "text-xl font-semibold" : "text-base font-medium", row.muted && "text-muted-foreground")}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ---- lines grouped by function ---------------------------------------------------------------

interface Group {
  key: string;
  name: string | null;
  date: string | null;
  startTime: string | null;
  venue: string | null;
  lines: QuotationLineView[];
}

/** The lines under the function each serves, in the order they appear. A quotation with no functions is one group. */
function groupLines(lines: QuotationLineView[]): Group[] {
  const groups = new Map<string, Group>();
  for (const line of lines) {
    const key = line.functionName ? `${line.functionName}|${line.functionDate ?? ""}` : "";
    const group = groups.get(key) ?? {
      key,
      name: line.functionName ?? null,
      date: line.functionDate ?? null,
      startTime: line.functionStartTime ?? null,
      venue: line.functionVenue ?? null,
      lines: [],
    };
    group.lines.push(line);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function LineRows({ lines }: { lines: QuotationLineView[] }) {
  const media = useProductMedia();
  return (
    <TableWrapper>
      <Table>
        <THead>
          <tr>
            <TH>Item</TH>
            <TH className="text-right">Qty</TH>
            <TH className="text-right">Days</TH>
            <TH className="text-right">Rate / day</TH>
            <TH className="text-right">Amount</TH>
          </tr>
        </THead>
        <TBody>
          {lines.map((line) => {
            const { name, variant } = splitVariant(line.productName);
            return (
              <TR key={line.id}>
                <TD>
                  <div className="flex items-center gap-2.5">
                    <MediaThumb media={media.get(line.productId)} />
                    <div className="min-w-0">
                      <span className="font-medium">{name}</span>
                      {variant ? <Badge className="ml-1.5 align-middle">{variant}</Badge> : null}
                      {line.categoryName ? <span className="block text-xs text-muted-foreground">{line.categoryName}</span> : null}
                    </div>
                  </div>
                </TD>
                <TD className="tabular text-right">{line.quantity}</TD>
                <TD className="tabular text-right">{line.rentalDays}</TD>
                <TD className="tabular text-right">{formatMoney(line.unitRatePerDay)}</TD>
                <TD className="tabular text-right font-medium">{formatMoney(line.lineTotal)}</TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </TableWrapper>
  );
}

const sum = (lines: QuotationLineView[]) => lines.reduce((total, l) => total + Number(l.lineTotal.amount), 0);

/**
 * The priced lines, one card per function (name, date, time, venue, guests, setup and tear-down when the customer's plan is
 * known), or a single table when the quotation has no functions. Each card ends in what that function comes to.
 */
export function LinesByFunction({ quotation, plan }: { quotation: QuotationView; plan?: QuotationPlan }) {
  const groups = groupLines(quotation.lines);
  const named = groups.some((g) => g.name);

  if (!named) {
    return (
      <Card className="overflow-hidden">
        <LineRows lines={quotation.lines} />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const se = plan?.subEvents.find((s) => s.name === group.name);
        const venue = group.venue ?? se?.venue ?? se?.venueDetail?.label ?? null;
        const time = formatTime(group.startTime ?? se?.startTime);
        const end = formatTime(se?.endTime);
        return (
          <Card key={group.key} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-border bg-muted/40 px-4 py-3">
              <h3 className="text-sm font-semibold">{group.name ?? "Whole event"}</h3>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {group.date ? (
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-3.5" /> {formatEventDate(group.date, true)}
                  </span>
                ) : null}
                {time ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" /> {time}
                    {end ? ` – ${end}` : ""}
                  </span>
                ) : null}
                {venue ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" /> {venue}
                  </span>
                ) : null}
                {se?.guestCount ? (
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5" /> {se.guestCount} guests
                  </span>
                ) : null}
                {se?.setupOn || se?.teardownOn ? (
                  <span>
                    Setup {formatEventDate(se?.setupOn)} · Tear-down {formatEventDate(se?.teardownOn)}
                  </span>
                ) : null}
              </span>
              <span className="tabular ml-auto text-sm font-semibold">{formatMoney({ amount: sum(group.lines), currency: "INR" })}</span>
            </div>
            <LineRows lines={group.lines} />
          </Card>
        );
      })}
    </div>
  );
}

/** The venue as a row with a map link, or a line saying there is none. */
export function VenueRow({ venue }: { venue: QuotationVenue | null | undefined }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <MapPin className="size-4" />
      </span>
      {venue ? (
        <>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Venue</p>
            <p className="font-medium wrap-break-word">{venue.text}</p>
          </div>
          <a
            href={mapLink(venue)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-primary hover:bg-muted"
          >
            Open map <ExternalLink className="size-3" />
          </a>
        </>
      ) : (
        <p className="text-muted-foreground">No venue was given.</p>
      )}
    </div>
  );
}

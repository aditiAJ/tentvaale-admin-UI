"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CalendarDays, CheckCircle2, Circle, Inbox, Layers, MapPin, MessageSquareWarning, Package, Users } from "lucide-react";
import { getQuotationPlan, quotationKeys } from "@/features/quotations/api";
import type { QuotationView } from "@/features/quotations/types";
import { LinesByFunction, PriceGrid, VenueRow, formatEventDate, isPositive } from "@/features/quotations/components/QuotationParts";
import { QuotationPlanPanel } from "@/features/quotations/components/QuotationPlanPanel";
import { IS_MOCK } from "@/services/data-source";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

/** "3 hours ago", "2 days ago". */
function ago(value: string | null | undefined): string {
  if (!value) return "";
  const seconds = (Date.now() - new Date(value).getTime()) / 1000;
  if (Number.isNaN(seconds)) return "";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of [["day", 86400], ["hour", 3600], ["minute", 60]] as const) {
    if (seconds >= size) return rtf.format(-Math.floor(seconds / size), unit);
  }
  return "just now";
}

const functionCount = (q: QuotationView) => new Set(q.lines.map((l) => l.functionName).filter(Boolean)).size;

/**
 * What the storefront sent in, as cards: who asked, for when and where, how big, and what it comes to. Requests where the
 * customer asked for changes come first, then the newest. Click one to open it.
 */
export function ReceivedCards({ quotations, hrefFor }: { quotations: QuotationView[]; hrefFor: (id: string) => string }) {
  if (quotations.length === 0) {
    return (
      <Card>
        <EmptyState icon={<Inbox />} title="No new requests" description="Quotation requests from the storefront show up here until you send them a price." />
      </Card>
    );
  }
  const ordered = [...quotations].sort((a, b) => {
    const wantsChanges = Number(Boolean(b.changeRequestNote)) - Number(Boolean(a.changeRequestNote));
    return wantsChanges || String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));
  });
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {ordered.map((q) => {
        const revising = Boolean(q.changeRequestNote);
        const functions = functionCount(q);
        return (
          <li key={q.id}>
            <Link
              href={hrefFor(q.id)}
              className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/60 focus-visible:border-primary focus-visible:outline-none"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">{q.customerName}</p>
                  <p className="font-mono text-xs text-muted-foreground">{q.quotationNumber}</p>
                </div>
                <Badge variant={revising ? "destructive" : "warning"}>{revising ? "Changes asked" : "New"}</Badge>
              </div>

              <dl className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                  <dd className="tabular">{formatEventDate(q.eventDate, true)}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 shrink-0 text-muted-foreground" />
                  <dd className="truncate">{q.venue?.text ?? <span className="text-muted-foreground">No venue given</span>}</dd>
                </div>
                <div className="flex items-center gap-2">
                  {functions > 0 ? <Layers className="size-4 shrink-0 text-muted-foreground" /> : <Package className="size-4 shrink-0 text-muted-foreground" />}
                  <dd className="text-muted-foreground">
                    {functions > 0 ? `${functions} function${functions === 1 ? "" : "s"} · ` : ""}
                    {q.lines.length} item line{q.lines.length === 1 ? "" : "s"}
                  </dd>
                </div>
              </dl>

              {revising ? (
                <p className="line-clamp-2 rounded-md border-l-2 border-destructive bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
                  “{q.changeRequestNote}”
                </p>
              ) : null}

              <div className="mt-auto flex items-end justify-between border-t border-border pt-3">
                <span className="text-xs text-muted-foreground">
                  {revising ? `Asked ${ago(q.changeRequestedAt)}` : `Received ${ago(q.createdAt)}`}
                </span>
                <span className="text-right">
                  <span className="block text-[0.7rem] text-muted-foreground">Estimated total</span>
                  <span className="tabular text-base font-semibold">{formatMoney(q.totalAmount)}</span>
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** What is still to do before this request can be sent back priced. */
function Checklist({ quotation: q }: { quotation: QuotationView }) {
  const steps: { done: boolean; optional?: boolean; label: string; detail: string }[] = [
    { done: q.lines.length > 0, label: "Items priced", detail: `${q.lines.length} line${q.lines.length === 1 ? "" : "s"} at the customer's rates` },
    {
      done: isPositive(q.totalSecurityDeposit) || Boolean(q.depositWaiver?.waived),
      label: "Security deposit",
      detail: isPositive(q.totalSecurityDeposit) ? formatMoney(q.totalSecurityDeposit) : "Not set. Use Edit & price (0 if none).",
    },
    { done: isPositive(q.deliveryCharge), optional: true, label: "Delivery charge", detail: isPositive(q.deliveryCharge) ? formatMoney(q.deliveryCharge) : "None yet" },
    { done: isPositive(q.discountAmount), optional: true, label: "Discount", detail: isPositive(q.discountAmount) ? `− ${formatMoney(q.discountAmount)}` : "None yet" },
    { done: Boolean(q.validUntil), label: "Valid until", detail: formatEventDate(q.validUntil) },
  ];
  return (
    <ul className="space-y-2.5">
      {steps.map((step) => (
        <li key={step.label} className="flex items-start gap-2.5 text-sm">
          {step.done ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label="Done" />
          ) : step.optional ? (
            <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Optional" />
          ) : (
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" aria-label="Needs attention" />
          )}
          <div className="min-w-0">
            <p className="font-medium">
              {step.label}
              {step.optional ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">optional</span> : null}
            </p>
            <p className="text-xs text-muted-foreground">{step.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * One request opened: who asked and when, the event (dates, venue, guests), each function with its date, time, venue and
 * priced items, and beside it what is left to do, the price and the buttons to price it and send it back.
 */
export function ReceivedDetail({ quotation: q, actions }: { quotation: QuotationView; actions: React.ReactNode }) {
  const revising = Boolean(q.changeRequestNote);
  const plan = useQuery({
    queryKey: quotationKeys.plan(q.id),
    queryFn: ({ signal }) => getQuotationPlan(q.id, signal),
    enabled: !IS_MOCK,
    retry: false,
  });
  const p = plan.data;
  const legacy = !q.lines.some((l) => l.functionName) && (p?.subEvents.length ?? 0) > 0;
  const dates = [p?.eventDate ?? q.eventDate, p?.eventEndDate].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <Card className="border-primary/40 p-5">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            {revising ? <MessageSquareWarning className="size-5" /> : <Inbox className="size-5" />}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{revising ? `${q.customerName} asked for changes` : `New request from ${q.customerName}`}</h2>
              <Badge variant={revising ? "destructive" : "warning"}>{revising ? "Changes asked" : "New"}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">{q.quotationNumber}</span>
              {q.customerEmail ? ` · ${q.customerEmail}` : ""}
              {" · "}
              {revising ? `asked ${formatDateTime(q.changeRequestedAt)}` : `received ${formatDateTime(q.createdAt)}`}
            </p>
            <p className="text-sm text-muted-foreground">
              {revising
                ? "Revise the price and send it again. The earlier version stays on record."
                : "Check what they asked for, set the deposit and any delivery charge or discount, then send it back priced."}
            </p>
          </div>
        </div>
        {revising ? (
          <blockquote className="mt-4 rounded-lg border-l-4 border-primary bg-muted/50 px-4 py-3 text-sm leading-6">{q.changeRequestNote}</blockquote>
        ) : null}
        <div className="mt-5 rounded-lg border border-border p-4">
          <Checklist quotation={q} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">{actions}</div>
      </Card>

      <Card className="space-y-4 p-5">
        <h3 className="text-sm font-semibold">The event</h3>
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Event</dt>
            <dd className="mt-0.5 text-sm font-medium">{p?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Date{dates.length > 1 ? "s" : ""}</dt>
            <dd className="tabular mt-0.5 text-sm font-medium">
              {dates.length > 1 ? `${formatEventDate(dates[0])} – ${formatEventDate(dates[1])}` : formatEventDate(dates[0])}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Guests</dt>
            <dd className="mt-0.5 inline-flex items-center gap-1 text-sm font-medium">
              <Users className="size-3.5 text-muted-foreground" /> {p?.guestCount ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Functions</dt>
            <dd className="mt-0.5 text-sm font-medium">{p ? p.subEvents.length : functionCount(q) || "—"}</dd>
          </div>
        </dl>
        <VenueRow venue={q.venue} />
      </Card>

      <Card className="space-y-3 p-5">
        <h3 className="text-sm font-semibold">Price</h3>
        <PriceGrid quotation={q} />
      </Card>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Functions and items</h3>
        <LinesByFunction quotation={q} plan={p} />
        {legacy ? <QuotationPlanPanel quotation={q} /> : null}
      </section>
    </div>
  );
}

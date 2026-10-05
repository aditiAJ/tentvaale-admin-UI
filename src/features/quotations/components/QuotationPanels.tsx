"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Circle, Inbox, MessageSquareWarning } from "lucide-react";
import { listQuotationVersions, quotationKeys } from "@/features/quotations/api";
import type { QuotationView } from "@/features/quotations/types";
import { IS_MOCK } from "@/services/data-source";
import { formatMoney, type Money } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const isPositive = (money?: Money) => money !== undefined && Number(money.amount) > 0;

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const formatDay = (value?: string | null) => (value ? dateFormat.format(new Date(`${value}T00:00:00Z`)) : "Not set");

/**
 * Items, delivery, discount, total and deposit as the customer will see them, so staff can check the
 * figures before sending. The totals are the backend's.
 */
/** GST rows: the taxable amount, then CGST + SGST (same state) or IGST. Delivery comes after, untaxed. */
function taxRows(quotation: QuotationView): { label: string; value: string; muted?: boolean }[] {
  const tax = quotation.tax;
  if (!tax || tax.rate == null) return [{ label: "GST", value: "Not set", muted: true }];
  const rows = [{ label: "Taxable amount", value: formatMoney(tax.taxableAmount) }];
  if (tax.intraState) {
    rows.push({ label: `CGST (${tax.rate / 2}%)`, value: formatMoney(tax.cgst) }, { label: `SGST (${tax.rate / 2}%)`, value: formatMoney(tax.sgst) });
  } else {
    rows.push({ label: `IGST (${tax.rate}%)`, value: formatMoney(tax.igst) });
  }
  return rows;
}

export function QuotationBreakdown({ quotation }: { quotation: QuotationView }) {
  const rows: { label: string; value: string; strong?: boolean; muted?: boolean }[] = [
    { label: "Items", value: formatMoney(quotation.subtotalAmount ?? quotation.totalAmount) },
    // One discount line per bundle, then the flat discount below.
    ...(quotation.bundleDiscounts ?? []).map((bundle) => ({
      label: `${bundle.name} (${bundle.percent}% off)`,
      value: `− ${formatMoney(bundle.amount)}`,
    })),
    {
      label: "Delivery",
      value: isPositive(quotation.deliveryCharge) ? formatMoney(quotation.deliveryCharge) : "None",
      muted: !isPositive(quotation.deliveryCharge),
    },
    {
      label: "Discount",
      value: isPositive(quotation.discountAmount) ? `− ${formatMoney(quotation.discountAmount)}` : "None",
      muted: !isPositive(quotation.discountAmount),
    },
    ...taxRows(quotation),
    { label: "Total", value: formatMoney(quotation.totalAmount), strong: true },
    quotation.depositWaiver?.waived
      ? {
          label: "Security deposit",
          value: `Waived (${formatMoney(quotation.depositWaiver.amount)})`,
          muted: true,
        }
      : { label: "Security deposit (refundable, no GST)", value: formatMoney(quotation.totalSecurityDeposit) },
    ...(quotation.policies ?? []).length
      ? [{ label: "Policies sent with it", value: (quotation.policies ?? []).map((p) => `${p.kind.toLowerCase()} v${p.version}`).join(", ") }]
      : [],
    { label: "Valid until", value: formatDay(quotation.validUntil) },
  ];
  return (
    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="text-xs text-muted-foreground">{row.label}</dt>
          <dd
            className={cn(
              "tabular mt-0.5",
              row.strong ? "text-xl font-semibold" : "text-base font-medium",
              row.muted && "text-muted-foreground",
            )}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A request that came in from the storefront and is waiting on the team: who asked, what they asked
 * for, what still needs filling in, and the buttons to price it and send it back. `actions` is the
 * quotation's action row, so Edit and Send live here rather than in the page header.
 */
export function ReceivedPanel({
  quotation,
  actions,
}: {
  quotation: QuotationView;
  actions: React.ReactNode;
}) {
  const revising = Boolean(quotation.changeRequestNote);
  const hasDeposit = isPositive(quotation.totalSecurityDeposit);
  const steps: { done: boolean; label: string; detail: string; optional?: boolean }[] = [
    {
      done: quotation.lines.length > 0,
      label: "Items priced",
      detail: `${quotation.lines.length} line${quotation.lines.length === 1 ? "" : "s"}, priced from your catalogue at the customer's rates`,
    },
    {
      done: hasDeposit,
      label: "Security deposit",
      detail: hasDeposit ? formatMoney(quotation.totalSecurityDeposit) : "Not set yet. Enter it when you edit (0 if there is none).",
    },
    {
      done: isPositive(quotation.deliveryCharge),
      optional: true,
      label: "Delivery charge",
      detail: isPositive(quotation.deliveryCharge) ? formatMoney(quotation.deliveryCharge) : "None. Add the actual cost if you are delivering.",
    },
    {
      done: isPositive(quotation.discountAmount),
      optional: true,
      label: "Discount",
      detail: isPositive(quotation.discountAmount) ? `− ${formatMoney(quotation.discountAmount)}` : "None. A flat amount off, if you are giving one.",
    },
    { done: Boolean(quotation.validUntil), label: "Valid until", detail: formatDay(quotation.validUntil) },
  ];

  return (
    <Card className="border-primary/40">
      <CardHeader className="flex-row items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {revising ? <MessageSquareWarning className="size-5" /> : <Inbox className="size-5" />}
        </span>
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base">
            {revising ? "The customer asked for changes" : "New request from the storefront"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {revising
              ? "Revise the quotation and send it again. The earlier version stays on record."
              : "Check the items, set the deposit and any delivery charge or discount, then send it to the customer."}
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {revising ? (
          <blockquote className="rounded-lg border-l-4 border-primary bg-muted/50 px-4 py-3 text-sm leading-6">
            {quotation.changeRequestNote}
            {quotation.changeRequestedAt ? (
              <footer className="mt-1 text-xs text-muted-foreground">
                {quotation.customerName}, {formatDateTime(quotation.changeRequestedAt)}
              </footer>
            ) : null}
          </blockquote>
        ) : null}

        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Customer</dt>
            <dd className="mt-0.5 font-medium">{quotation.customerName}</dd>
            {quotation.customerEmail ? <dd className="text-xs text-muted-foreground">{quotation.customerEmail}</dd> : null}
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Event date</dt>
            <dd className="mt-0.5 font-medium">{formatDay(quotation.eventDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Estimated total</dt>
            <dd className="tabular mt-0.5 font-medium">{formatMoney(quotation.totalAmount)}</dd>
          </div>
        </dl>

        <ul className="divide-y divide-border rounded-lg border border-border">
          {steps.map((step) => (
            <li key={step.label} className="flex items-start gap-3 px-4 py-2.5 text-sm">
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

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">{actions}</div>
      </CardContent>
    </Card>
  );
}

/** Every version sent to the customer, newest first. Real backend only: demo data keeps none. */
export function QuotationVersions({ quotationId }: { quotationId: string }) {
  const { data } = useQuery({
    queryKey: [...quotationKeys.byId(quotationId), "versions"],
    queryFn: ({ signal }) => listQuotationVersions(quotationId, signal),
    enabled: !IS_MOCK,
    retry: false,
  });
  if (!data || data.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Version history</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {[...data].reverse().map((version) => (
          <details key={version.versionNo} className="rounded-lg border border-border px-4 py-2.5 text-sm">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                Version {version.versionNo}
                <span className="ml-2 font-normal text-muted-foreground">sent {formatDateTime(version.sentAt)}</span>
              </span>
              <span className="tabular font-medium">{formatMoney(version.totalAmount)}</span>
            </summary>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              {version.lines.map((line, index) => (
                <p key={index} className="flex justify-between gap-3">
                  <span>
                    {line.productName} × {line.quantity} for {line.rentalDays} day{line.rentalDays === 1 ? "" : "s"}
                  </span>
                  <span className="tabular">{formatMoney(line.lineTotal)}</span>
                </p>
              ))}
              <p className="pt-1">
                Delivery {formatMoney(version.deliveryCharge)} · Discount {formatMoney(version.discountAmount)} ·
                Deposit {formatMoney(version.securityDeposit)}
              </p>
            </div>
          </details>
        ))}
      </CardContent>
    </Card>
  );
}

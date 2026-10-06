"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { getQuotation, quotationKeys } from "@/features/quotations/api";
import { getCompany, settingsKeys } from "@/features/settings/api";
import { formatMoney } from "@/lib/money";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const POLICY_TITLE: Record<string, string> = {
  CANCELLATION: "Cancellation policy",
  DAMAGE: "Damage policy",
  DELIVERY: "Delivery policy",
  TERMS: "Terms and conditions",
};

/** A quotation as it prints or saves to PDF (browser print): the same figures staff and the customer see. */
export function QuotationPrintPage({ quotationId }: { quotationId: string }) {
  const quotation = useQuery({
    queryKey: quotationKeys.byId(quotationId),
    queryFn: ({ signal }) => getQuotation(quotationId, signal),
    enabled: quotationId !== "",
  });
  const company = useQuery({ queryKey: settingsKeys.company, queryFn: ({ signal }) => getCompany(signal) });

  if (quotationId === "") return <Alert tone="error" title="No quotation was chosen." />;
  if (quotation.isPending || company.isPending) return <Skeleton className="h-96" />;
  if (quotation.isError) return <Alert tone="error" title="The quotation could not be loaded." />;
  const q = quotation.data;
  const c = company.data;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link
          href={`/quotations?id=${q.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to quotation {q.quotationNumber}
        </Link>
        <Button size="sm" onClick={() => window.print()}>
          <Printer /> Print / save as PDF
        </Button>
      </div>

      <article className="space-y-6 rounded-lg border border-border bg-card p-8 text-sm text-card-foreground print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-4">
          <div>
            {c?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.logoUrl} alt={c.name} className="mb-2 h-14 w-auto" />
            ) : null}
            <h1 className="text-lg font-semibold">{c?.name}</h1>
            <p className="text-muted-foreground">
              {[c?.addressLine, c?.city, c?.state, c?.postalCode].filter(Boolean).join(", ")}
            </p>
            <p className="text-muted-foreground">
              {c?.gstin ? `GSTIN ${c.gstin}` : ""}
              {c?.pan ? ` · PAN ${c.pan}` : ""}
            </p>
            <p className="text-muted-foreground">{[c?.primaryPhone, c?.publicEmail].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-semibold uppercase">Quotation</h2>
            <p className="tabular">{q.quotationNumber}</p>
            {q.sentAt ? <p className="text-muted-foreground">Sent {q.sentAt.slice(0, 10)}</p> : null}
            {q.validUntil ? <p className="text-muted-foreground">Valid until {q.validUntil}</p> : null}
          </div>
        </header>

        <section>
          <h3 className="text-xs font-medium uppercase text-muted-foreground">Prepared for</h3>
          <p className="font-medium">{q.customerName}</p>
          {q.customerEmail ? <p className="text-muted-foreground">{q.customerEmail}</p> : null}
          {q.eventDate ? <p className="text-muted-foreground">Event date {q.eventDate}</p> : null}
          {q.venue?.text ? <p className="text-muted-foreground">Venue {q.venue.text}</p> : null}
        </section>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="py-2">Item</th>
              <th className="py-2 text-right">Rate / day</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Days</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {q.lines.map((l) => (
              <tr key={l.id} className="border-b border-border">
                <td className="py-2">{l.productName}</td>
                <td className="tabular py-2 text-right">{formatMoney(l.unitRatePerDay)}</td>
                <td className="tabular py-2 text-right">{l.quantity}</td>
                <td className="tabular py-2 text-right">{l.rentalDays}</td>
                <td className="tabular py-2 text-right">{formatMoney(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto w-80 space-y-1">
          {q.subtotalAmount ? <Row label="Items" value={formatMoney(q.subtotalAmount)} /> : null}
          {(q.bundleDiscounts ?? []).map((d) => (
            <Row key={d.name} label={`${d.name} (${d.percent}% off)`} value={`− ${formatMoney(d.amount)}`} />
          ))}
          {q.discountAmount && Number(q.discountAmount.amount) > 0 ? (
            <Row label="Discount" value={`− ${formatMoney(q.discountAmount)}`} />
          ) : null}
          {q.tax ? <Row label="Taxable amount" value={formatMoney(q.tax.taxableAmount)} /> : null}
          {q.tax && q.tax.intraState ? (
            <>
              <Row label={`CGST (${(q.tax.rate ?? 0) / 2}%)`} value={formatMoney(q.tax.cgst)} />
              <Row label={`SGST (${(q.tax.rate ?? 0) / 2}%)`} value={formatMoney(q.tax.sgst)} />
            </>
          ) : null}
          {q.tax && !q.tax.intraState ? <Row label={`IGST (${q.tax.rate ?? 0}%)`} value={formatMoney(q.tax.igst)} /> : null}
          {q.deliveryCharge && Number(q.deliveryCharge.amount) > 0 ? (
            <Row label="Delivery" value={formatMoney(q.deliveryCharge)} />
          ) : null}
          <Row label="Total" value={formatMoney(q.totalAmount)} strong />
          <Row
            label={q.depositWaiver?.waived ? "Security deposit (waived)" : "Refundable security deposit (not taxed)"}
            value={q.depositWaiver?.waived ? formatMoney(q.depositWaiver.amount) : formatMoney(q.totalSecurityDeposit)}
          />
        </dl>

        {q.policies && q.policies.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            This quotation is subject to:{" "}
            {q.policies.map((p) => `${POLICY_TITLE[p.kind] ?? p.kind} (version ${p.version})`).join(", ")}.
          </p>
        ) : null}
      </article>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between border-t border-border pt-1 font-semibold" : "flex justify-between"}>
      <dt>{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}

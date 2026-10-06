"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { DOCUMENT_LABEL, billingKeys, getDocument, type DocumentBody } from "@/features/billing/api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const inr = (value: number | undefined | null) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(value);

/** An issued invoice or receipt as it prints. Nothing here can be edited: it is the stored snapshot. */
export function DocumentPage({ documentId }: { documentId: string }) {
  const doc = useQuery({
    queryKey: billingKeys.document(documentId),
    queryFn: ({ signal }) => getDocument(documentId, signal),
    enabled: documentId !== "",
  });
  if (documentId === "") return <Alert tone="error" title="No document was chosen." />;
  if (doc.isPending) return <Skeleton className="h-96" />;
  if (doc.isError) return <Alert tone="error" title="The document could not be loaded." />;
  const d = doc.data;
  const b: DocumentBody = d.body;
  const s = b.seller ?? {};

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link
          href={`/orders?id=${d.orderId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to order {d.orderNumber}
        </Link>
        <Button size="sm" onClick={() => window.print()}>
          <Printer /> Print
        </Button>
      </div>

      <article className="space-y-6 rounded-lg border border-border bg-card p-8 text-sm text-card-foreground print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-4">
          <div>
            {s.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.logoUrl} alt={s.name ?? "Logo"} className="mb-2 h-14 w-auto" />
            ) : null}
            <h1 className="text-lg font-semibold">{s.name}</h1>
            <p className="text-muted-foreground">
              {[s.address, s.city, s.state, s.postalCode].filter(Boolean).join(", ")}
            </p>
            <p className="text-muted-foreground">
              {s.gstin ? `GSTIN ${s.gstin}` : ""} {s.pan ? ` · PAN ${s.pan}` : ""}
            </p>
            <p className="text-muted-foreground">{[s.phone, s.email].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-semibold uppercase">{DOCUMENT_LABEL[d.kind]}</h2>
            <p className="tabular">{d.number}</p>
            <p className="text-muted-foreground">Dated {d.issuedOn}</p>
            <p className="text-muted-foreground">Order {d.orderNumber}</p>
          </div>
        </header>

        <section>
          <h3 className="text-xs font-medium uppercase text-muted-foreground">Billed to</h3>
          <p className="font-medium">{b.buyer?.name}</p>
          <p className="text-muted-foreground">
            {[b.buyer?.email, b.buyer?.phone, b.buyer?.state].filter(Boolean).join(" · ")}
            {b.buyer?.gstin ? ` · GSTIN ${b.buyer.gstin}` : ""}
          </p>
          {b.eventDate ? <p className="text-muted-foreground">Event date {b.eventDate}</p> : null}
        </section>

        {b.lines ? (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="py-2">Item</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Days</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {b.lines.map((l, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="py-2">{l.description}</td>
                  <td className="tabular py-2 text-right">{l.quantity}</td>
                  <td className="tabular py-2 text-right">{l.days}</td>
                  <td className="tabular py-2 text-right">{inr(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {b.payment ? (
          <section className="space-y-1">
            <p>
              Received with thanks {inr(b.payment.amount)} on {b.payment.paidOn} by {b.payment.mode.replace("_", " ").toLowerCase()}
              {b.payment.reference ? `, reference ${b.payment.reference}` : ""}
              {b.payment.purpose === "DEPOSIT" ? " (security deposit)" : ""}.
            </p>
            <p className="text-muted-foreground">
              Order total {inr(b.orderTotal)} · received to date {inr(b.receivedToDate)} · balance {inr(b.balanceAfter)}
            </p>
          </section>
        ) : null}

        {b.tax || b.total != null ? (
          <dl className="ml-auto w-72 space-y-1">
            <Row label="Items" value={inr(b.itemsTotal)} show={b.itemsTotal != null} />
            <Row label="Discounts" value={`− ${inr(b.discounts)}`} show={!!b.discounts} />
            <Row label="Taxable amount" value={inr(b.tax?.taxableAmount)} show={!!b.tax} />
            <Row label={`CGST (${b.tax ? b.tax.rate / 2 : 0}%)`} value={inr(b.tax?.cgst)} show={!!b.tax && b.tax.intraState} />
            <Row label={`SGST (${b.tax ? b.tax.rate / 2 : 0}%)`} value={inr(b.tax?.sgst)} show={!!b.tax && b.tax.intraState} />
            <Row label={`IGST (${b.tax?.rate ?? 0}%)`} value={inr(b.tax?.igst)} show={!!b.tax && !b.tax.intraState} />
            <Row label="Delivery" value={inr(b.delivery)} show={!!b.delivery} />
            <Row label="Total" value={inr(b.total)} strong show />
            <Row label="Credit notes applied" value={`− ${inr(b.creditNotesApplied)}`} show={!!b.creditNotesApplied} />
            <Row label="Received" value={`− ${inr(b.rentalReceived)}`} show={b.rentalReceived != null} />
            <Row label="Balance due" value={inr(b.balanceDue)} strong show={b.balanceDue != null} />
            <Row label="Refundable security deposit (not taxed)" value={inr(b.securityDeposit)} show={!!b.securityDeposit} />
          </dl>
        ) : null}

        {b.paymentsReceived && b.paymentsReceived.length > 0 ? (
          <section>
            <h3 className="mb-1 text-xs font-medium uppercase text-muted-foreground">Payments received</h3>
            <ul className="space-y-0.5">
              {b.paymentsReceived.map((p, i) => (
                <li key={i} className="flex justify-between">
                  <span>
                    {p.paidOn} · {p.mode.replace("_", " ").toLowerCase()} {p.receiptNumber ? `· ${p.receiptNumber}` : ""}
                  </span>
                  <span className="tabular">{inr(p.amount)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {b.deposit ? (
          <p className="text-muted-foreground">
            Security deposit: held {inr(b.deposit.held)}, refunded {inr(b.deposit.refunded)}, kept {inr(b.deposit.forfeited)} ({b.deposit.status.toLowerCase()}).
          </p>
        ) : null}

        <footer className="flex items-end justify-between gap-4 border-t border-border pt-4">
          <div className="text-muted-foreground">
            {s.bankName ? (
              <>
                <p className="font-medium text-foreground">Pay by bank transfer</p>
                <p>
                  {s.bankName} · A/c {s.bankAccount} · IFSC {s.bankIfsc}
                </p>
              </>
            ) : null}
            {s.upiId ? <p>UPI {s.upiId}</p> : null}
          </div>
          <div className="text-right">
            {s.signatureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.signatureUrl} alt="Signature" className="ml-auto mb-1 h-12 w-auto" />
            ) : null}
            <p className="text-muted-foreground">Authorised signatory</p>
          </div>
        </footer>
      </article>
    </div>
  );
}

function Row({ label, value, strong, show }: { label: string; value: string; strong?: boolean; show: boolean }) {
  if (!show) return null;
  return (
    <div className={strong ? "flex justify-between border-t border-border pt-1 font-semibold" : "flex justify-between"}>
      <dt>{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}

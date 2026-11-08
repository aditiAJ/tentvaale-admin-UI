"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCan } from "@/features/auth";
import { uploadMedia } from "@/features/master-data/api/backend";
import {
  DOCUMENT_LABEL,
  MODE_LABEL,
  PAYMENT_MODES,
  billingKeys,
  getOrderBalance,
  getOrderPaymentHistory,
  getQuotationBalance,
  getQuotationPaymentHistory,
  issueTaxInvoice,
  listDocuments,
  listQuotationDocuments,
  recordPayment,
  recordQuotationPayment,
  saveSchedule,
  type BillingDocument,
  type OrderBalance,
  type Payment,
  type PaymentMode,
  type PaymentPurpose,
} from "@/features/billing/api";
import { EventList, PaymentRowActions, PaymentStatusCell, apiMessage as message } from "@/features/billing/components/PaymentParts";
import { canMakeInvoicePdf, type InvoiceBody } from "@/features/billing/invoice/buildInvoiceDoc";
import { downloadInvoicePdf } from "@/features/billing/invoice/downloadInvoicePdf";
import { formatMoney } from "@/lib/money";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

/** Money received against one order, the balance, the instalments and the documents. */
export function OrderBillingPanel({
  orderId,
  quotationId,
  dispatched = false,
  acceptsOnPayment = false,
}: {
  /** An order... */
  orderId?: string;
  /** ...or a quotation that is not an order yet. */
  quotationId?: string;
  /** Goods have gone out: a payment on the order can no longer be voided. */
  dispatched?: boolean;
  /** A sent quotation: a verified payment accepts it. */
  acceptsOnPayment?: boolean;
}) {
  const forQuotation = !orderId;
  const targetId = (orderId ?? quotationId) as string;
  const canWrite = useCan("PAYMENT_WRITE");
  const canVerify = useCan("PAYMENT_VERIFY");
  const canVoid = useCan("PAYMENT_VOID");
  const canReadInvoices = useCan("INVOICE_READ");
  const canWriteInvoices = useCan("INVOICE_WRITE");
  const queryClient = useQueryClient();
  const balance = useQuery({
    queryKey: forQuotation ? billingKeys.quotation(targetId) : billingKeys.order(targetId),
    queryFn: ({ signal }) => (forQuotation ? getQuotationBalance(targetId, signal) : getOrderBalance(targetId, signal)),
  });
  const documents = useQuery({
    queryKey: forQuotation ? billingKeys.quotationDocuments(targetId) : billingKeys.documents(targetId),
    queryFn: ({ signal }) => (forQuotation ? listQuotationDocuments(targetId, signal) : listDocuments(targetId, signal)),
    enabled: canReadInvoices,
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["billing"] });
    queryClient.invalidateQueries({ queryKey: ["quotations"] });
  };

  const invoice = useMutation({
    mutationFn: () => issueTaxInvoice(targetId),
    onSuccess: (d) => {
      refresh();
      toast.success(`${DOCUMENT_LABEL[d.kind]} ${d.number} issued`);
    },
    onError: (e) => toast.error(message(e, "Could not issue the invoice.")),
  });

  if (balance.isPending) return <Skeleton className="h-40" />;
  if (balance.isError) return <Alert tone="error" title="The payments could not be loaded." />;
  const b = balance.data;
  // The order's one invoice. It is issued by the system the moment the order is paid in full (rental and deposit, verified).
  const invoiceDoc = documents.data?.find((d) => d.kind === "TAX_INVOICE");
  const paidInFull =
    !forQuotation &&
    Number(b.verifiedPaid.amount) > 0 &&
    Number(b.balance.amount) <= 0 &&
    Number(b.depositReceived.amount) >= Number(b.depositRequired.amount);

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Payments</CardTitle>
        {canWriteInvoices && paidInFull && documents.data && !invoiceDoc ? (
          <Button size="sm" variant="outline" onClick={() => invoice.mutate()} disabled={invoice.isPending}>
            Issue invoice now
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid gap-4 sm:grid-cols-5">
          <Figure label="Order total" value={formatMoney(b.total)} />
          <Figure label="Credit applied" value={formatMoney(b.creditApplied)} />
          <Figure label="Received (verified)" value={formatMoney(b.verifiedPaid)} />
          <Figure label="Waiting to be verified" value={formatMoney(b.pendingVerification)} />
          <Figure label="Balance" value={formatMoney(b.balance)} strong />
        </dl>
        {!forQuotation && b.paymentStage === "AWAITED" ? (
          <Alert tone="warning" title="Payment awaited">
            This order cannot be dispatched until a payment is recorded against it. The customer sees &quot;Payment awaited&quot;.
          </Alert>
        ) : null}
        {!forQuotation && b.paymentStage === "CONFIRMED" ? (
          <p className="text-sm text-muted-foreground">Payment confirmed: the order can be dispatched.</p>
        ) : null}
        {forQuotation && acceptsOnPayment ? (
          <p className="text-sm text-muted-foreground">
            Once Accounts verify a payment recorded here, this quotation is accepted. The payment then moves onto the order when it is created.
          </p>
        ) : null}
        {Number(b.depositRequired.amount) > 0 ? (
          <p className="text-sm text-muted-foreground">
            Security deposit {formatMoney(b.depositRequired)}; received {formatMoney(b.depositReceived)}; still to receive{" "}
            {formatMoney({ ...b.depositRequired, amount: remainingFor(b, "DEPOSIT") })}.
          </p>
        ) : null}

        {b.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payment has been recorded yet.</p>
        ) : (
          <TableWrapper>
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>For</TH>
                  <TH>Mode</TH>
                  <TH>Reference</TH>
                  <TH className="text-right">Amount</TH>
                  <TH>Status</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {b.payments.map((p) => (
                  <PaymentRow
                    key={p.id}
                    payment={p}
                    canWrite={canWrite}
                    canVerify={canVerify}
                    canVoid={canVoid}
                    voidBlockedReason={
                      invoiceDoc
                        ? "An invoice has been issued for this order; a payment on it can no longer be voided."
                        : dispatched
                          ? "The order has been dispatched; a payment on it can no longer be voided."
                          : undefined
                    }
                    onChanged={refresh}
                  />
                ))}
              </TBody>
            </Table>
          </TableWrapper>
        )}
        {b.payments.length > 0 ? <PaymentTimeline targetId={targetId} forQuotation={forQuotation} payments={b.payments} /> : null}

        {!forQuotation && b.schedule.length > 0 ? (
          <div>
            <h3 className="mb-2 text-sm font-medium">Agreed instalments</h3>
            <ul className="space-y-1 text-sm">
              {b.schedule.map((line) => (
                <li key={line.id} className="flex items-center justify-between gap-3">
                  <span>
                    {line.label} <span className="text-muted-foreground">due {line.dueOn}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="tabular">{formatMoney(line.amount)}</span>
                    <Badge variant={line.paid ? "success" : "default"}>{line.paid ? "Paid" : "Open"}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {canWrite ? (
          <>
            <RecordPaymentForm targetId={targetId} forQuotation={forQuotation} balance={b} canVerify={canVerify} onDone={refresh} />
            {forQuotation ? null : <ScheduleForm orderId={targetId} onDone={refresh} />}
          </>
        ) : null}

        {canReadInvoices && !forQuotation && documents.data ? (
          <InvoiceBlock invoice={invoiceDoc} paidInFull={paidInFull} />
        ) : null}

        {canReadInvoices && documents.data && documents.data.filter((d) => d.id !== invoiceDoc?.id).length > 0 ? (
          <div>
            <h3 className="mb-2 text-sm font-medium">Documents</h3>
            <ul className="space-y-1 text-sm">
              {documents.data.filter((d) => d.id !== invoiceDoc?.id).map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <FileText className="size-4 text-muted-foreground" />
                    {DOCUMENT_LABEL[d.kind]} <span className={d.cancelled ? "tabular line-through" : "tabular"}>{d.number}</span>
                    <span className="text-muted-foreground">{d.issuedOn}</span>
                    {d.cancelled ? <Badge variant="destructive">cancelled</Badge> : null}
                  </span>
                  <Link href={`/billing/document?id=${d.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Open / print
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** The order's invoice: its number, date and amount, with the PDF; or why there is none yet. */
function InvoiceBlock({ invoice, paidInFull }: { invoice: BillingDocument | undefined; paidInFull: boolean }) {
  const [making, setMaking] = useState(false);
  if (!invoice) {
    return (
      <p className="text-sm text-muted-foreground">
        {paidInFull
          ? "This order is paid in full but has no invoice yet. Use \"Issue invoice now\"."
          : "The invoice is issued automatically once the rental and the deposit are both paid and verified."}
      </p>
    );
  }
  const body = invoice.body as unknown as InvoiceBody;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm">
      <div className="space-y-0.5">
        <p className="font-medium">
          Tax invoice <span className="tabular">{invoice.number}</span> <Badge variant="success">paid in full</Badge>
        </p>
        <p className="text-muted-foreground">
          Issued {invoice.issuedOn} · {formatMoney(invoice.total)}
          {body.summary && Number(body.summary.securityDeposit) > 0 ? " (includes the refundable deposit)" : ""}
        </p>
      </div>
      <div className="flex gap-2">
        <Link href={`/billing/document?id=${invoice.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Open
        </Link>
        {canMakeInvoicePdf({ body }) ? (
          <Button
            size="sm"
            disabled={making}
            onClick={async () => {
              setMaking(true);
              try {
                await downloadInvoicePdf({ number: invoice.number, issuedOn: invoice.issuedOn, orderNumber: invoice.orderNumber ?? "", body });
              } catch {
                toast.error("The invoice PDF could not be made. Please try again.");
              } finally {
                setMaking(false);
              }
            }}
          >
            {making ? <Loader2 className="animate-spin" /> : <Download />} Download PDF
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={strong ? "tabular mt-0.5 text-lg font-semibold" : "tabular mt-0.5 font-semibold"}>{value}</dd>
    </div>
  );
}

function PaymentRow({
  payment,
  canWrite,
  canVerify,
  canVoid,
  voidBlockedReason,
  onChanged,
}: {
  payment: Payment;
  canWrite: boolean;
  canVerify: boolean;
  canVoid: boolean;
  voidBlockedReason?: string;
  onChanged: () => void;
}) {
  return (
    <TR>
      <TD>{payment.paidOn}</TD>
      <TD>{payment.purpose === "DEPOSIT" ? "Deposit" : "Rental"}</TD>
      <TD>{MODE_LABEL[payment.mode]}</TD>
      <TD>
        {payment.reference ?? "—"}
        {payment.proofUrl ? (
          <a href={payment.proofUrl} target="_blank" rel="noreferrer" className="ml-2 text-xs underline">
            proof
          </a>
        ) : null}
      </TD>
      <TD className="tabular text-right">{formatMoney(payment.amount)}</TD>
      <TD>
        <PaymentStatusCell payment={payment} />
      </TD>
      <TD>
        <PaymentRowActions
          payment={payment}
          canWrite={canWrite}
          canVerify={canVerify}
          canVoid={canVoid}
          voidBlockedReason={voidBlockedReason}
          onChanged={onChanged}
        />
      </TD>
    </TR>
  );
}

/** Everything that happened to the order's payments, oldest first. Loaded only when opened. */
function PaymentTimeline({ targetId, forQuotation, payments }: { targetId: string; forQuotation: boolean; payments: Payment[] }) {
  const [open, setOpen] = useState(false);
  const history = useQuery({
    queryKey: billingKeys.orderHistory(targetId),
    queryFn: ({ signal }) => (forQuotation ? getQuotationPaymentHistory(targetId, signal) : getOrderPaymentHistory(targetId, signal)),
    enabled: open,
  });
  const describe = (paymentId: string) => {
    const p = payments.find((x) => x.id === paymentId);
    return p ? `${formatMoney(p.amount)} · ${MODE_LABEL[p.mode]}${p.purpose === "DEPOSIT" ? " · deposit" : ""}` : "";
  };
  return (
    <div>
      <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? "Hide payment history" : "Show payment history"}
      </Button>
      {open ? (
        <div className="mt-2">
          {history.isPending ? <Skeleton className="h-20" /> : null}
          {history.isError ? <Alert tone="error" title="The history could not be loaded." /> : null}
          {history.data ? <EventList events={history.data} describe={describe} /> : null}
        </div>
      ) : null}
    </div>
  );
}

/** What can still be recorded for one purpose: what is due less what is already verified or waiting to be (rejected and voided money frees the room). */
function remainingFor(b: OrderBalance, purpose: PaymentPurpose): number {
  const counted = (p: Payment) => p.purpose === purpose && p.status !== "REJECTED" && p.status !== "VOIDED";
  const committed = b.payments.filter(counted).reduce((sum, p) => sum + Number(p.amount.amount), 0);
  const due =
    purpose === "DEPOSIT"
      ? Number(b.depositRequired.amount)
      : Number(b.total.amount) - Number(b.creditApplied.amount);
  return Math.max(0, Math.round((due - committed) * 100) / 100);
}

function RecordPaymentForm({
  targetId,
  forQuotation,
  balance,
  canVerify,
  onDone,
}: {
  targetId: string;
  forQuotation: boolean;
  balance: OrderBalance;
  canVerify: boolean;
  onDone: () => void;
}) {
  const [purpose, setPurpose] = useState<PaymentPurpose>("RENTAL");
  const [mode, setMode] = useState<PaymentMode>("UPI");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  /** Someone who may verify can confirm in the same step (the usual case at the counter) or leave it to be checked later, which keeps it editable. */
  const [confirmNow, setConfirmNow] = useState(true);
  const verifyNow = canVerify && confirmNow;
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      let proofUrl: string | undefined;
      if (proof) {
        const [result] = await uploadMedia([proof]);
        if (!result?.ok || !result.url) throw new Error(result?.error ?? "The proof could not be uploaded.");
        proofUrl = result.url;
      }
      return (forQuotation ? recordQuotationPayment : recordPayment)(targetId, {
        purpose,
        mode,
        amount: Number(amount),
        reference: reference.trim() || undefined,
        paidOn: paidOn || undefined,
        proofUrl,
        verifyNow: verifyNow || undefined,
      });
    },
    onSuccess: () => {
      setError(null);
      setAmount("");
      setReference("");
      setProof(null);
      onDone();
      toast.success(verifyNow ? "Payment recorded and confirmed. The receipt is issued." : "Payment recorded. It counts once it is verified.");
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not record the payment."),
  });

  const amountNumber = Number(amount);
  const remaining = remainingFor(balance, purpose);
  const tooMuch = amountNumber > remaining;
  const invalid = !(amountNumber > 0) || tooMuch;

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <h3 className="text-sm font-medium">Record a payment received</h3>
      {error ? <Alert tone="error" title={error} /> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="For">
          {(props) => (
            <Select {...props} value={purpose} onChange={(e) => setPurpose(e.target.value as PaymentPurpose)}>
              <option value="RENTAL">Rental</option>
              <option value="DEPOSIT">Security deposit</option>
            </Select>
          )}
        </Field>
        <Field label="Mode">
          {(props) => (
            <Select {...props} value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)}>
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {MODE_LABEL[m]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Amount (₹)" required>
          {(props) => <Input {...props} value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} />}
        </Field>
        <Field
          label="Still to receive (₹)"
          error={tooMuch ? `At most ${remaining} can be recorded for ${purpose === "DEPOSIT" ? "the deposit" : "the rental"}` : undefined}
        >
          {(props) => <Input {...props} value={String(remaining)} readOnly />}
        </Field>
        <Field label="Reference (UTR, cheque no.)">
          {(props) => <Input {...props} value={reference} onChange={(e) => setReference(e.target.value)} />}
        </Field>
        <Field label="Paid on" hint="Today when left empty">
          {(props) => <Input {...props} type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />}
        </Field>
        <Field label="Proof (screenshot or photo)">
          {(props) => (
            <Input {...props} type="file" accept="image/*" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
          )}
        </Field>
      </div>
      {canVerify ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={confirmNow} onChange={(e) => setConfirmNow(e.target.checked)} />
          Confirm now and issue the receipt
          <span className="text-xs text-muted-foreground">(untick to leave it waiting to be verified; it can be edited until then)</span>
        </label>
      ) : null}
      <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || invalid}>
        {save.isPending ? <Loader2 className="animate-spin" /> : null}
        Record payment
      </Button>
    </div>
  );
}

interface DraftLine {
  label: string;
  dueOn: string;
  amount: string;
}

function ScheduleForm({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([{ label: "Advance", dueOn: "", amount: "" }]);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () =>
      saveSchedule(
        orderId,
        lines.map((l) => ({ label: l.label.trim(), dueOn: l.dueOn, amount: Number(l.amount) })),
      ),
    onSuccess: () => {
      setError(null);
      setOpen(false);
      onDone();
      toast.success("Instalments saved");
    },
    onError: (e) => setError(message(e, "Could not save the instalments.")),
  });
  const update = (index: number, patch: Partial<DraftLine>) =>
    setLines((all) => all.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  const invalid = lines.some((l) => !l.label.trim() || !l.dueOn || !(Number(l.amount) > 0));

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Set instalments
      </Button>
    );
  }
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <h3 className="text-sm font-medium">Agreed instalments (replaces the current ones)</h3>
      {error ? <Alert tone="error" title={error} /> : null}
      {lines.map((line, i) => (
        <div key={i} className="grid gap-3 sm:grid-cols-4">
          <Field label="Name">
            {(props) => <Input {...props} value={line.label} onChange={(e) => update(i, { label: e.target.value })} />}
          </Field>
          <Field label="Due on">
            {(props) => <Input {...props} type="date" value={line.dueOn} onChange={(e) => update(i, { dueOn: e.target.value })} />}
          </Field>
          <Field label="Amount (₹)">
            {(props) => <Input {...props} inputMode="decimal" value={line.amount} onChange={(e) => update(i, { amount: e.target.value })} />}
          </Field>
          <div className="flex items-end">
            <Button size="sm" variant="outline" onClick={() => setLines((all) => all.filter((_, j) => j !== i))} disabled={lines.length === 1}>
              Remove
            </Button>
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setLines((all) => [...all, { label: "", dueOn: "", amount: "" }])}>
          Add instalment
        </Button>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || invalid}>
          Save
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

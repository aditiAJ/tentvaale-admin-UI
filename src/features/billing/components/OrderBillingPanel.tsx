"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FileText, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useCan } from "@/features/auth";
import { uploadMedia } from "@/features/master-data/api/backend";
import {
  DOCUMENT_LABEL,
  MODE_LABEL,
  PAYMENT_MODES,
  billingKeys,
  getOrderBalance,
  getQuotationBalance,
  issueFinalInvoice,
  issueTaxInvoice,
  listDocuments,
  listQuotationDocuments,
  recordPayment,
  recordQuotationPayment,
  rejectPayment,
  saveSchedule,
  verifyPayment,
  type Payment,
  type PaymentMode,
  type PaymentPurpose,
  type PaymentStatus,
} from "@/features/billing/api";
import { ApiError } from "@/services/api-client";
import { formatMoney } from "@/lib/money";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const STATUS_VARIANT: Record<PaymentStatus, "warning" | "success" | "destructive"> = {
  RECORDED: "warning",
  VERIFIED: "success",
  REJECTED: "destructive",
};

const message = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/** Money received against one order, the balance, the instalments and the documents. */
export function OrderBillingPanel({
  orderId,
  quotationId,
  completed = false,
  acceptsOnPayment = false,
}: {
  /** An order... */
  orderId?: string;
  /** ...or a quotation that is not an order yet. */
  quotationId?: string;
  completed?: boolean;
  /** A sent quotation: a verified payment accepts it. */
  acceptsOnPayment?: boolean;
}) {
  const forQuotation = !orderId;
  const targetId = (orderId ?? quotationId) as string;
  const canWrite = useCan("PAYMENT_WRITE");
  const canVerify = useCan("PAYMENT_VERIFY");
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

  const verify = useMutation({
    mutationFn: (id: string) => verifyPayment(id),
    onSuccess: (p) => {
      refresh();
      toast.success(`Payment verified. Receipt ${p.receiptNumber}`);
    },
    onError: (e) => toast.error(message(e, "Could not verify the payment.")),
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectPayment(id, reason),
    onSuccess: () => {
      refresh();
      toast.success("Payment rejected");
    },
    onError: (e) => toast.error(message(e, "Could not reject the payment.")),
  });
  const invoice = useMutation({
    mutationFn: (kind: "tax" | "final") => (kind === "tax" ? issueTaxInvoice(targetId) : issueFinalInvoice(targetId)),
    onSuccess: (d) => {
      refresh();
      toast.success(`${DOCUMENT_LABEL[d.kind]} ${d.number} issued`);
    },
    onError: (e) => toast.error(message(e, "Could not issue the invoice.")),
  });

  if (balance.isPending) return <Skeleton className="h-40" />;
  if (balance.isError) return <Alert tone="error" title="The payments could not be loaded." />;
  const b = balance.data;
  const hasInvoice = (kind: string) => documents.data?.some((d) => d.kind === kind) ?? false;

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Payments</CardTitle>
        {canWriteInvoices && !forQuotation ? (
          <div className="flex gap-2">
            {!hasInvoice("TAX_INVOICE") ? (
              <Button size="sm" variant="outline" onClick={() => invoice.mutate("tax")} disabled={invoice.isPending}>
                Issue tax invoice
              </Button>
            ) : null}
            {completed && !hasInvoice("FINAL_INVOICE") ? (
              <Button size="sm" variant="outline" onClick={() => invoice.mutate("final")} disabled={invoice.isPending}>
                Issue final invoice
              </Button>
            ) : null}
          </div>
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
        {forQuotation && acceptsOnPayment ? (
          <p className="text-sm text-muted-foreground">
            Once Accounts verify a payment recorded here, this quotation is accepted. The payment then moves onto the order when it is created.
          </p>
        ) : null}
        {Number(b.depositRequired.amount) > 0 ? (
          <p className="text-sm text-muted-foreground">
            Security deposit {formatMoney(b.depositRequired)}; received and verified {formatMoney(b.depositReceived)}.
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
                    canVerify={canVerify}
                    busy={verify.isPending || reject.isPending}
                    onVerify={() => verify.mutate(p.id)}
                    onReject={(reason) => reject.mutate({ id: p.id, reason })}
                  />
                ))}
              </TBody>
            </Table>
          </TableWrapper>
        )}

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
            <RecordPaymentForm targetId={targetId} forQuotation={forQuotation} onDone={refresh} />
            {forQuotation ? null : <ScheduleForm orderId={targetId} onDone={refresh} />}
          </>
        ) : null}

        {canReadInvoices && documents.data && documents.data.length > 0 ? (
          <div>
            <h3 className="mb-2 text-sm font-medium">Documents</h3>
            <ul className="space-y-1 text-sm">
              {documents.data.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <FileText className="size-4 text-muted-foreground" />
                    {DOCUMENT_LABEL[d.kind]} <span className="tabular">{d.number}</span>
                    <span className="text-muted-foreground">{d.issuedOn}</span>
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
  canVerify,
  busy,
  onVerify,
  onReject,
}: {
  payment: Payment;
  canVerify: boolean;
  busy: boolean;
  onVerify: () => void;
  onReject: (reason: string) => void;
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
        <Badge variant={STATUS_VARIANT[payment.status]}>{payment.status.toLowerCase()}</Badge>
        {payment.receiptNumber ? <div className="text-xs text-muted-foreground">{payment.receiptNumber}</div> : null}
        {payment.rejectReason ? <div className="text-xs text-muted-foreground">{payment.rejectReason}</div> : null}
      </TD>
      <TD>
        {canVerify && payment.status === "RECORDED" ? (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={busy} onClick={onVerify}>
              <Check /> Verify
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => {
                const reason = window.prompt("Why is this payment rejected?");
                if (reason && reason.trim()) onReject(reason.trim());
              }}
            >
              <X /> Reject
            </Button>
          </div>
        ) : null}
      </TD>
    </TR>
  );
}

function RecordPaymentForm({ targetId, forQuotation, onDone }: { targetId: string; forQuotation: boolean; onDone: () => void }) {
  const [purpose, setPurpose] = useState<PaymentPurpose>("RENTAL");
  const [mode, setMode] = useState<PaymentMode>("UPI");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState("");
  const [proof, setProof] = useState<File | null>(null);
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
      });
    },
    onSuccess: () => {
      setError(null);
      setAmount("");
      setReference("");
      setProof(null);
      onDone();
      toast.success("Payment recorded. It counts once Accounts verify it.");
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not record the payment."),
  });

  const amountNumber = Number(amount);
  const invalid = !(amountNumber > 0);

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

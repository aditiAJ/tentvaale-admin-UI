"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, History, Loader2, Pencil, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { uploadMedia } from "@/features/master-data/api/backend";
import {
  EVENT_LABEL,
  MODE_LABEL,
  PAYMENT_MODES,
  STATUS_LABEL,
  billingKeys,
  editPayment,
  getPaymentHistory,
  rejectPayment,
  verifyPayment,
  voidPayment,
  type Payment,
  type PaymentEvent,
  type PaymentMode,
  type PaymentStatus,
} from "@/features/billing/api";
import { ApiError } from "@/services/api-client";
import { formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const STATUS_VARIANT: Record<PaymentStatus, "warning" | "success" | "destructive" | "default"> = {
  RECORDED: "warning",
  VERIFIED: "success",
  REJECTED: "destructive",
  VOIDED: "default",
};

export const apiMessage = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/** The status badge with what explains it underneath: the receipt, or the reason it was rejected or voided. */
export function PaymentStatusCell({ payment }: { payment: Payment }) {
  return (
    <>
      <Badge variant={STATUS_VARIANT[payment.status]}>{STATUS_LABEL[payment.status].toLowerCase()}</Badge>
      {payment.receiptNumber ? (
        <div className={payment.status === "VOIDED" ? "text-xs text-muted-foreground line-through" : "text-xs text-muted-foreground"}>
          {payment.receiptNumber}
          {payment.status === "VOIDED" ? <span className="no-underline"> (cancelled)</span> : null}
        </div>
      ) : null}
      {payment.rejectReason ? <div className="text-xs text-muted-foreground">{payment.rejectReason}</div> : null}
      {payment.voidReason ? (
        <div className="text-xs text-muted-foreground">
          {payment.voidReason}
          {payment.voidedBy ? ` — ${payment.voidedBy}` : ""}
        </div>
      ) : null}
    </>
  );
}

/**
 * Everything staff can do to one payment, with the dialogs each needs. Shared by the order panel and the payments
 * page so the rules (who sees which button, what a refusal says) live in one place. The server decides what is
 * allowed; the buttons only hide what the person could never do.
 */
export function PaymentRowActions({
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
  /** Why this payment cannot be voided right now (e.g. the order was dispatched), shown as the button's hint. */
  voidBlockedReason?: string;
  onChanged: () => void;
}) {
  const [dialog, setDialog] = useState<"reject" | "void" | "edit" | "history" | null>(null);
  const close = () => setDialog(null);
  const verify = useMutation({
    mutationFn: () => verifyPayment(payment.id),
    onSuccess: (p) => {
      onChanged();
      toast.success(`Payment verified. Receipt ${p.receiptNumber}`);
    },
    onError: (e) => toast.error(apiMessage(e, "Could not verify the payment.")),
  });

  return (
    <div className="flex flex-wrap gap-1">
      {canVerify && payment.status === "RECORDED" ? (
        <>
          <Button size="sm" variant="outline" disabled={verify.isPending} onClick={() => verify.mutate()}>
            {verify.isPending ? <Loader2 className="animate-spin" /> : <Check />} Verify
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDialog("reject")}>
            <X /> Reject
          </Button>
        </>
      ) : null}
      {canWrite && payment.status === "RECORDED" ? (
        <Button size="sm" variant="outline" onClick={() => setDialog("edit")}>
          <Pencil /> Edit
        </Button>
      ) : null}
      {canVoid && payment.status === "VERIFIED" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={Boolean(voidBlockedReason)}
          title={voidBlockedReason}
          onClick={() => setDialog("void")}
        >
          <Undo2 /> Void
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" onClick={() => setDialog("history")} aria-label="Payment history">
        <History /> History
      </Button>

      {dialog === "reject" ? (
        <ReasonDialog
          title="Reject this payment"
          description={`${formatMoney(payment.amount)} on ${payment.orderNumber ?? payment.quotationNumber ?? "this order"}. It will not count, and the money can be recorded again.`}
          label="Why is it rejected?"
          confirmLabel="Reject payment"
          action={(reason) => rejectPayment(payment.id, reason)}
          onDone={() => {
            close();
            onChanged();
            toast.success("Payment rejected");
          }}
          onClose={close}
        />
      ) : null}
      {dialog === "void" ? (
        <ReasonDialog
          title="Void this payment"
          description={`${formatMoney(payment.amount)}, receipt ${payment.receiptNumber ?? ""}. It stays on record and its receipt shows as cancelled, but it stops counting toward the balance. Record the correct payment afterwards.`}
          label="Why is it being voided?"
          confirmLabel="Void payment"
          action={(reason) => voidPayment(payment.id, reason)}
          onDone={() => {
            close();
            onChanged();
            toast.success("Payment voided");
          }}
          onClose={close}
        />
      ) : null}
      {dialog === "edit" ? (
        <EditPaymentDialog
          payment={payment}
          onDone={() => {
            close();
            onChanged();
            toast.success("Payment updated");
          }}
          onClose={close}
        />
      ) : null}
      {dialog === "history" ? <PaymentHistoryDialog payment={payment} onClose={close} /> : null}
    </div>
  );
}

/**
 * Asks for a reason, then runs the action. Stays open on failure and shows the server's own sentence (for a void
 * that is usually "the order has already been dispatched"), which closing would throw away.
 */
function ReasonDialog({
  title,
  description,
  label,
  confirmLabel,
  action,
  onDone,
  onClose,
}: {
  title: string;
  description: string;
  label: string;
  confirmLabel: string;
  action: (reason: string) => Promise<unknown>;
  onDone: () => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: () => action(reason.trim()),
    onSuccess: onDone,
    onError: (e) => setError(apiMessage(e, "That did not work. Please try again.")),
  });
  const invalid = reason.trim().length === 0 || reason.length > 500;

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={run.isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={run.isPending || invalid}
            onClick={() => {
              setError(null);
              run.mutate();
            }}
          >
            {run.isPending ? <Loader2 className="animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <Alert tone="error" title={error} /> : null}
        <Field label={label} required hint="Kept in the payment's history with your name.">
          {(props) => <Textarea {...props} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />}
        </Field>
      </div>
    </Dialog>
  );
}

/** Corrects a payment nobody has checked yet. The purpose (rental or deposit) is fixed: it decides which limit applies. */
function EditPaymentDialog({ payment, onDone, onClose }: { payment: Payment; onDone: () => void; onClose: () => void }) {
  const [mode, setMode] = useState<PaymentMode>(payment.mode);
  const [amount, setAmount] = useState(String(payment.amount.amount));
  const [reference, setReference] = useState(payment.reference ?? "");
  const [paidOn, setPaidOn] = useState(payment.paidOn);
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
      return editPayment(payment.id, {
        mode,
        amount: Number(amount),
        reference: reference.trim() || undefined,
        paidOn: paidOn || undefined,
        proofUrl,
      });
    },
    onSuccess: onDone,
    onError: (e) => setError(e instanceof Error ? e.message : "Could not update the payment."),
  });
  const invalid = !(Number(amount) > 0);

  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit payment"
      description="Only possible until the payment is verified. Every change is kept in its history."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={save.isPending || invalid}
            onClick={() => {
              setError(null);
              save.mutate();
            }}
          >
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <Alert tone="error" title={error} /> : null}
        <div className="grid gap-3 sm:grid-cols-2">
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
          <Field label="Paid on">
            {(props) => <Input {...props} type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />}
          </Field>
        </div>
        <Field
          label="Replace proof (screenshot or photo)"
          hint={payment.proofUrl ? "Leave empty to keep the proof already on file." : "No proof on file yet."}
        >
          {(props) => <Input {...props} type="file" accept="image/*" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />}
        </Field>
      </div>
    </Dialog>
  );
}

/** What happened to one payment, oldest first. */
function PaymentHistoryDialog({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const history = useQuery({
    queryKey: billingKeys.paymentHistory(payment.id),
    queryFn: ({ signal }) => getPaymentHistory(payment.id, signal),
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title="Payment history"
      description={`${formatMoney(payment.amount)} · ${payment.orderNumber ?? payment.quotationNumber ?? ""}`}
      footer={
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      {history.isPending ? <Skeleton className="h-24" /> : null}
      {history.isError ? <Alert tone="error" title="The history could not be loaded." /> : null}
      {history.data ? <EventList events={history.data} /> : null}
    </Dialog>
  );
}

const FIELD_LABEL: Record<string, string> = {
  mode: "Mode",
  amount: "Amount",
  reference: "Reference",
  paidOn: "Paid on",
  proofUrl: "Proof",
};

function formatChange(field: string, value: string | null): string {
  if (value == null || value === "") return "none";
  if (field === "mode") return MODE_LABEL[value as PaymentMode] ?? value;
  if (field === "amount") return formatMoney({ amount: value, currency: "INR" });
  if (field === "proofUrl") return "a photo";
  return value;
}

/** The events of one payment, or of a whole order when `describe` says which payment each one belongs to. */
export function EventList({ events, describe }: { events: PaymentEvent[]; describe?: (paymentId: string) => string }) {
  if (events.length === 0) return <p className="text-sm text-muted-foreground">Nothing has been recorded yet.</p>;
  return (
    <ol className="space-y-3">
      {events.map((e) => (
        <li key={e.id} className="border-l-2 border-border pl-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{EVENT_LABEL[e.type]}</span>
            {describe ? <span className="text-muted-foreground">{describe(e.paymentId)}</span> : null}
          </div>
          <div className="text-xs text-muted-foreground">
            {e.actor} · {formatDateTime(e.occurredAt)}
          </div>
          {e.note ? (
            <p className="text-xs">
              {e.type === "VERIFIED" ? "Receipt " : e.type === "ATTACHED_TO_ORDER" ? "Order " : ""}
              {e.note}
            </p>
          ) : null}
          {e.changes ? (
            <ul className="mt-1 space-y-0.5 text-xs">
              {Object.entries(e.changes).map(([field, change]) => (
                <li key={field}>
                  {FIELD_LABEL[field] ?? field}: <span className="text-muted-foreground line-through">{formatChange(field, change.from)}</span>{" "}
                  → {formatChange(field, change.to)}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

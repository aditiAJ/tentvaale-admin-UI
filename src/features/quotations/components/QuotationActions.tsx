"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, Pencil, Send, X } from "lucide-react";
import { toast } from "sonner";
import {
  acceptQuotation,
  duplicateQuotation,
  quotationKeys,
  rejectQuotation,
  sendQuotation,
} from "@/features/quotations/api";
import type { QuotationView } from "@/features/quotations/types";
import { useCan } from "@/features/auth";
import { isFromStorefront } from "@/features/quotations/source";
import { dashboardKeys } from "@/features/dashboard/api";
import { ApiError } from "@/services/api-client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Pending = "send" | "accept" | "reject" | null;

/**
 * The actions a quotation offers, and to whom.
 *
 * The lifecycle is DRAFT, SENT, ACCEPTED, CONVERTED (plus REJECTED and EXPIRED, which end it):
 * sales drafts, edits and sends; only an Admin accepts or rejects (QUOTATION_APPROVE); only an
 * ACCEPTED quotation converts. Editing a SENT quotation sends it back to DRAFT, so the edit link
 * warns first. Each button is shown only when the status allows it and the user holds the
 * permission; the backend enforces the same rules and its refusal is shown verbatim.
 */
export function QuotationActions({
  quotation,
  onConvert,
  received = false,
}: {
  quotation: QuotationView;
  onConvert: () => void;
  /** Shown in the Received panel: bigger buttons, and wording for pricing a customer's request. */
  received?: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Pending>(null);
  const canWrite = useCan("QUOTATION_WRITE");
  const canApprove = useCan("QUOTATION_APPROVE");
  const canConvert = useCan("ORDER_WRITE");
  const { status } = quotation;
  const size = received ? "default" : "sm";
  // An order from a storefront request is placed by the customer, so staff do not convert it.
  const fromStorefront = isFromStorefront(quotation);

  /** The detail, every list and the dashboard all move when a quotation changes status. */
  const refresh = (updated: QuotationView) => {
    queryClient.setQueryData(quotationKeys.byId(updated.id), updated);
    queryClient.invalidateQueries({ queryKey: quotationKeys.list });
    queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
  };

  const duplicate = useMutation({
    mutationFn: () => duplicateQuotation(quotation.id),
    onSuccess: (copy) => {
      refresh(copy);
      toast.success(`${copy.quotationNumber} created as a draft`);
      router.push(`/quotations?id=${copy.id}`);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Could not duplicate the quotation."),
  });

  const editable = status === "DRAFT" || status === "SENT";

  return (
    <>
      {canWrite && editable ? (
        <Link
          href={`/quotations/edit?id=${quotation.id}`}
          className={buttonVariants({ variant: "outline", size })}
          title={
            status === "SENT"
              ? "Editing a sent quotation returns it to Draft; it must be sent again"
              : undefined
          }
        >
          <Pencil />
          {received ? "Edit & price" : "Edit"}
        </Link>
      ) : null}

      {canWrite && status === "DRAFT" ? (
        <Button size={size} onClick={() => setPending("send")}>
          <Send />
          {received ? "Send to customer" : "Send"}
        </Button>
      ) : null}

      {canApprove && status === "SENT" ? (
        <>
          <Button size={size} onClick={() => setPending("accept")}>
            <Check />
            Accept
          </Button>
          <Button variant="outline" size={size} onClick={() => setPending("reject")}>
            <X />
            Reject
          </Button>
        </>
      ) : null}

      {canConvert ? (
        <Button
          variant={status === "ACCEPTED" && !fromStorefront ? "default" : "outline"}
          size={size}
          disabled={status !== "ACCEPTED" || fromStorefront}
          title={fromStorefront ? "The customer places this order from the storefront" : convertHint(status)}
          onClick={onConvert}
        >
          Convert to order
        </Button>
      ) : null}

      {canWrite ? (
        <Button
          variant="ghost"
          size={size}
          disabled={duplicate.isPending}
          onClick={() => duplicate.mutate()}
          title="Start a new draft with the same customer and lines, priced at current rates"
        >
          {duplicate.isPending ? <Loader2 className="animate-spin" /> : <Copy />}
          Duplicate
        </Button>
      ) : null}

      {pending === "send" ? (
        <ConfirmDialog
          title={`Send ${quotation.quotationNumber}`}
          description="The customer is told the quotation is ready. You can still edit it, but a change returns it to Draft and it has to be sent again."
          confirmLabel="Send quotation"
          destructive={false}
          fallbackError="Could not send the quotation."
          action={() => sendQuotation(quotation.id)}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: quotationKeys.byId(quotation.id) });
            queryClient.invalidateQueries({ queryKey: quotationKeys.list });
            toast.success(`${quotation.quotationNumber} sent`);
            setPending(null);
          }}
          onClose={() => setPending(null)}
        />
      ) : null}

      {pending === "accept" ? (
        <ConfirmDialog
          title={`Accept ${quotation.quotationNumber}`}
          description={
            fromStorefront
              ? "Approves the quotation. The customer is asked to place the order from the storefront. Nobody can edit it after this."
              : "Approves the quotation. It can then be turned into an order. Nobody can edit it after this."
          }
          confirmLabel="Accept quotation"
          destructive={false}
          fallbackError="Could not accept the quotation."
          action={() => acceptQuotation(quotation.id)}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: quotationKeys.byId(quotation.id) });
            queryClient.invalidateQueries({ queryKey: quotationKeys.list });
            queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
            toast.success(`${quotation.quotationNumber} accepted`);
            setPending(null);
          }}
          onClose={() => setPending(null)}
        />
      ) : null}

      {pending === "reject" ? (
        <RejectDialog
          quotation={quotation}
          onDone={(updated) => {
            refresh(updated);
            toast.success(`${updated.quotationNumber} rejected`);
            setPending(null);
          }}
          onClose={() => setPending(null)}
        />
      ) : null}
    </>
  );
}

function convertHint(status: QuotationView["status"]): string | undefined {
  switch (status) {
    case "ACCEPTED":
      return undefined;
    case "CONVERTED":
      return "This quotation has already been converted to an order";
    case "DRAFT":
    case "SENT":
      return "Only an accepted quotation can be turned into an order. An Admin accepts it first.";
    default:
      return `A ${status.toLowerCase()} quotation cannot be turned into an order`;
  }
}

/** Rejecting needs a reason, which is kept on the quotation. */
function RejectDialog({
  quotation,
  onDone,
  onClose,
}: {
  quotation: QuotationView;
  onDone: (updated: QuotationView) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => rejectQuotation(quotation.id, reason.trim()),
    onSuccess: onDone,
    onError: (mutationError) =>
      setError(
        mutationError instanceof ApiError ? mutationError.message : "Could not reject the quotation.",
      ),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Reject ${quotation.quotationNumber}`}
      description="The quotation ends here. Start a new one by duplicating it."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Back
          </Button>
          <Button
            variant="destructive"
            disabled={mutation.isPending || reason.trim() === ""}
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
          >
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            Reject quotation
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <Alert tone="error" title={error} /> : null}
        <Field label="Reason" required hint="Required. Shown on the quotation.">
          {(props) => (
            <Input
              {...props}
              value={reason}
              maxLength={1000}
              onChange={(event) => setReason(event.target.value)}
              disabled={mutation.isPending}
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}

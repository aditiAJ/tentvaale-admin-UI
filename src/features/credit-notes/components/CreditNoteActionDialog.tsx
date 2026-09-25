"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  cancelCreditNote,
  creditNoteKeys,
  reverseCreditNote,
} from "@/features/credit-notes/api";
import { remainingCredit, type CreditNoteView } from "@/features/credit-notes/types";
import { ApiError } from "@/services/api-client";
import { formatMoney } from "@/lib/money";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export type CreditNoteAction = "cancel" | "reverse";

/** Confirms cancelling or reversing a note. Both are terminal. */
export function CreditNoteActionDialog({
  action,
  note,
  onClose,
}: {
  action: CreditNoteAction;
  note: CreditNoteView;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const cancelling = action === "cancel";
  const currency = note.amount.currency;

  const mutation = useMutation({
    mutationFn: () => (cancelling ? cancelCreditNote(note.id) : reverseCreditNote(note.id)),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: creditNoteKeys.byCustomer(note.customerId) });
      queryClient.invalidateQueries({ queryKey: creditNoteKeys.balance(note.customerId) });
      toast.success(`${updated.creditNoteNumber} ${cancelling ? "cancelled" : "reversed"}`);
      onClose();
    },
    onError: (mutationError) =>
      setError(
        mutationError instanceof ApiError
          ? mutationError.message
          : "Could not update the credit note.",
      ),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={cancelling ? `Cancel ${note.creditNoteNumber}` : `Reverse ${note.creditNoteNumber}`}
      description="This cannot be undone."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Back
          </Button>
          <Button
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
          >
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            {cancelling ? "Cancel credit note" : "Reverse credit note"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <Alert tone="error" title={error} /> : null}
        <dl className="grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Amount</dt>
            <dd className="tabular mt-0.5 text-sm font-medium">{formatMoney(note.amount)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Applied</dt>
            <dd className="tabular mt-0.5 text-sm font-medium">
              {formatMoney(note.appliedAmount)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">No longer available</dt>
            <dd className="tabular mt-0.5 text-sm font-medium">
              {formatMoney({ amount: remainingCredit(note), currency })}
            </dd>
          </div>
        </dl>
      </div>
    </Dialog>
  );
}

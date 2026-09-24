"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  confirmRefunded,
  depositKeys,
  forfeit,
  requestRefund,
} from "@/features/deposits/api";
import type { DepositLedgerView } from "@/features/deposits/types";
import { ApiError } from "@/services/api-client";
import { formatMoney } from "@/lib/money";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

export type SettleAction = "request-refund" | "confirm-refunded" | "forfeit";

const COPY: Record<
  SettleAction,
  { title: string; description: string; submit: string; needsAmount: boolean; destructive: boolean }
> = {
  "request-refund": {
    title: "Request refund",
    description: "Approves the refund. The money is not paid out until it is confirmed.",
    submit: "Request refund",
    needsAmount: false,
    destructive: false,
  },
  "confirm-refunded": {
    title: "Confirm refunded",
    description: "Records that the money has actually been returned. Terminal — it cannot be undone.",
    submit: "Confirm refunded",
    needsAmount: true,
    destructive: false,
  },
  forfeit: {
    title: "Forfeit deposit",
    description: "Keeps the deposit, in whole or in part. Terminal — it cannot be undone.",
    submit: "Forfeit deposit",
    needsAmount: true,
    destructive: true,
  },
};

interface Props {
  action: SettleAction;
  deposit: DepositLedgerView;
  onClose: () => void;
}

export function SettleDepositDialog({ action, deposit, onClose }: Props) {
  const copy = COPY[action];
  const queryClient = useQueryClient();

  const held =
    typeof deposit.amountHeld.amount === "string"
      ? Number(deposit.amountHeld.amount)
      : deposit.amountHeld.amount;

  // Pre-filled with the full held amount, which is the common case: a whole
  // refund, or a forfeit that the user then edits down to a partial.
  const [amount, setAmount] = useState(held.toFixed(2));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const parsed = Number(amount);
  const amountValid = /^\d+(\.\d{1,2})?$/.test(amount.trim()) && Number.isFinite(parsed);
  const amountError = copy.needsAmount && amount !== "" && !amountValid
    ? "Enter an amount like 5000 or 5000.00"
    : undefined;

  const mutation = useMutation({
    mutationFn: () => {
      if (action === "request-refund") return requestRefund(deposit.orderId, reason);
      if (action === "confirm-refunded") return confirmRefunded(deposit.orderId, parsed);
      return forfeit(deposit.orderId, parsed, reason);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(depositKeys.byOrder(deposit.orderId), updated);
      toast.success(`Deposit is now ${updated.status.replace("_", " ").toLowerCase()}`);
      onClose();
    },
    onError: (mutationError) =>
      setError(mutationError instanceof ApiError ? mutationError.message : "Could not update the deposit."),
  });

  const canSubmit = !mutation.isPending && (!copy.needsAmount || amountValid);

  return (
    <Dialog
      open
      onClose={onClose}
      title={copy.title}
      description={copy.description}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant={copy.destructive ? "destructive" : "default"}
            disabled={!canSubmit}
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
          >
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            {copy.submit}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <Alert tone="error" title={error} /> : null}

        <p className="text-sm text-muted-foreground">
          Held against this order: <strong className="text-foreground">{formatMoney(deposit.amountHeld)}</strong>
        </p>

        {copy.needsAmount ? (
          <>
            <Field
              label={action === "forfeit" ? "Amount to forfeit" : "Amount refunded"}
              required
              error={amountError}
              hint="In INR."
            >
              {(props) => (
                <Input
                  {...props}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="decimal"
                />
              )}
            </Field>

            {amountValid && parsed > held ? (
              // The backend records whatever it is sent — recordRefund and
              // recordForfeit do not check the amount against what is held — so
              // this warning is the only thing standing between a typo and a
              // ledger that says more was returned than was ever taken.
              <Alert tone="warning" title="More than the amount held">
                The backend does not check this, so it will be recorded as entered. Double-check
                before continuing.
              </Alert>
            ) : null}
          </>
        ) : null}

        {action !== "confirm-refunded" ? (
          <Field
            label="Reason"
          >
            {(props) => (
              <Textarea
                {...props}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={action === "forfeit" ? "Damage to 4 chairs" : ""}
              />
            )}
          </Field>
        ) : null}
      </div>
    </Dialog>
  );
}

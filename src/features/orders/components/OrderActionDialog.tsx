"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cancelOrder, completeOrder, orderKeys } from "@/features/orders/api";
import type { OrderView } from "@/features/orders/types";
import { depositKeys } from "@/features/deposits/api";
import type { DepositLedgerView } from "@/features/deposits/types";
import { ApiError } from "@/services/api-client";
import { formatMoney } from "@/lib/money";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export type OrderAction = "cancel" | "complete";

/**
 * Confirms one of the two order transitions that are not a stock movement.
 * Both are terminal, which is why they ask first.
 */
export function OrderActionDialog({
  action,
  order,
  deposit,
  onClose,
}: {
  action: OrderAction;
  order: OrderView;
  deposit: DepositLedgerView | undefined;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const cancelling = action === "cancel";

  const mutation = useMutation({
    mutationFn: () => (cancelling ? cancelOrder(order.id) : completeOrder(order.id)),
    onSuccess: (updated) => {
      queryClient.setQueryData(orderKeys.byId(order.id), updated);
      // Cancelling moves a held deposit to refund pending.
      queryClient.invalidateQueries({ queryKey: depositKeys.byOrder(order.id) });
      toast.success(`${updated.orderNumber} ${cancelling ? "cancelled" : "completed"}`);
      onClose();
    },
    onError: (mutationError) =>
      setError(
        mutationError instanceof ApiError ? mutationError.message : "Could not update the order.",
      ),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={cancelling ? `Cancel ${order.orderNumber}` : `Complete ${order.orderNumber}`}
      description={
        cancelling
          ? "Nothing has been dispatched, so no stock moves. This cannot be undone."
          : "Closes the order. This cannot be undone."
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Back
          </Button>
          <Button
            variant={cancelling ? "destructive" : "default"}
            disabled={mutation.isPending}
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
          >
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            {cancelling ? "Cancel order" : "Complete order"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <Alert tone="error" title={error} /> : null}

        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Customer</dt>
            <dd className="mt-0.5 text-sm font-medium">{order.customerName}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Security deposit</dt>
            <dd className="mt-0.5 text-sm font-medium">
              {deposit ? (
                <>
                  <span className="tabular">{formatMoney(deposit.amountHeld)}</span>
                  {" · "}
                  {cancelling && deposit.status === "HELD"
                    ? "moves to refund pending"
                    : deposit.status.replace("_", " ").toLowerCase()}
                </>
              ) : (
                formatMoney(order.securityDeposit)
              )}
            </dd>
          </div>
        </dl>
      </div>
    </Dialog>
  );
}

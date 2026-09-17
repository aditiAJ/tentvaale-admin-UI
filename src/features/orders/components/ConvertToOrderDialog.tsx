"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createOrderFromQuotation, orderKeys } from "@/features/orders/api";
import { quotationKeys } from "@/features/quotations/api";
import type { QuotationView } from "@/features/quotations/types";
import { dashboardKeys } from "@/features/dashboard/api";
import { ApiError } from "@/services/api-client";
import { formatMoney } from "@/lib/money";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

/**
 * Confirms converting one quotation into an order.
 *
 * It asks first because the conversion is terminal on both sides: the order is
 * created and the quotation is marked CONVERTED, and neither can be undone from
 * the back office — there is no cancel endpoint and no status transition to
 * walk it back with.
 */
export function ConvertToOrderDialog({
  quotation,
  onClose,
}: {
  quotation: QuotationView;
  onClose: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => createOrderFromQuotation(quotation.id),
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.byId(order.id), order);
      // The quotation is CONVERTED now, and this is the only way the screen
      // behind the dialog finds out.
      queryClient.invalidateQueries({ queryKey: quotationKeys.byId(quotation.id) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      toast.success(`${order.orderNumber} confirmed`, {
        description: `${order.customerName} — ${formatMoney(order.totalAmount)}`,
      });
      onClose();
      router.push(`/orders?id=${order.id}`);
    },
    onError: (mutationError) => {
      // The 422 here is almost always the one-order-per-quotation rule, and the
      // backend's message names the quotation, so it is shown verbatim.
      setError(
        mutationError instanceof ApiError
          ? mutationError.message
          : "Could not convert the quotation.",
      );
    },
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Convert to order"
      description="Creates a confirmed order and closes the quotation. Neither can be undone from here."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending}
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
          >
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            Convert to order
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <Alert tone="error" title={error} /> : null}

        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Quotation</dt>
            <dd className="mt-0.5 text-sm font-medium">{quotation.quotationNumber}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Customer</dt>
            <dd className="mt-0.5 text-sm font-medium">{quotation.customerName}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Total</dt>
            <dd className="tabular mt-0.5 text-sm font-semibold">
              {formatMoney(quotation.totalAmount)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Security deposit</dt>
            <dd className="tabular mt-0.5 text-sm font-semibold">
              {formatMoney(quotation.totalSecurityDeposit)}
            </dd>
          </div>
        </dl>

        <p className="border-t border-border pt-4 text-xs text-muted-foreground">
          {quotation.lines.length === 1
            ? "1 line copies across unchanged."
            : `${quotation.lines.length} lines copy across unchanged.`}{" "}
          An order is not repriced, so a later catalogue change will not reach it.
        </p>
      </div>
    </Dialog>
  );
}

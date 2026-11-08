"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useCan } from "@/features/auth";
import {
  checkNow,
  convertToOrder,
  dismissPayment,
  getOnlineStatus,
  listAttention,
  onlineKeys,
  refundPayment,
  type OnlinePayment,
} from "@/features/payments/api";
import { ApiError } from "@/services/api-client";
import { formatMoney } from "@/lib/money";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const STATUS_LABEL: Record<OnlinePayment["status"], string> = {
  CREATED: "Started",
  PENDING_CONFIRMATION: "Waiting for Razorpay",
  CAPTURED: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  EXPIRED: "Abandoned",
};

const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Online (Razorpay) payments that need a person: money that arrived but could not be recorded cleanly, a paid quotation that has
 * not become an order, and recent failures. A normal online payment never appears here: it is already a verified payment with a
 * receipt under Payments, and its quotation is already an order.
 */
export function OnlinePaymentsPage() {
  const canAct = useCan("PAYMENT_VERIFY");
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: onlineKeys.status, queryFn: ({ signal }) => getOnlineStatus(signal) });
  const list = useQuery({ queryKey: onlineKeys.attention, queryFn: ({ signal }) => listAttention(signal), refetchInterval: 60_000 });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["online-payments"] });
  const fail = (fallback: string) => (error: unknown) => toast.error(error instanceof ApiError ? error.message : fallback);

  const convert = useMutation({
    mutationFn: (id: string) => convertToOrder(id),
    onSuccess: (result) => {
      refresh();
      if (result.ordered) toast.success("The order has been created");
      else toast.error("The order could not be created yet. Check the quotation and the stock, then try again.");
    },
    onError: fail("Could not create the order."),
  });
  const dismiss = useMutation({
    mutationFn: (id: string) => dismissPayment(id),
    onSuccess: () => {
      refresh();
      toast.success("Taken off the list");
    },
    onError: fail("Could not update the payment."),
  });
  const refund = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => refundPayment(id, reason),
    onSuccess: () => {
      refresh();
      toast.success("Refunded through Razorpay");
    },
    onError: fail("Could not refund the payment."),
  });
  const check = useMutation({
    mutationFn: checkNow,
    onSuccess: () => {
      refresh();
      toast.success("Checked with Razorpay");
    },
    onError: fail("Could not check now."),
  });

  const rows = list.data ?? [];
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Online payments</h1>
          <p className="text-sm text-muted-foreground">
            Payments customers made through Razorpay that need a person to look at them. Normal ones are already under Payments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status.data ? (
            <Badge variant={status.data.mode === "LIVE" ? "success" : status.data.mode === "TEST" ? "warning" : "default"}>
              {status.data.mode === "OFF" ? "Online payment is off" : `Razorpay ${status.data.mode.toLowerCase()} mode`}
            </Badge>
          ) : null}
          {canAct ? (
            <Button variant="outline" size="sm" onClick={() => check.mutate()} disabled={check.isPending}>
              <RefreshCw className={check.isPending ? "animate-spin" : undefined} />
              Check now
            </Button>
          ) : null}
        </div>
      </header>

      {list.isPending ? <Skeleton className="h-40" /> : null}
      {list.isError ? <Alert tone="error" title="The list could not be loaded." /> : null}
      {list.data && rows.length === 0 ? (
        <Card>
          <EmptyState title="Nothing needs attention" description="Every online payment so far has been recorded and turned into an order." />
        </Card>
      ) : null}
      {rows.length > 0 ? (
        <TableWrapper>
          <Table>
            <THead>
              <TR>
                <TH>When</TH>
                <TH>Quotation</TH>
                <TH className="text-right">Amount</TH>
                <TH>Status</TH>
                <TH>What to look at</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {rows.map(({ payment, quotationNumber, problem }) => (
                <TR key={payment.id}>
                  <TD className="whitespace-nowrap">{when.format(new Date(payment.createdAt))}</TD>
                  <TD>
                    {payment.quotationId ? (
                      <Link href={`/quotations?id=${payment.quotationId}`} className="underline">
                        {quotationNumber ?? "Quotation"}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD className="tabular text-right">{formatMoney(payment.amount)}</TD>
                  <TD>
                    <Badge variant={payment.status === "FAILED" ? "destructive" : payment.status === "CAPTURED" ? "success" : "default"}>
                      {STATUS_LABEL[payment.status]}
                    </Badge>
                    {payment.gatewayPaymentId ? <span className="mt-0.5 block font-mono text-xs text-muted-foreground">{payment.gatewayPaymentId}</span> : null}
                  </TD>
                  <TD className="max-w-xs text-sm">{problem}</TD>
                  <TD>
                    {canAct ? (
                      <div className="flex flex-wrap gap-1">
                        {payment.status === "CAPTURED" && !payment.orderId && !payment.needsReview ? (
                          <Button size="sm" variant="outline" disabled={convert.isPending} onClick={() => convert.mutate(payment.id)}>
                            Create order
                          </Button>
                        ) : null}
                        {payment.needsReview && payment.gatewayPaymentId && payment.status !== "REFUNDED" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={refund.isPending}
                            onClick={() => {
                              const reason = window.prompt("Why is this payment being refunded? The customer gets the money back in full.");
                              if (reason && reason.trim()) refund.mutate({ id: payment.id, reason: reason.trim() });
                            }}
                          >
                            Refund
                          </Button>
                        ) : null}
                        {payment.needsReview ? (
                          <Button size="sm" variant="ghost" disabled={dismiss.isPending} onClick={() => dismiss.mutate(payment.id)}>
                            Done
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrapper>
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { useCan } from "@/features/auth";
import {
  MODE_LABEL,
  billingKeys,
  listPayments,
  rejectPayment,
  verifyPayment,
  type PaymentStatus,
} from "@/features/billing/api";
import { ApiError } from "@/services/api-client";
import { formatMoney } from "@/lib/money";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

/** Payments staff have recorded, for Accounts to check against the bank or the cash book. */
export function PaymentQueuePage() {
  const canVerify = useCan("PAYMENT_VERIFY");
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<PaymentStatus>("RECORDED");
  const list = useQuery({ queryKey: billingKeys.queue(status), queryFn: ({ signal }) => listPayments(status, signal) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["billing"] });
  const verify = useMutation({
    mutationFn: (id: string) => verifyPayment(id),
    onSuccess: (p) => {
      refresh();
      toast.success(`Verified. Receipt ${p.receiptNumber}`);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not verify the payment."),
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectPayment(id, reason),
    onSuccess: () => {
      refresh();
      toast.success("Payment rejected");
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not reject the payment."),
  });

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Payments</h1>
          <p className="text-sm text-muted-foreground">
            Money staff have recorded. Only verified payments reduce an order&apos;s balance.
          </p>
        </div>
        <Select className="w-44" value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)} aria-label="Status">
          <option value="RECORDED">Waiting to be verified</option>
          <option value="VERIFIED">Verified</option>
          <option value="REJECTED">Rejected</option>
        </Select>
      </header>
      {list.isPending ? <Skeleton className="h-40" /> : null}
      {list.isError ? <Alert tone="error" title="The payments could not be loaded." /> : null}
      {list.data && list.data.length === 0 ? (
        <Card>
          <EmptyState title="Nothing here" description="No payments with this status." />
        </Card>
      ) : null}
      {list.data && list.data.length > 0 ? (
        <TableWrapper>
          <Table>
            <THead>
              <TR>
                <TH>Order</TH>
                <TH>Date</TH>
                <TH>Mode</TH>
                <TH>Reference</TH>
                <TH className="text-right">Amount</TH>
                <TH>Recorded by</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {list.data.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <Link
                      href={p.orderId ? `/orders?id=${p.orderId}` : `/quotations?id=${p.quotationId}`}
                      className="underline"
                    >
                      {p.orderNumber ?? p.quotationNumber}
                    </Link>
                  </TD>
                  <TD>{p.paidOn}</TD>
                  <TD>{MODE_LABEL[p.mode]}</TD>
                  <TD>
                    {p.reference ?? "—"}
                    {p.proofUrl ? (
                      <a href={p.proofUrl} target="_blank" rel="noreferrer" className="ml-2 text-xs underline">
                        proof
                      </a>
                    ) : null}
                  </TD>
                  <TD className="tabular text-right">{formatMoney(p.amount)}</TD>
                  <TD>{p.recordedBy}</TD>
                  <TD>
                    {canVerify && p.status === "RECORDED" ? (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" disabled={verify.isPending} onClick={() => verify.mutate(p.id)}>
                          <Check /> Verify
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reject.isPending}
                          onClick={() => {
                            const reason = window.prompt("Why is this payment rejected?");
                            if (reason && reason.trim()) reject.mutate({ id: p.id, reason: reason.trim() });
                          }}
                        >
                          <X /> Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">{p.receiptNumber ?? p.rejectReason ?? ""}</span>
                    )}
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

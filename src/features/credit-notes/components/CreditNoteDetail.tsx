"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { creditNoteKeys, getCustomerCreditBalance } from "@/features/credit-notes/api";
import {
  remainingCredit,
  reversedCredit,
  type CreditNoteView,
} from "@/features/credit-notes/types";
import {
  CREDIT_NOTE_STATUS_MEANING,
  CREDIT_NOTE_STATUS_VARIANT,
} from "@/features/credit-notes/display";
import type { CustomerView } from "@/features/master-data/types";
import { formatEventDate } from "@/features/orders/display";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

/**
 * One credit note, opened in the workspace: who it is for, what it was worth,
 * what has gone where, and what is left — with the actions its status allows.
 *
 * Everything here is read off the note as the store returns it. The running
 * totals in the history are the note's own applications added up in order,
 * and the customer's available credit is the existing per-customer balance.
 */
export function CreditNoteDetail({
  note,
  customer,
  orderNumber,
  backHref,
  backLabel,
  canWrite,
  onApply,
  onCancel,
  onReverse,
}: {
  note: CreditNoteView;
  customer: CustomerView | undefined;
  orderNumber: (orderId: string) => string;
  backHref: string;
  backLabel: string;
  canWrite: boolean;
  onApply: () => void;
  onCancel: () => void;
  /** Absent for anyone but an administrator: the button is then not offered. */
  onReverse?: () => void;
}) {
  const balance = useQuery({
    queryKey: creditNoteKeys.balance(note.customerId),
    queryFn: ({ signal }) => getCustomerCreditBalance(note.customerId, signal),
    retry: false,
  });

  const currency = note.amount.currency;
  const total = Number(note.amount.amount);
  const remaining = remainingCredit(note);
  const reversed = reversedCredit(note);
  const unused = Number(note.appliedAmount.amount) === 0;
  const live = note.status === "ISSUED";

  const orderLink = (orderId: string) => (
    <Link href={`/orders?id=${orderId}`} className="font-mono text-foreground hover:underline">
      {orderNumber(orderId)}
    </Link>
  );

  // Applied so far and what was left after each application, in the order they
  // happened. Summed in paise so a run of partial amounts does not drift.
  const paise = (value: number | string) => Math.round(Number(value) * 100);
  const history = note.applications.map((application, index) => {
    const soFar = note.applications
      .slice(0, index + 1)
      .reduce((sum, earlier) => sum + paise(earlier.amount.amount), 0);
    return {
      application,
      appliedSoFar: soFar / 100,
      leftAfter: Math.max(paise(total) - soFar, 0) / 100,
    };
  });

  return (
    <>
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>

      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg wrap-break-word">
                {customer?.fullName ?? note.customerName ?? note.customerId}
              </CardTitle>
              <Badge
                variant={CREDIT_NOTE_STATUS_VARIANT[note.status]}
                title={CREDIT_NOTE_STATUS_MEANING[note.status]}
              >
                {note.status}
              </Badge>
            </div>
            <p className="font-mono text-sm">{note.creditNoteNumber}</p>
            <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
              {customer?.email ? <span>{customer.email} ·</span> : null}
              <span>
                {note.againstOrderId ? <>Against {orderLink(note.againstOrderId)}</> : "Goodwill credit"}
              </span>
            </p>
          </div>

          {canWrite && live ? (
            <div className="flex flex-wrap gap-1">
              <Button size="sm" onClick={onApply}>
                Apply
              </Button>
              {unused ? (
                <Button size="sm" variant="outline" onClick={onCancel}>
                  Cancel note
                </Button>
              ) : null}
              {onReverse ? (
                <Button size="sm" variant="outline" onClick={onReverse}>
                  Reverse
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <div>
              <dt className="text-[0.7rem] text-muted-foreground">Issued</dt>
              <dd className="tabular text-sm">{formatEventDate(note.issuedOn)}</dd>
            </div>
            <div>
              <dt className="text-[0.7rem] text-muted-foreground">Amount</dt>
              <dd className="tabular text-sm">{formatMoney(note.amount)}</dd>
            </div>
            <div>
              <dt className="text-[0.7rem] text-muted-foreground">Applied</dt>
              <dd className="tabular text-sm">{formatMoney(note.appliedAmount)}</dd>
            </div>
            <div>
              <dt className="text-[0.7rem] text-muted-foreground">Remaining</dt>
              <dd className="tabular text-sm font-semibold">
                {formatMoney({ amount: remaining, currency })}
              </dd>
              {reversed > 0 ? (
                <dd className="tabular text-xs text-muted-foreground">
                  {formatMoney({ amount: reversed, currency })} reversed
                </dd>
              ) : null}
            </div>
          </dl>

          <div>
            <p className="text-[0.7rem] text-muted-foreground">Reason</p>
            <p className="text-sm wrap-break-word">{note.reason ?? "—"}</p>
          </div>

          <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
            <p className="text-[0.7rem] text-muted-foreground">
              Available credit for {customer?.fullName ?? "this customer"}
            </p>
            <p className="tabular text-sm font-semibold">
              {balance.data
                ? formatMoney(balance.data.availableCredit)
                : balance.isError
                  ? "Unavailable"
                  : "…"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Application history</CardTitle>
        </CardHeader>
        {history.length === 0 ? (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Nothing has been applied from this note.
            </p>
          </CardContent>
        ) : (
          <TableWrapper>
            <Table>
              <THead>
                <tr>
                  <TH>Applied on</TH>
                  <TH>Order</TH>
                  <TH className="text-right">Amount</TH>
                  <TH className="text-right">Applied so far</TH>
                  <TH className="text-right">Left after</TH>
                </tr>
              </THead>
              <TBody>
                {history.map(({ application, appliedSoFar: soFar, leftAfter }) => (
                  <TR key={application.id}>
                    <TD className="tabular text-xs">{formatEventDate(application.appliedOn)}</TD>
                    <TD className="text-xs">{orderLink(application.orderId)}</TD>
                    <TD className="text-right tabular">{formatMoney(application.amount)}</TD>
                    <TD className="text-right tabular">
                      {formatMoney({ amount: soFar, currency })}
                    </TD>
                    <TD className="text-right tabular">
                      {formatMoney({ amount: leftAfter, currency })}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrapper>
        )}
      </Card>
    </>
  );
}

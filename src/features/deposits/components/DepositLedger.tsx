"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { depositKeys, getDepositSummary, listDeposits } from "@/features/deposits/api";
import type { DepositStatus } from "@/features/deposits/types";
import { DEPOSIT_STATUSES } from "@/features/deposits/types";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile, formatCount } from "@/components/ui/stat";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const VARIANT: Record<DepositStatus, "default" | "success" | "warning" | "destructive"> = {
  HELD: "default",
  REFUND_PENDING: "warning",
  REFUNDED: "success",
  FORFEITED: "destructive",
};

/**
 * Every deposit the company holds, with what is held and what is waiting to be paid back.
 * Real backend only: the ledger list and the summary are endpoints, not something the lookup
 * screen could derive. Opening a row hands its order id to the detail panel below.
 */
export function DepositLedger({ onOpen }: { onOpen: (orderId: string) => void }) {
  const [status, setStatus] = useState<DepositStatus | "">("");
  const [search, setSearch] = useState("");
  const q = search.trim();

  const summary = useQuery({
    queryKey: depositKeys.summary,
    queryFn: ({ signal }) => getDepositSummary(signal),
  });
  const list = useQuery({
    queryKey: depositKeys.list(status || undefined, q),
    queryFn: ({ signal }) => listDeposits({ status: status || undefined, q: q || undefined }, signal),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Held"
          value={summary.data ? formatMoney(summary.data.heldAmount) : "…"}
          hint={summary.data ? `${formatCount(summary.data.heldCount)} deposits` : undefined}
        />
        <StatTile
          label="Refunds to pay"
          value={summary.data ? formatMoney(summary.data.refundPendingAmount) : "…"}
          hint={summary.data ? `${formatCount(summary.data.refundPendingCount)} awaiting payout` : undefined}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={status === "" ? "default" : "outline"}
          onClick={() => setStatus("")}
        >
          All
        </Button>
        {DEPOSIT_STATUSES.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={status === value ? "default" : "outline"}
            onClick={() => setStatus(value)}
          >
            {value.replace("_", " ").toLowerCase()}
          </Button>
        ))}
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by order number"
          aria-label="Search deposits by order number"
          className="ml-auto w-56"
        />
      </div>

      {list.isPending ? <Skeleton className="h-40" /> : null}
      {list.error ? (
        <Alert tone="error" title={list.error instanceof Error ? list.error.message : "Could not load deposits"} />
      ) : null}

      {list.data && list.data.length === 0 ? (
        <Card>
          <EmptyState
            title="No deposits"
            description={
              q || status
                ? "Nothing matches that filter."
                : "A deposit is held when an order is created from an accepted quotation with a deposit."
            }
          />
        </Card>
      ) : null}

      {list.data && list.data.length > 0 ? (
        <Card>
          <TableWrapper>
            <Table>
              <THead>
                <tr>
                  <TH>Order</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Held</TH>
                  <TH className="text-right">Refunded</TH>
                  <TH className="text-right">Forfeited</TH>
                  <TH>Held on</TH>
                </tr>
              </THead>
              <TBody>
                {list.data.map((deposit) => (
                  <TR key={deposit.id}>
                    <TD>
                      <button
                        type="button"
                        onClick={() => onOpen(deposit.orderId)}
                        className="font-mono text-sm text-primary hover:underline"
                      >
                        {deposit.orderNumber ?? deposit.orderId}
                      </button>
                    </TD>
                    <TD>
                      <Badge variant={VARIANT[deposit.status]}>
                        {deposit.status.replace("_", " ")}
                      </Badge>
                    </TD>
                    <TD className="text-right tabular">{formatMoney(deposit.amountHeld)}</TD>
                    <TD className="text-right tabular">{formatMoney(deposit.amountRefunded)}</TD>
                    <TD className="text-right tabular">{formatMoney(deposit.amountForfeited)}</TD>
                    <TD className="text-xs text-muted-foreground">{formatDateTime(deposit.heldAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrapper>
        </Card>
      ) : null}
    </div>
  );
}

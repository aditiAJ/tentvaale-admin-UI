"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PiggyBank, Search } from "lucide-react";
import { depositKeys, getDepositByOrder } from "@/features/deposits/api";
import {
  ALLOWED_NEXT,
  DEPOSIT_STATUS_MEANING,
  type DepositStatus,
} from "@/features/deposits/types";
import {
  SettleDepositDialog,
  type SettleAction,
} from "@/features/deposits/components/SettleDepositDialog";
import { useCan } from "@/features/auth";
import { ApiError } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";
import { DEMO_DEPOSIT_EXAMPLES } from "@/mock-data/seed";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_VARIANT: Record<DepositStatus, "default" | "success" | "warning" | "destructive"> = {
  HELD: "default",
  REFUND_PENDING: "warning",
  REFUNDED: "success",
  FORFEITED: "destructive",
};

const ACTION_FOR: Record<string, { action: SettleAction; label: string; destructive: boolean }> = {
  REFUND_PENDING: { action: "request-refund", label: "Request refund", destructive: false },
  REFUNDED: { action: "confirm-refunded", label: "Confirm refunded", destructive: false },
  FORFEITED: { action: "forfeit", label: "Forfeit deposit", destructive: true },
};

/** `initialOrderId` comes from `?orderId=`, so an order can link to its deposit. */
export function DepositsPage({ initialOrderId = "" }: { initialOrderId?: string }) {
  const canWrite = useCan("DEPOSIT_WRITE");
  const [orderId, setOrderId] = useState(initialOrderId);
  const [settling, setSettling] = useState<SettleAction | null>(null);

  const { data, isFetching, isError, error } = useQuery({
    queryKey: depositKeys.byOrder(orderId),
    queryFn: ({ signal }) => getDepositByOrder(orderId, signal),
    enabled: orderId !== "",
    retry: false,
  });

  const notFound = isError && error instanceof ApiError && error.status === 404;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Deposits"
        description="Security deposits held against orders, and how they are settled."
      />

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get("orderId");
          setOrderId(typeof value === "string" ? value.trim() : "");
        }}
      >
        <div className="min-w-64 flex-1 sm:max-w-md">
          <label htmlFor="order-lookup" className="mb-1.5 block text-xs font-medium">
            Order ID
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="order-lookup"
              name="orderId"
              // Keyed on the current id so picking an example below remounts the
              // field with that value; the input is otherwise uncontrolled, so a
              // changed defaultValue alone would not reach the DOM.
              key={orderId}
              defaultValue={orderId}
              placeholder="00000000-0000-0000-0000-000000000000"
              className="pl-8 font-mono text-xs"
            />
          </div>
        </div>
        <Button type="submit" disabled={isFetching}>
          Find deposit
        </Button>
      </form>

      {IS_MOCK ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Try:</span>
          {DEMO_DEPOSIT_EXAMPLES.map((example) => (
            <button
              key={example.orderId}
              type="button"
              onClick={() => setOrderId(example.orderId)}
              className="rounded-md border border-border px-2 py-1 font-mono text-xs transition-colors hover:bg-muted"
            >
              {example.orderNumber}
            </button>
          ))}
        </div>
      ) : null}

      {isFetching ? <Skeleton className="h-48" /> : null}

      {notFound ? (
        <Card>
          <EmptyState
            icon={<PiggyBank />}
            title="No deposit held against that order"
            description="Either the order id is wrong, or no deposit was ever taken for it."
          />
        </Card>
      ) : null}

      {isError && !notFound ? (
        <Alert tone="error" title={error instanceof Error ? error.message : "Lookup failed"} />
      ) : null}

      {data && !isFetching ? (
        <>
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <div className="space-y-1">
                <CardTitle>Deposit ledger</CardTitle>
                <Link
                  href={`/orders?id=${data.orderId}`}
                  className="font-mono text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  Order {data.orderId}
                </Link>
              </div>
              <Badge variant={STATUS_VARIANT[data.status]} title={DEPOSIT_STATUS_MEANING[data.status]}>
                {data.status.replace("_", " ")}
              </Badge>
            </CardHeader>

            <CardContent className="space-y-4">
              <dl className="grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Held</dt>
                  <dd className="mt-0.5 text-lg font-semibold">{formatMoney(data.amountHeld)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Refunded</dt>
                  <dd className="mt-0.5 text-lg font-semibold">{formatMoney(data.amountRefunded)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Forfeited</dt>
                  <dd className="mt-0.5 text-lg font-semibold">{formatMoney(data.amountForfeited)}</dd>
                </div>
              </dl>

              {/* Stacked rather than justified across the column: a label pinned
                  left with its value pinned right reads as two unrelated things
                  once the card is wide. */}
              <dl className="grid gap-4 border-t border-border pt-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Held since</dt>
                  <dd className="tabular mt-0.5">{formatDateTime(data.heldAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Settled</dt>
                  <dd className="tabular mt-0.5">
                    {data.settledAt ? formatDateTime(data.settledAt) : "Not settled"}
                  </dd>
                </div>
              </dl>

              {data.reason ? (
                <p className="border-t border-border pt-4 text-sm">
                  <span className="text-muted-foreground">Reason: </span>
                  {data.reason}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next steps</CardTitle>
            </CardHeader>
            <CardContent>
              {ALLOWED_NEXT[data.status].length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {data.status === "REFUNDED" ? "Refunded" : "Forfeited"} is terminal — there is
                  nothing further to do with this deposit.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {/* Driven by the same transition table the backend enforces, so
                      only moves the server will accept are ever offered. */}
                  {ALLOWED_NEXT[data.status].map((next) => {
                    const step = ACTION_FOR[next];
                    return (
                      <Button
                        key={next}
                        variant={step.destructive ? "destructive" : "default"}
                        disabled={!canWrite}
                        title={canWrite ? undefined : "Needs the DEPOSIT_WRITE permission."}
                        onClick={() => setSettling(step.action)}
                      >
                        {step.label}
                      </Button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      {settling && data ? (
        <SettleDepositDialog
          action={settling}
          deposit={data}
          onClose={() => setSettling(null)}
        />
      ) : null}
    </div>
  );
}

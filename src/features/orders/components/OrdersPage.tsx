"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { getOrder, orderKeys } from "@/features/orders/api";
import type { OrderStatus } from "@/features/orders/types";
import { ApiError } from "@/services/api-client";
import { DEMO_ORDER_EXAMPLES } from "@/mock-data/seed";
import { formatMoney } from "@/lib/money";
import { IdLookup } from "@/components/id-lookup";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const STATUS_VARIANT: Record<OrderStatus, "default" | "success" | "warning" | "destructive"> = {
  CONFIRMED: "default",
  DISPATCHED: "warning",
  RETURNED: "warning",
  COMPLETED: "success",
  CANCELLED: "destructive",
};

export function OrdersPage() {
  const [orderId, setOrderId] = useState("");

  const { data, isFetching, isError, error } = useQuery({
    queryKey: orderKeys.byId(orderId),
    queryFn: ({ signal }) => getOrder(orderId, signal),
    enabled: orderId !== "",
    retry: false,
  });

  const notFound = isError && error instanceof ApiError && error.status === 404;

  return (
    <div className="space-y-4">
      <PageHeader title="Orders" description="Confirmed work, converted from a quotation." />

      <IdLookup
        label="Order ID"
        value={orderId}
        onChange={setOrderId}
        submitLabel="Open order"
        busy={isFetching}
        examples={DEMO_ORDER_EXAMPLES}
      />

      {isFetching ? <Skeleton className="h-48" /> : null}

      {notFound ? (
        <Card>
          <EmptyState
            icon={<ClipboardList />}
            title="No order with that id"
            description="Either the id is wrong, or the order belongs to another company."
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
                <CardTitle>{data.orderNumber}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {data.customerName}
                  {data.customerEmail ? ` · ${data.customerEmail}` : ""}
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[data.status]}>{data.status}</Badge>
            </CardHeader>

            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Total</dt>
                  <dd className="mt-0.5 text-lg font-semibold">{formatMoney(data.totalAmount)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Security deposit</dt>
                  <dd className="mt-0.5 text-lg font-semibold">
                    {formatMoney(data.securityDeposit)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Event date</dt>
                  <dd className="tabular mt-0.5 text-lg font-semibold">
                    {data.eventDate ?? "Not set"}
                  </dd>
                </div>
              </dl>

              {data.quotationId ? (
                <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
                  Converted from quotation{" "}
                  <span className="font-mono">{data.quotationId}</span> — one order per quotation,
                  enforced by the backend.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lines</CardTitle>
            </CardHeader>
            <TableWrapper>
              <Table>
                <THead>
                  <tr>
                    <TH>Product</TH>
                    <TH className="text-right">Qty</TH>
                    <TH className="text-right">Days</TH>
                    <TH className="text-right">Line total</TH>
                  </tr>
                </THead>
                <TBody>
                  {data.lines.map((line) => (
                    <TR key={line.id}>
                      <TD className="font-medium">{line.productName}</TD>
                      <TD className="text-right tabular">{line.quantity}</TD>
                      <TD className="text-right tabular">{line.rentalDays}</TD>
                      <TD className="text-right tabular">{formatMoney(line.lineTotal)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrapper>
            <CardContent className="border-t border-border text-xs text-muted-foreground">
              Lines are copied from the quotation at conversion, with no independent pricing — an
              order cannot be repriced or edited from here.
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

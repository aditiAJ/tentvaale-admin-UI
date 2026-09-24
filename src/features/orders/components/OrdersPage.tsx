"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Check, ClipboardList, X } from "lucide-react";
import { getOrder, orderKeys } from "@/features/orders/api";
import { ORDER_STATUS_MEANING, type OrderStatus, type OrderView } from "@/features/orders/types";
import {
  OrderActionDialog,
  type OrderAction,
} from "@/features/orders/components/OrderActionDialog";
import { inventoryKeys, listStockMovementsByOrder } from "@/features/inventory/api";
import type { MovementDirection } from "@/features/inventory/types";
import { orderFulfilment } from "@/features/inventory/fulfilment";
import { RecordMovementDialog } from "@/features/inventory/components/RecordMovementDialog";
import { depositKeys, getDepositByOrder } from "@/features/deposits/api";
import type { DepositStatus } from "@/features/deposits/types";
import { useCan } from "@/features/auth";
import { ApiError } from "@/services/api-client";
import { DEMO_ORDER_EXAMPLES } from "@/mock-data/seed";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { IdLookup } from "@/components/id-lookup";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
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

const DEPOSIT_VARIANT: Record<DepositStatus, "default" | "success" | "warning" | "destructive"> = {
  HELD: "default",
  REFUND_PENDING: "warning",
  REFUNDED: "success",
  FORFEITED: "destructive",
};

const FLOW: OrderStatus[] = ["CONFIRMED", "DISPATCHED", "RETURNED", "COMPLETED"];

const title = (status: string) =>
  status.charAt(0) + status.slice(1).replace("_", " ").toLowerCase();

/**
 * `initialOrderId` comes from `?id=` on the route, which is what lets a
 * conversion end on the order it just created rather than handing the user an
 * id to paste back in. Initial, not controlled — once the screen is open the
 * lookup box owns the id.
 */
export function OrdersPage({ initialOrderId = "" }: { initialOrderId?: string }) {
  const [orderId, setOrderId] = useState(initialOrderId);

  const { data, isFetching, isError, error } = useQuery({
    queryKey: orderKeys.byId(orderId),
    queryFn: ({ signal }) => getOrder(orderId, signal),
    enabled: orderId !== "",
    retry: false,
  });

  const notFound = isError && error instanceof ApiError && error.status === 404;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Orders"
        description="Confirmed work, from dispatch through return to a settled deposit."
      />

      <IdLookup
        label="Order ID"
        value={orderId}
        onChange={setOrderId}
        submitLabel="Open order"
        busy={isFetching}
        examples={DEMO_ORDER_EXAMPLES}
      />

      {isFetching && !data ? <Skeleton className="h-48" /> : null}

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

      {/* Keyed by id so another order starts with no dialog open. Kept mounted
          through a background refetch, so recording a movement does not flash
          the whole screen back to a skeleton. */}
      {data && data.id === orderId ? <OrderDetail key={data.id} order={data} /> : null}
    </div>
  );
}

function OrderDetail({ order }: { order: OrderView }) {
  const [moving, setMoving] = useState<MovementDirection | null>(null);
  const [acting, setActing] = useState<OrderAction | null>(null);
  const canWriteOrder = useCan("ORDER_WRITE");
  const canReadStock = useCan("INVENTORY_READ");
  const canWriteStock = useCan("INVENTORY_WRITE");
  const canReadDeposit = useCan("DEPOSIT_READ");

  const movements = useQuery({
    queryKey: inventoryKeys.movementsByOrder(order.id),
    queryFn: ({ signal }) => listStockMovementsByOrder(order.id, signal),
    enabled: canReadStock,
    retry: false,
  });

  const deposit = useQuery({
    queryKey: depositKeys.byOrder(order.id),
    queryFn: ({ signal }) => getDepositByOrder(order.id, signal),
    enabled: canReadDeposit,
    retry: false,
  });

  const fulfilment = useMemo(
    () => (movements.data ? orderFulfilment(order, movements.data) : null),
    [order, movements.data],
  );

  const depositSettled =
    deposit.data?.status === "REFUNDED" || deposit.data?.status === "FORFEITED";

  const actions = (
    <>
      {order.status === "CONFIRMED" && canWriteStock ? (
        <Button size="sm" onClick={() => setMoving("OUTWARD")}>
          <ArrowUpRight />
          Record dispatch
        </Button>
      ) : null}
      {order.status === "DISPATCHED" && canWriteStock ? (
        <Button size="sm" onClick={() => setMoving("INWARD")}>
          <ArrowDownLeft />
          Record return
        </Button>
      ) : null}
      {order.status === "DISPATCHED" && canWriteStock && (fulfilment?.leftToDispatch ?? 0) > 0 ? (
        <Button size="sm" variant="outline" onClick={() => setMoving("OUTWARD")}>
          <ArrowUpRight />
          Dispatch the rest
        </Button>
      ) : null}
      {order.status === "RETURNED" && canWriteOrder ? (
        <Button
          size="sm"
          disabled={!depositSettled}
          title={
            depositSettled
              ? undefined
              : "The deposit must be refunded or forfeited before the order can be completed"
          }
          onClick={() => setActing("complete")}
        >
          <Check />
          Complete order
        </Button>
      ) : null}
      {order.status === "CONFIRMED" && canWriteOrder ? (
        <Button size="sm" variant="outline" onClick={() => setActing("cancel")}>
          <X />
          Cancel order
        </Button>
      ) : null}
    </>
  );

  return (
    <>
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle>{order.orderNumber}</CardTitle>
              <Badge variant={STATUS_VARIANT[order.status]} title={ORDER_STATUS_MEANING[order.status]}>
                {order.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {order.customerName}
              {order.customerEmail ? ` · ${order.customerEmail}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </CardHeader>

        <CardContent className="space-y-4">
          <OrderProgress status={order.status} />

          <dl className="grid gap-4 border-t border-border pt-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Total</dt>
              <dd className="mt-0.5 text-lg font-semibold">{formatMoney(order.totalAmount)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Security deposit</dt>
              <dd className="mt-0.5 text-lg font-semibold">{formatMoney(order.securityDeposit)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Event date</dt>
              <dd className="tabular mt-0.5 text-lg font-semibold">
                {order.eventDate ?? "Not set"}
              </dd>
            </div>
          </dl>

          {order.quotationId ? (
            <p className="border-t border-border pt-4 text-xs text-muted-foreground">
              Converted from quotation{" "}
              <Link
                href={`/quotations?id=${order.quotationId}`}
                className="font-mono hover:text-foreground hover:underline"
              >
                {order.quotationId}
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>

      {canReadDeposit ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle>Deposit</CardTitle>
            <Link
              href={`/deposits?orderId=${order.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {deposit.data?.status === "HELD" || deposit.data?.status === "REFUND_PENDING"
                ? "Settle deposit"
                : "Open deposit"}
            </Link>
          </CardHeader>
          <CardContent>
            {deposit.isPending ? <Skeleton className="h-12" /> : null}
            {deposit.isError ? (
              <p className="text-sm text-muted-foreground">
                {deposit.error instanceof ApiError && deposit.error.status === 404
                  ? "No deposit is held against this order."
                  : "The deposit could not be loaded."}
              </p>
            ) : null}
            {deposit.data ? (
              <dl className="grid gap-4 sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Status</dt>
                  <dd className="mt-1">
                    <Badge variant={DEPOSIT_VARIANT[deposit.data.status]}>
                      {deposit.data.status.replace("_", " ")}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Held</dt>
                  <dd className="tabular mt-0.5 font-semibold">
                    {formatMoney(deposit.data.amountHeld)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Refunded</dt>
                  <dd className="tabular mt-0.5 font-semibold">
                    {formatMoney(deposit.data.amountRefunded)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Forfeited</dt>
                  <dd className="tabular mt-0.5 font-semibold">
                    {formatMoney(deposit.data.amountForfeited)}
                  </dd>
                </div>
              </dl>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>Lines</CardTitle>
          {canReadStock ? (
            <Link
              href={`/inventory/stock-movements?orderId=${order.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {movements.data?.length === 1
                ? "1 movement"
                : `${movements.data?.length ?? 0} movements`}
            </Link>
          ) : null}
        </CardHeader>
        <TableWrapper>
          <Table>
            <THead>
              <tr>
                <TH>Product</TH>
                <TH className="text-right">Qty</TH>
                <TH className="text-right">Days</TH>
                {fulfilment ? (
                  <>
                    <TH className="text-right">Dispatched</TH>
                    <TH className="text-right">Returned</TH>
                  </>
                ) : null}
                <TH className="text-right">Line total</TH>
              </tr>
            </THead>
            <TBody>
              {order.lines.map((line, index) => {
                // Movements are counted per product, so a product on two lines
                // shows its totals once, on the first.
                const first =
                  order.lines.findIndex((other) => other.productId === line.productId) === index;
                const progress = first ? fulfilment?.byProduct.get(line.productId) : undefined;
                return (
                  <TR key={line.id}>
                    <TD className="font-medium">{line.productName}</TD>
                    <TD className="text-right tabular">{line.quantity}</TD>
                    <TD className="text-right tabular">{line.rentalDays}</TD>
                    {fulfilment ? (
                      <>
                        <TD className="text-right tabular">{progress?.dispatched ?? ""}</TD>
                        <TD className="text-right tabular">{progress?.returned ?? ""}</TD>
                      </>
                    ) : null}
                    <TD className="text-right tabular">{formatMoney(line.lineTotal)}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </TableWrapper>
        <CardContent className="border-t border-border text-xs text-muted-foreground">
          Lines are copied from the quotation at conversion, with no independent pricing — an
          order cannot be repriced or edited from here.
        </CardContent>
      </Card>

      {moving ? (
        <RecordMovementDialog
          orderId={order.id}
          initialDirection={moving}
          onClose={() => setMoving(null)}
        />
      ) : null}

      {acting ? (
        <OrderActionDialog
          action={acting}
          order={order}
          deposit={deposit.data}
          onClose={() => setActing(null)}
        />
      ) : null}
    </>
  );
}

/**
 * The four steps an order walks through, with the current one marked. A
 * cancelled order shows where it stopped instead.
 */
function OrderProgress({ status }: { status: OrderStatus }) {
  const steps: OrderStatus[] = status === "CANCELLED" ? ["CONFIRMED", "CANCELLED"] : FLOW;
  const reached = steps.indexOf(status);

  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {steps.map((step, index) => {
        const done = index < reached || (index === reached && step === "COMPLETED");
        const current = index === reached;
        return (
          <li key={step} className="flex items-center gap-2">
            {index > 0 ? <span className="h-px w-6 bg-border" aria-hidden /> : null}
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1",
                current && step === "CANCELLED"
                  ? "border-destructive text-destructive"
                  : current
                    ? "border-primary font-medium text-foreground"
                    : done
                      ? "border-border text-foreground"
                      : "border-dashed border-border text-muted-foreground",
              )}
              aria-current={current ? "step" : undefined}
              title={ORDER_STATUS_MEANING[step]}
            >
              {done && !current ? <Check className="size-3" /> : null}
              {title(step)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CircleCheck,
  ClipboardList,
  PiggyBank,
  Truck,
  X,
} from "lucide-react";
import { getOrder, orderKeys } from "@/features/orders/api";
import { ORDER_STATUS_MEANING, type OrderStatus, type OrderView } from "@/features/orders/types";
import {
  OrderActionDialog,
  type OrderAction,
} from "@/features/orders/components/OrderActionDialog";
import { ORDER_STATUS_VARIANT, DEPOSIT_VARIANT, formatEventDate } from "@/features/orders/display";
import { getQuotation, quotationKeys } from "@/features/quotations/api";
import { inventoryKeys, listStockMovementsByOrder } from "@/features/inventory/api";
import type { MovementDirection } from "@/features/inventory/types";
import { orderFulfilment, type OrderFulfilment } from "@/features/inventory/fulfilment";
import { RecordMovementDialog } from "@/features/inventory/components/RecordMovementDialog";
import { depositKeys, getDepositByOrder } from "@/features/deposits/api";
import { ALLOWED_NEXT, type DepositLedgerView } from "@/features/deposits/types";
import {
  SettleDepositDialog,
  type SettleAction,
} from "@/features/deposits/components/SettleDepositDialog";
import { useCan } from "@/features/auth";
import { ApiError } from "@/services/api-client";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const FLOW: OrderStatus[] = ["CONFIRMED", "DISPATCHED", "RETURNED", "COMPLETED"];

const title = (status: string) =>
  status.charAt(0) + status.slice(1).replace("_", " ").toLowerCase();

/** The deposit transition a settle button takes, named as the deposits screen names it. */
const SETTLE_FOR: Record<string, { action: SettleAction; label: string }> = {
  REFUND_PENDING: { action: "request-refund", label: "Request refund" },
  REFUNDED: { action: "confirm-refunded", label: "Confirm refunded" },
  FORFEITED: { action: "forfeit", label: "Forfeit deposit" },
};

/** One order opened in the workspace, loaded by id so any link to it works. */
export function OrderDetail({
  orderId,
  backHref,
  backLabel,
}: {
  orderId: string;
  backHref: string;
  backLabel: string;
}) {
  const { data, isPending, isError, error } = useQuery({
    queryKey: orderKeys.byId(orderId),
    queryFn: ({ signal }) => getOrder(orderId, signal),
    retry: false,
  });

  const notFound = isError && error instanceof ApiError && error.status === 404;

  return (
    <>
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>

      {isPending ? <Skeleton className="h-48" /> : null}

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

      {data ? <OrderWorkspace order={data} /> : null}
    </>
  );
}

function OrderWorkspace({ order }: { order: OrderView }) {
  const queryClient = useQueryClient();
  const [moving, setMoving] = useState<MovementDirection | null>(null);
  const [acting, setActing] = useState<OrderAction | null>(null);
  const [settling, setSettling] = useState<SettleAction | null>(null);
  const canWriteOrder = useCan("ORDER_WRITE");
  const canReadStock = useCan("INVENTORY_READ");
  const canWriteStock = useCan("INVENTORY_WRITE");
  const canReadDeposit = useCan("DEPOSIT_READ");
  const canWriteDeposit = useCan("DEPOSIT_WRITE");
  const canReadQuotation = useCan("QUOTATION_READ");

  // The workspace's list and counts are keyed apart from this order, so a
  // status change made here (a dispatch, a return, a cancel) reaches them too.
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: orderKeys.list });
  }, [order.status, queryClient]);

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

  const quotation = useQuery({
    queryKey: quotationKeys.byId(order.quotationId ?? ""),
    queryFn: ({ signal }) => getQuotation(order.quotationId ?? "", signal),
    enabled: canReadQuotation && Boolean(order.quotationId),
    retry: false,
  });

  const fulfilment = useMemo(
    () => (movements.data ? orderFulfilment(order, movements.data) : null),
    [order, movements.data],
  );

  const ordered = order.lines.reduce((sum, line) => sum + line.quantity, 0);
  const dispatched = fulfilment
    ? [...fulfilment.byProduct.values()].reduce((sum, entry) => sum + entry.dispatched, 0)
    : null;
  const returned = fulfilment
    ? [...fulfilment.byProduct.values()].reduce((sum, entry) => sum + entry.returned, 0)
    : null;

  return (
    <>
      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg wrap-break-word">{order.customerName}</CardTitle>
              <Badge
                variant={ORDER_STATUS_VARIANT[order.status]}
                title={ORDER_STATUS_MEANING[order.status]}
              >
                {order.status}
              </Badge>
            </div>
            <p className="font-mono text-sm">{order.orderNumber}</p>
            <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
              {order.customerEmail ? <span>{order.customerEmail}</span> : null}
              {order.quotationId ? (
                <span>
                  {order.customerEmail ? "· " : ""}From quotation{" "}
                  <Link
                    href={`/quotations?id=${order.quotationId}`}
                    className="font-mono text-foreground hover:underline"
                  >
                    {quotation.data?.quotationNumber ?? order.quotationId}
                  </Link>
                </span>
              ) : null}
            </p>
          </div>
          {order.status === "CONFIRMED" && canWriteOrder ? (
            <Button size="sm" variant="outline" onClick={() => setActing("cancel")}>
              <X />
              Cancel order
            </Button>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-4">
          <OrderProgress status={order.status} />

          <NextStep
            order={order}
            fulfilment={fulfilment}
            deposit={deposit.data}
            canReadDeposit={canReadDeposit}
            can={{
              writeOrder: canWriteOrder,
              writeStock: canWriteStock,
              writeDeposit: canWriteDeposit,
            }}
            onMove={setMoving}
            onAct={setActing}
            onSettle={setSettling}
          />

          <dl className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Event date</dt>
              <dd className="tabular mt-0.5 text-lg font-semibold">
                {formatEventDate(order.eventDate)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Total</dt>
              <dd className="tabular mt-0.5 text-lg font-semibold">
                {formatMoney(order.totalAmount)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Security deposit</dt>
              <dd className="tabular mt-0.5 text-lg font-semibold">
                {formatMoney(order.securityDeposit)}
              </dd>
              {deposit.data ? (
                <Badge variant={DEPOSIT_VARIANT[deposit.data.status]} className="mt-1">
                  {deposit.data.status.replace("_", " ")}
                </Badge>
              ) : null}
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Goods</dt>
              <dd className="tabular mt-0.5 text-sm">
                {fulfilment ? (
                  <>
                    <span className="text-lg font-semibold">{dispatched}</span>
                    <span className="text-muted-foreground"> / {ordered} dispatched</span>
                    <span className="block text-xs text-muted-foreground">
                      {fulfilment.stillOut} out on rent · {returned} returned
                    </span>
                  </>
                ) : (
                  <span className="text-lg font-semibold">{ordered} ordered</span>
                )}
              </dd>
            </div>
          </dl>
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
              Open deposit
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

      {settling && deposit.data ? (
        <SettleDepositDialog
          action={settling}
          deposit={deposit.data}
          onClose={() => setSettling(null)}
        />
      ) : null}
    </>
  );
}

/**
 * What happens next, and the button that does it. Every action here is one the
 * screen already offered, under the same conditions — the order's status, the
 * goods still to send or still out, the deposit's allowed next steps and the
 * user's permissions. This only puts the one that matters now up front.
 */
function NextStep({
  order,
  fulfilment,
  deposit,
  canReadDeposit,
  can,
  onMove,
  onAct,
  onSettle,
}: {
  order: OrderView;
  fulfilment: OrderFulfilment | null;
  deposit: DepositLedgerView | undefined;
  canReadDeposit: boolean;
  can: { writeOrder: boolean; writeStock: boolean; writeDeposit: boolean };
  onMove: (direction: MovementDirection) => void;
  onAct: (action: OrderAction) => void;
  onSettle: (action: SettleAction) => void;
}) {
  const settled = deposit?.status === "REFUNDED" || deposit?.status === "FORFEITED";
  const settleButtons = (primary: boolean) =>
    deposit && can.writeDeposit
      ? ALLOWED_NEXT[deposit.status].map((next, index) => {
          const step = SETTLE_FOR[next];
          return (
            <Button
              key={next}
              size="sm"
              variant={primary && index === 0 ? "default" : "outline"}
              onClick={() => onSettle(step.action)}
            >
              <PiggyBank />
              {step.label}
            </Button>
          );
        })
      : null;

  let icon = <Truck />;
  let heading: string;
  let detail: string | null = null;
  let actions: React.ReactNode = null;

  switch (order.status) {
    case "CONFIRMED":
      heading = "Ready for dispatch";
      detail = `${order.lines.reduce((sum, line) => sum + line.quantity, 0)} items to send`;
      actions = can.writeStock ? (
        <Button size="sm" onClick={() => onMove("OUTWARD")}>
          <ArrowUpRight />
          Record dispatch
        </Button>
      ) : null;
      break;
    case "DISPATCHED":
      heading = "Out on rent";
      detail = fulfilment
        ? [
            `${fulfilment.stillOut} out on rent`,
            fulfilment.leftToDispatch > 0 ? `${fulfilment.leftToDispatch} still to dispatch` : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : null;
      actions = can.writeStock ? (
        <>
          <Button size="sm" onClick={() => onMove("INWARD")}>
            <ArrowDownLeft />
            Record return
          </Button>
          {(fulfilment?.leftToDispatch ?? 0) > 0 ? (
            <Button size="sm" variant="outline" onClick={() => onMove("OUTWARD")}>
              <ArrowUpRight />
              Dispatch the rest
            </Button>
          ) : null}
        </>
      ) : null;
      break;
    case "RETURNED":
      if (canReadDeposit && deposit && !settled) {
        icon = <PiggyBank />;
        heading = "Settle the deposit";
        detail = `${formatMoney(deposit.amountHeld)} · ${deposit.status.replace("_", " ").toLowerCase()}`;
        actions = settleButtons(true);
      } else {
        icon = <CircleCheck />;
        heading = "Ready to complete";
        detail = deposit ? `Deposit ${deposit.status.toLowerCase()}` : null;
        actions = can.writeOrder ? (
          <Button size="sm" onClick={() => onAct("complete")}>
            <Check />
            Complete order
          </Button>
        ) : null;
      }
      break;
    case "COMPLETED":
      icon = <CircleCheck />;
      heading = "Order complete";
      detail = deposit ? `Deposit ${deposit.status.toLowerCase()}` : null;
      break;
    case "CANCELLED":
      icon = <X />;
      heading = "Cancelled";
      detail = deposit ? `Deposit ${deposit.status.replace("_", " ").toLowerCase()}` : null;
      actions = deposit && !settled ? settleButtons(true) : null;
      break;
  }

  const done = order.status === "COMPLETED";
  const cancelled = order.status === "CANCELLED";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3",
        cancelled
          ? "border-destructive/30 bg-destructive/5"
          : done
            ? "border-border bg-muted/40"
            : "border-primary/30 bg-primary/5",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md [&_svg]:size-4",
            cancelled
              ? "bg-destructive/10 text-destructive"
              : done
                ? "bg-muted text-muted-foreground"
                : "bg-primary/10 text-primary",
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{heading}</p>
          {detail ? <p className="tabular text-xs text-muted-foreground">{detail}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
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

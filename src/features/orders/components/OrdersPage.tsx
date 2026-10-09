"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  PackageCheck,
  PiggyBank,
  SearchX,
  Truck,
  Undo2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { listOrders, orderKeys } from "@/features/orders/api";
import type { OrderStatus, OrderView } from "@/features/orders/types";
import { OrderDetail } from "@/features/orders/components/OrderDetail";
import { DEPOSIT_VARIANT, ORDER_STATUS_VARIANT, formatEventDate } from "@/features/orders/display";
import { inventoryKeys, listStockMovementsByOrder } from "@/features/inventory/api";
import { orderFulfilment } from "@/features/inventory/fulfilment";
import { depositKeys, getDepositByOrder } from "@/features/deposits/api";
import { useCan } from "@/features/auth";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { WorkspaceListSkeleton, WorkspaceSearch, workspaceHref } from "@/components/workspace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

/** The sections down the left, in lifecycle order. "" is all. `urgent` ones are waiting on the team. */
const TABS: { key: string; label: string; hint: string; icon: LucideIcon; status?: OrderStatus; urgent?: boolean }[] = [
  { key: "", label: "All orders", hint: "Every order", icon: ClipboardList },
  { key: "confirmed", label: "Confirmed", hint: "Ready to dispatch", icon: PackageCheck, status: "CONFIRMED", urgent: true },
  { key: "dispatched", label: "Dispatched", hint: "Out on rent", icon: Truck, status: "DISPATCHED", urgent: true },
  { key: "returned", label: "Returned", hint: "Settle the deposit", icon: Undo2, status: "RETURNED", urgent: true },
  { key: "completed", label: "Completed", hint: "Returned and settled", icon: CheckCircle2, status: "COMPLETED" },
  { key: "cancelled", label: "Cancelled", hint: "Stopped before dispatch", icon: XCircle, status: "CANCELLED" },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const hrefFor = (filterKey: string, id?: string) => workspaceHref("/orders", filterKey, id);

/**
 * The order workspace: side tabs for each stage, a card for every order, or one order opened. The stage and the open order
 * come from the URL (`?status=`, `?id=`), so the links conversion, deposits and credit notes make (`/orders?id=…`) land on
 * their order.
 */
export function OrdersPage({ orderId, status }: { orderId: string; status: string }) {
  const tab = TABS.find((candidate) => candidate.key === status.toLowerCase()) ?? TABS[0];
  const [search, setSearch] = useState("");

  // Fresh on every visit: an order converted, moved or cancelled a moment ago changes the list and its counts.
  const list = useQuery({
    queryKey: orderKeys.list,
    queryFn: ({ signal }) => listOrders(signal),
    staleTime: 0,
    retry: false,
  });

  const counts = useMemo(() => {
    const byStatus = new Map<string, number>();
    for (const order of list.data ?? []) byStatus.set(order.status, (byStatus.get(order.status) ?? 0) + 1);
    return byStatus;
  }, [list.data]);

  return (
    <div className="space-y-5">
      <PageHeader title="Orders" description="Confirmed work, from dispatch through return to a settled deposit." />

      <div className="grid items-start gap-5 lg:grid-cols-[240px_1fr]">
        <nav aria-label="Order stages" className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {TABS.map((item) => {
            const Icon = item.icon;
            const on = item.key === tab.key;
            const count = item.status ? (counts.get(item.status) ?? 0) : list.data?.length;
            return (
              <Link
                key={item.key}
                href={hrefFor(item.key)}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-3 rounded-lg border px-3.5 py-2.5 transition-colors lg:w-full",
                  on ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40",
                )}
              >
                <Icon className={cn("size-4 shrink-0", on ? "text-primary" : "text-muted-foreground")} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="hidden text-xs text-muted-foreground lg:block">{item.hint}</span>
                </span>
                {list.data && count !== undefined ? (
                  <span
                    className={cn(
                      "tabular rounded-full px-2 py-0.5 text-xs",
                      item.urgent && count > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="min-w-0 space-y-4">
          {orderId ? (
            <OrderDetail
              key={orderId}
              orderId={orderId}
              backHref={hrefFor(tab.key)}
              backLabel={tab.status ? `${tab.label} orders` : "All orders"}
            />
          ) : (
            <OrderList
              orders={list.data}
              isPending={list.isPending}
              error={list.error}
              onRetry={() => list.refetch()}
              tab={tab}
              search={search}
              onSearch={setSearch}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function OrderList({
  orders,
  isPending,
  error,
  onRetry,
  tab,
  search,
  onSearch,
}: {
  orders: OrderView[] | undefined;
  isPending: boolean;
  error: Error | null;
  onRetry: () => void;
  tab: (typeof TABS)[number];
  search: string;
  onSearch: (value: string) => void;
}) {
  const deferredSearch = useDeferredValue(search);
  const term = deferredSearch.trim().toLowerCase();

  const inTab = useMemo(() => (orders ?? []).filter((order) => !tab.status || order.status === tab.status), [orders, tab.status]);
  const visible = useMemo(() => {
    if (!term) return inTab;
    return inTab.filter(
      (order) =>
        order.customerName.toLowerCase().includes(term) ||
        order.orderNumber.toLowerCase().includes(term) ||
        (order.customerEmail ?? "").toLowerCase().includes(term) ||
        order.id.toLowerCase() === term ||
        order.quotationId?.toLowerCase() === term,
    );
  }, [inTab, term]);

  // A pasted id is still openable directly, including one the list does not hold.
  const pastedId = UUID.test(deferredSearch.trim()) ? deferredSearch.trim() : "";

  return (
    <>
      <WorkspaceSearch
        value={search}
        onChange={onSearch}
        placeholder="Search by customer, email or order number…"
        label="Search orders by customer, email or order number"
        summary={orders ? <>{visible.length} of {inTab.length}</> : undefined}
      />

      {pastedId && !visible.some((order) => order.id === pastedId) ? (
        <Link
          href={hrefFor(tab.key, pastedId)}
          className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-3 text-sm hover:border-primary/40 hover:bg-muted/50"
        >
          <span>
            Open order <span className="font-mono text-xs">{pastedId}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ) : null}

      {isPending ? <WorkspaceListSkeleton /> : null}

      {error ? (
        <Card>
          <EmptyState
            title="Could not load orders"
            description={error.message}
            action={
              <Button variant="outline" onClick={onRetry}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : null}

      {orders && visible.length === 0 ? (
        <Card>
          {term ? (
            <EmptyState
              icon={<SearchX />}
              title={`No orders match “${deferredSearch.trim()}”`}
              action={
                <Button variant="outline" onClick={() => onSearch("")}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <EmptyState icon={<ClipboardList />} title={tab.status ? `No ${tab.label.toLowerCase()} orders` : "No orders yet"} description={tab.status ? undefined : "Orders appear when a quotation is accepted."} />
          )}
        </Card>
      ) : null}

      {visible.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {visible.map((order) => (
            <li key={order.id}>
              <OrderCard order={order} href={hrefFor(tab.key, order.id)} />
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

/**
 * One order as a card: who, when, how much is out, where the goods are and what the deposit is doing. Its deposit and goods
 * come from the same per-order reads the detail makes, so opening the order finds them already loaded.
 */
function OrderCard({ order, href }: { order: OrderView; href: string }) {
  const canReadStock = useCan("INVENTORY_READ");
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

  const ordered = order.lines.reduce((sum, line) => sum + line.quantity, 0);
  const fulfilment = movements.data ? orderFulfilment(order, movements.data) : null;
  const dispatched = fulfilment ? [...fulfilment.byProduct.values()].reduce((sum, entry) => sum + entry.dispatched, 0) : null;
  const sentPercent = dispatched !== null && ordered > 0 ? Math.min(100, Math.round((dispatched / ordered) * 100)) : null;

  /** Where the goods are, in a few words: derived, never a status of its own. */
  const goods = (() => {
    if (order.status === "CANCELLED") return "Nothing dispatched";
    if (!fulfilment) return null;
    if (order.status === "CONFIRMED") return "Ready for dispatch";
    if (order.status === "DISPATCHED") {
      return [`${fulfilment.stillOut} out on rent`, fulfilment.leftToDispatch > 0 ? `${fulfilment.leftToDispatch} to dispatch` : null]
        .filter(Boolean)
        .join(" · ");
    }
    return "All returned";
  })();

  return (
    <Link
      href={href}
      className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/60 focus-visible:border-primary focus-visible:outline-none"
      aria-label={`Open ${order.orderNumber} for ${order.customerName}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{order.customerName}</p>
          <p className="font-mono text-xs text-muted-foreground">{order.orderNumber}</p>
        </div>
        <Badge variant={ORDER_STATUS_VARIANT[order.status]}>{order.status.charAt(0) + order.status.slice(1).toLowerCase()}</Badge>
      </div>

      <dl className="space-y-1.5 text-sm">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
          <dd className="tabular">{formatEventDate(order.eventDate)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <Boxes className="size-4 shrink-0 text-muted-foreground" />
          <dd className="text-muted-foreground">
            {ordered} {ordered === 1 ? "item" : "items"}
            {goods ? ` · ${goods}` : ""}
          </dd>
        </div>
      </dl>

      {sentPercent !== null && order.status !== "CANCELLED" ? (
        <div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${dispatched} of ${ordered} dispatched`}>
            <div className="h-full rounded-full bg-primary" style={{ width: `${sentPercent}%` }} />
          </div>
          <p className="tabular mt-1 text-[0.7rem] text-muted-foreground">
            {dispatched} of {ordered} dispatched
          </p>
        </div>
      ) : null}

      <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-[0.7rem] text-muted-foreground">
            <PiggyBank className="size-3" /> Deposit {formatMoney(order.securityDeposit)}
          </p>
          {deposit.data ? (
            <Badge variant={DEPOSIT_VARIANT[deposit.data.status]} className="mt-1 text-[0.65rem]">
              {deposit.data.status.replace("_", " ")}
            </Badge>
          ) : null}
        </div>
        <span className="text-right">
          <span className="block text-[0.7rem] text-muted-foreground">Total</span>
          <span className="tabular text-base font-semibold">{formatMoney(order.totalAmount)}</span>
        </span>
      </div>
    </Link>
  );
}

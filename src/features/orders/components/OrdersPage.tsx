"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ClipboardList, SearchX } from "lucide-react";
import { listOrders, orderKeys } from "@/features/orders/api";
import type { OrderStatus, OrderView } from "@/features/orders/types";
import { OrderDetail } from "@/features/orders/components/OrderDetail";
import { DEPOSIT_VARIANT, ORDER_STATUS_VARIANT, formatEventDate } from "@/features/orders/display";
import { inventoryKeys, listStockMovementsByOrder } from "@/features/inventory/api";
import { orderFulfilment } from "@/features/inventory/fulfilment";
import { depositKeys, getDepositByOrder } from "@/features/deposits/api";
import { useCan } from "@/features/auth";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import {
  WorkspaceLayout,
  WorkspaceListSkeleton,
  WorkspaceSearch,
  workspaceHref as sharedWorkspaceHref,
} from "@/components/workspace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

/** The workspace's filters, in lifecycle order. "" is all. */
const FILTERS: { key: string; label: string; status?: OrderStatus }[] = [
  { key: "", label: "All orders" },
  { key: "confirmed", label: "Confirmed", status: "CONFIRMED" },
  { key: "dispatched", label: "Dispatched", status: "DISPATCHED" },
  { key: "returned", label: "Returned", status: "RETURNED" },
  { key: "completed", label: "Completed", status: "COMPLETED" },
  { key: "cancelled", label: "Cancelled", status: "CANCELLED" },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The workspace URL for a filter, optionally with an order open in it. */
const workspaceHref = (filterKey: string, id?: string) =>
  sharedWorkspaceHref("/orders", filterKey, id);

/**
 * The order workspace: a filter sidebar of its own beside a searchable list,
 * or the order opened from it. Both come from the URL (`?status=`, `?id=`),
 * the same way the quotation workspace works, so the links conversion,
 * deposits and credit notes already make (`/orders?id=…`) land on their order.
 */
export function OrdersPage({ orderId, status }: { orderId: string; status: string }) {
  const filter = FILTERS.find((candidate) => candidate.key === status.toLowerCase()) ?? FILTERS[0];
  const [search, setSearch] = useState("");

  // Fresh on every visit: an order converted, moved or cancelled a moment ago
  // changes the list and its counts.
  const list = useQuery({
    queryKey: orderKeys.list,
    queryFn: ({ signal }) => listOrders(signal),
    staleTime: 0,
    retry: false,
  });

  const counts = useMemo(() => {
    const byStatus = new Map<string, number>();
    for (const order of list.data ?? []) {
      byStatus.set(order.status, (byStatus.get(order.status) ?? 0) + 1);
    }
    return byStatus;
  }, [list.data]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Orders"
        description="Confirmed work, from dispatch through return to a settled deposit."
      />

      <WorkspaceLayout
        navLabel="Order filters"
        heading="Orders"
        filters={FILTERS}
        activeKey={filter.key}
        counts={list.data ? counts : undefined}
        total={list.data?.length}
        hrefFor={(key) => workspaceHref(key)}
      >
          {orderId ? (
            <OrderDetail
              key={orderId}
              orderId={orderId}
              backHref={workspaceHref(filter.key)}
              backLabel={filter.status ? `${filter.label} orders` : "All orders"}
            />
          ) : (
            <OrderList
              orders={list.data}
              isPending={list.isPending}
              error={list.error}
              onRetry={() => list.refetch()}
              filter={filter}
              search={search}
              onSearch={setSearch}
            />
          )}
      </WorkspaceLayout>
    </div>
  );
}

function OrderList({
  orders,
  isPending,
  error,
  onRetry,
  filter,
  search,
  onSearch,
}: {
  orders: OrderView[] | undefined;
  isPending: boolean;
  error: Error | null;
  onRetry: () => void;
  filter: (typeof FILTERS)[number];
  search: string;
  onSearch: (value: string) => void;
}) {
  const deferredSearch = useDeferredValue(search);
  const term = deferredSearch.trim().toLowerCase();

  const inFilter = useMemo(
    () => (orders ?? []).filter((order) => !filter.status || order.status === filter.status),
    [orders, filter.status],
  );

  const visible = useMemo(() => {
    if (!term) return inFilter;
    return inFilter.filter(
      (order) =>
        order.customerName.toLowerCase().includes(term) ||
        order.orderNumber.toLowerCase().includes(term) ||
        (order.customerEmail ?? "").toLowerCase().includes(term) ||
        order.id.toLowerCase() === term ||
        order.quotationId?.toLowerCase() === term,
    );
  }, [inFilter, term]);

  // A pasted id is still openable directly, including one the list does not
  // hold, which is the only way to reach an order when there is no list.
  const pastedId = UUID.test(deferredSearch.trim()) ? deferredSearch.trim() : "";

  return (
    <>
      <WorkspaceSearch
        value={search}
        onChange={onSearch}
        placeholder="Search orders…"
        label="Search orders by customer, email or order number"
        summary={
          orders ? (
            <>
              {visible.length} of {inFilter.length}{" "}
              {filter.status ? filter.label.toLowerCase() : ""} orders
            </>
          ) : undefined
        }
      />

      {pastedId && !visible.some((order) => order.id === pastedId) ? (
        <Link
          href={workspaceHref(filter.key, pastedId)}
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
            <EmptyState
              icon={<ClipboardList />}
              title={filter.status ? `No ${filter.label.toLowerCase()} orders` : "No orders yet"}
            />
          )}
        </Card>
      ) : null}

      {visible.length > 0 ? (
        <Card>
          <ul className="divide-y divide-border">
            {visible.map((order) => (
              <li key={order.id}>
                <OrderRow order={order} href={workspaceHref(filter.key, order.id)} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

/**
 * One order in the list. Its deposit and goods come from the same per-order
 * reads the detail makes, so opening the order finds them already loaded.
 */
function OrderRow({ order, href }: { order: OrderView; href: string }) {
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

  /** Where the goods are, in a few words — derived, never a status of its own. */
  const goods = (() => {
    if (order.status === "CANCELLED") return "Nothing dispatched";
    if (!fulfilment) return null;
    if (order.status === "CONFIRMED") return "Ready for dispatch";
    if (order.status === "DISPATCHED") {
      return [
        `${fulfilment.stillOut} out on rent`,
        fulfilment.leftToDispatch > 0 ? `${fulfilment.leftToDispatch} to dispatch` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    }
    return "All returned";
  })();

  return (
    <Link
      href={href}
      className="group flex items-center gap-4 px-4 py-3.5 transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
      aria-label={`Open ${order.orderNumber} for ${order.customerName}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-semibold">{order.customerName}</span>
          <Badge variant={ORDER_STATUS_VARIANT[order.status]}>{order.status}</Badge>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="font-mono">{order.orderNumber}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular">
            {ordered} {ordered === 1 ? "item" : "items"}
          </span>
          {goods ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{goods}</span>
            </>
          ) : null}
        </p>
        {/* On a narrow screen the figures sit under the name. */}
        <p className="mt-1 text-xs text-muted-foreground tabular sm:hidden">
          {formatEventDate(order.eventDate)} ·{" "}
          <span className="font-medium text-foreground">{formatMoney(order.totalAmount)}</span>
        </p>
      </div>

      <dl className="hidden shrink-0 items-center gap-6 text-right sm:flex">
        <div className="w-24">
          <dt className="text-[0.7rem] text-muted-foreground">Event date</dt>
          <dd className="tabular text-sm">{formatEventDate(order.eventDate)}</dd>
        </div>
        <div className="hidden w-32 lg:block">
          <dt className="text-[0.7rem] text-muted-foreground">Deposit</dt>
          <dd className="tabular text-sm">{formatMoney(order.securityDeposit)}</dd>
          {deposit.data ? (
            <dd className="mt-0.5">
              <Badge variant={DEPOSIT_VARIANT[deposit.data.status]} className="text-[0.65rem]">
                {deposit.data.status.replace("_", " ")}
              </Badge>
            </dd>
          ) : null}
        </div>
        <div className="w-28">
          <dt className="text-[0.7rem] text-muted-foreground">Total</dt>
          <dd className="tabular text-sm font-semibold">{formatMoney(order.totalAmount)}</dd>
        </div>
      </dl>

      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}

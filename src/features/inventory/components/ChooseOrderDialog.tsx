"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ORDER_STATUS_MEANING, type OrderView } from "@/features/orders/types";
import { listOrders, orderKeys } from "@/features/orders/api";
import { formatMoney } from "@/lib/money";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Where "Record movement" starts on the Stock movement list: a movement is recorded against one
 * order, so the person first picks which.
 *
 * Only orders that can still move goods are offered: a confirmed order can be dispatched and a
 * dispatched one dispatched further or taken back. Anything else (returned, completed, cancelled)
 * would be refused by the backend, so it is not shown as a choice.
 */
export function ChooseOrderDialog({
  onChoose,
  onClose,
}: {
  onChoose: (orderId: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  const orders = useQuery({
    queryKey: orderKeys.list,
    queryFn: ({ signal }) => listOrders(signal),
    staleTime: 0,
    retry: false,
  });

  const movable = useMemo(() => {
    const text = search.trim().toLowerCase();
    return (orders.data ?? [])
      .filter((order) => order.status === "CONFIRMED" || order.status === "DISPATCHED")
      .filter(
        (order) =>
          text === "" ||
          order.orderNumber.toLowerCase().includes(text) ||
          order.customerName.toLowerCase().includes(text),
      );
  }, [orders.data, search]);

  return (
    <Dialog
      open
      onClose={onClose}
      title="Choose an order"
      description="Goods are dispatched and returned against one order. Only orders that can still move goods are listed."
      footer={
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      <div className="space-y-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by order number or customer"
          aria-label="Search orders"
        />

        {orders.isPending ? <Skeleton className="h-32" /> : null}

        {orders.isError ? (
          <Alert
            tone="error"
            title={orders.error instanceof Error ? orders.error.message : "Could not load orders."}
          />
        ) : null}

        {orders.data && movable.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {search.trim() === ""
              ? "No order is waiting to be dispatched or returned."
              : "No such order is waiting to be dispatched or returned."}
          </p>
        ) : null}

        <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-md border border-border">
          {movable.map((order: OrderView) => (
            <li key={order.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                aria-label={`Choose ${order.orderNumber}`}
                onClick={() => onChoose(order.id)}
              >
                <span>
                  <span className="font-mono font-medium">{order.orderNumber}</span>
                  <span className="block text-xs text-muted-foreground">{order.customerName}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="tabular text-xs text-muted-foreground">
                    {formatMoney(order.totalAmount)}
                  </span>
                  <Badge variant="outline" title={ORDER_STATUS_MEANING[order.status]}>
                    {order.status}
                  </Badge>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}

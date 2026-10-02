"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Boxes, Plus, X } from "lucide-react";
import { inventoryKeys, listStockMovements } from "@/features/inventory/api";
import {
  DIRECTION_MEANING,
  MOVEMENT_DIRECTIONS,
  type MovementDirection,
  type StockMovementRow,
} from "@/features/inventory/types";
import { ChooseOrderDialog } from "@/features/inventory/components/ChooseOrderDialog";
import { RecordMovementDialog } from "@/features/inventory/components/RecordMovementDialog";
import { listProducts, listWarehouses, masterDataKeys } from "@/features/master-data/api";
import { useCan } from "@/features/auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const COLUMNS = 6;
const LIMITS = [50, 100, 200] as const;
const DAY = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

/** A date-only value ("2026-10-02") shown as a day, without a timezone shifting it. */
function formatDay(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : DAY.format(date);
}

/** Waits for typing to pause, so the list is asked for once rather than per keystroke. */
function useSettled(value: string, delayMs = 300): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

/**
 * Every dispatch and return across all orders, newest first. `initialOrderId` comes from
 * `?orderId=`, so an order can link to its own movements; the list then shows only that order until
 * it is cleared.
 */
export function StockMovementsPage({ initialOrderId = "" }: { initialOrderId?: string }) {
  const canWrite = useCan("INVENTORY_WRITE");

  const [orderId, setOrderId] = useState(initialOrderId);
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState<"" | MovementDirection>("");
  const [limit, setLimit] = useState<number>(LIMITS[0]);

  // Picking an order to record against: first choose it, then the existing record dialog opens.
  const [choosing, setChoosing] = useState(false);
  const [recordingFor, setRecordingFor] = useState<string | null>(null);

  const settledSearch = useSettled(search);
  const filters = useMemo(
    () => ({
      direction: direction || undefined,
      orderId: orderId || undefined,
      q: settledSearch.trim() || undefined,
      limit,
    }),
    [direction, orderId, settledSearch, limit],
  );

  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: inventoryKeys.movementList(filters),
    queryFn: ({ signal }) => listStockMovements(filters, signal),
    // Fresh on every visit: a movement recorded a moment ago on the order screen belongs here.
    staleTime: 0,
    retry: false,
  });

  /**
   * A movement line carries a product id and, for a product with variants, a variant id — the
   * backend does not denormalise names the way quotation and order lines do, so resolving them is
   * the UI's job. An id with no match renders as the id rather than as an error; a retired product
   * falls into that case honestly, since the product list returns active products only.
   */
  const products = useQuery({
    queryKey: masterDataKeys.products,
    queryFn: ({ signal }) => listProducts(signal),
  });
  const productNames = useMemo(
    () => new Map((products.data ?? []).map((product) => [product.id, product.name])),
    [products.data],
  );
  const variantNames = useMemo(
    () =>
      new Map(
        (products.data ?? []).flatMap((product) =>
          product.variants.map((variant) => [variant.id, variant.name] as const),
        ),
      ),
    [products.data],
  );

  const warehouses = useQuery({
    queryKey: masterDataKeys.warehouses,
    queryFn: ({ signal }) => listWarehouses(signal),
    retry: false,
  });
  const warehouseName = (warehouseId: string | null) =>
    warehouseId
      ? (warehouses.data?.find((warehouse) => warehouse.id === warehouseId)?.name ?? warehouseId)
      : "—";

  const goods = (movement: StockMovementRow) =>
    movement.lines
      .map((line) => {
        const product = productNames.get(line.productId) ?? line.productId;
        const variant = line.variantId ? (variantNames.get(line.variantId) ?? line.variantId) : null;
        return `${product}${variant ? ` (${variant})` : ""} × ${line.quantity}`;
      })
      .join(", ");

  // The order a link from the order screen narrowed the list to, named by its number once known.
  const narrowedTo = orderId
    ? (data?.find((row) => row.orderId === orderId)?.orderNumber ?? "this order")
    : null;

  const narrowed = orderId !== "" || direction !== "" || settledSearch.trim() !== "";
  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock movement"
        description="Every dispatch and return across all orders, newest first."
        actions={
          canWrite ? (
            <Button onClick={() => (orderId ? setRecordingFor(orderId) : setChoosing(true))}>
              <Plus />
              Record movement
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by order or movement number"
          aria-label="Search movements"
          className="w-full sm:w-72"
        />
        <Select
          value={direction}
          onChange={(event) => setDirection(event.target.value as "" | MovementDirection)}
          aria-label="Direction"
          className="w-full sm:w-52"
        >
          <option value="">All directions</option>
          {MOVEMENT_DIRECTIONS.map((value) => (
            <option key={value} value={value}>
              {value === "OUTWARD" ? "Outward (dispatched)" : "Inward (returned)"}
            </option>
          ))}
        </Select>
        <Select
          value={String(limit)}
          onChange={(event) => setLimit(Number(event.target.value))}
          aria-label="How many to load"
          className="w-full sm:w-36"
        >
          {LIMITS.map((value) => (
            <option key={value} value={value}>
              Last {value}
            </option>
          ))}
        </Select>
      </div>

      {narrowedTo ? (
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="outline">Showing {narrowedTo} only</Badge>
          <Button variant="ghost" size="sm" onClick={() => setOrderId("")}>
            <X />
            Show all orders
          </Button>
        </div>
      ) : null}

      {isError ? (
        <Alert
          tone="error"
          title={error instanceof Error ? error.message : "Could not load stock movements"}
        >
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </Alert>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {isPending
          ? "Loading…"
          : `${rows.length} movement${rows.length === 1 ? "" : "s"}${
              rows.length === limit ? ` (the latest ${limit}; raise "How many" to see more)` : ""
            }${isFetching && !isPending ? " · refreshing" : ""}`}
      </p>

      <Card>
        <TableWrapper>
          <Table>
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Movement</TH>
                <TH>Order</TH>
                <TH>Direction</TH>
                <TH>Warehouse</TH>
                <TH>Goods</TH>
              </tr>
            </THead>
            <TBody>
              {isPending ? <TableSkeleton columns={COLUMNS} /> : null}

              {rows.map((movement) => (
                <TR key={movement.id}>
                  <TD className="tabular whitespace-nowrap text-muted-foreground">
                    {formatDay(movement.movedOn)}
                  </TD>
                  <TD className="font-mono text-xs">{movement.movementNumber}</TD>
                  <TD>
                    <Link
                      href={`/orders?id=${movement.orderId}`}
                      className="font-mono text-xs hover:underline"
                      aria-label={`Open order ${movement.orderNumber ?? movement.orderId}`}
                    >
                      {movement.orderNumber ?? movement.orderId}
                    </Link>
                  </TD>
                  <TD>
                    <Badge
                      variant={movement.direction === "OUTWARD" ? "warning" : "success"}
                      title={DIRECTION_MEANING[movement.direction]}
                    >
                      {movement.direction === "OUTWARD" ? <ArrowUpRight /> : <ArrowDownLeft />}
                      {movement.direction}
                    </Badge>
                  </TD>
                  <TD className="whitespace-nowrap">{warehouseName(movement.warehouseId)}</TD>
                  <TD className="max-w-80">
                    <span>{goods(movement)}</span>
                    {movement.remarks ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Remarks: {movement.remarks}
                      </span>
                    ) : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrapper>

        {!isPending && !isError && rows.length === 0 ? (
          <EmptyState
            icon={<Boxes />}
            title={narrowed ? "No movement matches those filters" : "Nothing has moved yet"}
            description={
              narrowed
                ? "Try a different order number, direction or search term."
                : "A dispatch or return appears here as soon as it is recorded against an order."
            }
          />
        ) : null}
      </Card>

      {choosing ? (
        <ChooseOrderDialog
          onClose={() => setChoosing(false)}
          onChoose={(chosen) => {
            setChoosing(false);
            setRecordingFor(chosen);
          }}
        />
      ) : null}

      {recordingFor ? (
        <RecordMovementDialog orderId={recordingFor} onClose={() => setRecordingFor(null)} />
      ) : null}
    </div>
  );
}

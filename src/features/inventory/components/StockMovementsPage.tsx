"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Boxes, Plus } from "lucide-react";
import { inventoryKeys, listStockMovementsByOrder } from "@/features/inventory/api";
import { DIRECTION_MEANING } from "@/features/inventory/types";
import { RecordMovementDialog } from "@/features/inventory/components/RecordMovementDialog";
import { listProducts, listWarehouses, masterDataKeys } from "@/features/master-data/api";
import { useCan } from "@/features/auth";
import { DEMO_MOVEMENT_ORDER_EXAMPLES } from "@/mock-data/seed";
import { IdLookup } from "@/components/id-lookup";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

/** `initialOrderId` comes from `?orderId=`, so an order can link to its movements. */
export function StockMovementsPage({ initialOrderId = "" }: { initialOrderId?: string }) {
  const [orderId, setOrderId] = useState(initialOrderId);
  const [recording, setRecording] = useState(false);
  const canWrite = useCan("INVENTORY_WRITE");

  /**
   * A movement line carries only a product id — the backend does not
   * denormalise the name the way quotation and order lines do, so resolving it
   * is the UI's job. It reads the catalogue rather than the seed so a product
   * added in this session resolves too, and an id with no match renders as the
   * id rather than as an error, the same way an orphaned category does on the
   * products screen. A retired product falls into that case honestly: the list
   * endpoint returns active products only, so the backend could not name it
   * either.
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
      : null;

  const { data, isFetching, isError, error } = useQuery({
    queryKey: inventoryKeys.movementsByOrder(orderId),
    queryFn: ({ signal }) => listStockMovementsByOrder(orderId, signal),
    enabled: orderId !== "",
    retry: false,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock movement"
        description="What went out to an event and what came back."
        actions={
          canWrite ? (
            // Always present, disabled until an order is chosen: a movement is
            // recorded against one order, and there is no list to pick from, so
            // the id in the lookup box above is the only way this screen knows
            // which order is meant.
            <Button
              disabled={orderId === ""}
              title={orderId === "" ? "Find an order first" : undefined}
              onClick={() => setRecording(true)}
            >
              <Plus />
              Record movement
            </Button>
          ) : null
        }
      />

      <IdLookup
        label="Order ID"
        value={orderId}
        onChange={setOrderId}
        submitLabel="Find movements"
        busy={isFetching}
        examples={DEMO_MOVEMENT_ORDER_EXAMPLES}
      />

      {isFetching ? <Skeleton className="h-48" /> : null}

      {isError ? (
        <Alert tone="error" title={error instanceof Error ? error.message : "Lookup failed"} />
      ) : null}

      {data && !isFetching && data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Boxes />}
            title="Nothing has moved against that order"
            description="No dispatch or return has been recorded — which is not the same as the order being wrong."
          />
        </Card>
      ) : null}

      {data && !isFetching
        ? data.map((movement) => (
            <Card key={movement.id}>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>{movement.movementNumber}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    <span className="tabular">{movement.movedOn}</span>
                    {movement.warehouseId ? ` · ${warehouseName(movement.warehouseId)}` : ""}
                  </p>
                </div>
                <Badge
                  variant={movement.direction === "OUTWARD" ? "warning" : "success"}
                  title={DIRECTION_MEANING[movement.direction]}
                >
                  {movement.direction === "OUTWARD" ? <ArrowUpRight /> : <ArrowDownLeft />}
                  {movement.direction}
                </Badge>
              </CardHeader>

              <TableWrapper>
                <Table>
                  <THead>
                    <tr>
                      <TH>Product</TH>
                      <TH>Variant</TH>
                      <TH className="text-right">Quantity</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {movement.lines.map((line) => (
                      <TR key={line.id}>
                        <TD className="font-medium">{productNames.get(line.productId) ?? line.productId}</TD>
                        <TD className="text-muted-foreground">
                          {line.variantId ? (variantNames.get(line.variantId) ?? line.variantId) : "—"}
                        </TD>
                        <TD className="text-right tabular">{line.quantity}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrapper>

              {movement.remarks ? (
                <CardContent className="border-t border-border text-sm">
                  <span className="text-muted-foreground">Remarks: </span>
                  {movement.remarks}
                </CardContent>
              ) : null}
            </Card>
          ))
        : null}

      {recording && orderId !== "" ? (
        <RecordMovementDialog orderId={orderId} onClose={() => setRecording(false)} />
      ) : null}
    </div>
  );
}

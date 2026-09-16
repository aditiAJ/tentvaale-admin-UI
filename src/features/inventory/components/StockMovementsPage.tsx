"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Boxes } from "lucide-react";
import { inventoryKeys, listStockMovementsByOrder } from "@/features/inventory/api";
import { DIRECTION_MEANING } from "@/features/inventory/types";
import { DEMO_MOVEMENT_ORDER_EXAMPLES, SEED_PRODUCTS } from "@/mock-data/seed";
import { IdLookup } from "@/components/id-lookup";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

/**
 * A movement line carries only a product id — the backend does not denormalise
 * the name the way quotation and order lines do. Resolving it is therefore the
 * UI's job, and an id with no matching product renders as the id rather than
 * as an error, the same way an orphaned category does on the products screen.
 */
function productName(productId: string): string {
  return SEED_PRODUCTS.find((product) => product.id === productId)?.name ?? productId;
}

export function StockMovementsPage() {
  const [orderId, setOrderId] = useState("");

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
                  <p className="tabular text-xs text-muted-foreground">{movement.movedOn}</p>
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
                      <TH className="text-right">Quantity</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {movement.lines.map((line) => (
                      <TR key={line.id}>
                        <TD className="font-medium">{productName(line.productId)}</TD>
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
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { Warehouse } from "lucide-react";
import { deriveAvailability, inventoryKeys } from "@/features/inventory/api";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const COLUMNS = 4;

export function AvailabilityPage() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: inventoryKeys.availability,
    queryFn: () => deriveAvailability(),
    retry: false,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Availability"
        description="What is on the shelf across warehouses, and what is out on rent."
      />

      <Card>
        <TableWrapper>
          <Table>
            <THead>
              <tr>
                <TH>SKU</TH>
                <TH>Product</TH>
                <TH className="text-right">In stock</TH>
                <TH className="text-right">On rent</TH>
              </tr>
            </THead>
            <TBody>
              {isPending ? <TableSkeleton columns={COLUMNS} /> : null}

              {!isPending && data
                ? data.map((row) => (
                    <TR key={row.productId}>
                      <TD className="font-mono text-xs">{row.sku}</TD>
                      <TD className="font-medium">{row.productName}</TD>
                      <TD className="text-right tabular">{row.inStock}</TD>
                      <TD className="text-right">
                        {row.onRent > 0 ? (
                          <Badge variant="warning">{row.onRent} out</Badge>
                        ) : (
                          <span className="tabular text-muted-foreground">In store</span>
                        )}
                      </TD>
                    </TR>
                  ))
                : null}
            </TBody>
          </Table>
        </TableWrapper>

        {isError ? (
          <EmptyState
            icon={<Warehouse />}
            title="Availability cannot be calculated"
            description={error instanceof Error ? error.message : undefined}
            action={
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        ) : null}
      </Card>
    </div>
  );
}

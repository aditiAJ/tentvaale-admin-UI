"use client";

import { useQuery } from "@tanstack/react-query";
import { Warehouse } from "lucide-react";
import { listWarehouses, masterDataKeys } from "@/features/master-data/api";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const COLUMNS = 3;

export function WarehousesPage() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: masterDataKeys.warehouses,
    queryFn: ({ signal }) => listWarehouses(signal),
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Warehouses" description="Where stock is held between events." />

      <Card>
        <TableWrapper>
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>City</TH>
                <TH>ID</TH>
              </tr>
            </THead>
            <TBody>
              {isPending ? <TableSkeleton columns={COLUMNS} /> : null}

              {!isPending && data
                ? data.map((warehouse) => (
                    <TR key={warehouse.id}>
                      <TD className="font-medium">{warehouse.name}</TD>
                      <TD>{warehouse.city}</TD>
                      <TD className="font-mono text-xs text-muted-foreground">{warehouse.id}</TD>
                    </TR>
                  ))
                : null}
            </TBody>
          </Table>
        </TableWrapper>

        {isError ? (
          <EmptyState
            title="Could not load warehouses"
            description={error instanceof Error ? error.message : undefined}
            action={
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        ) : null}

        {!isPending && !isError && !data?.length ? (
          <EmptyState icon={<Warehouse />} title="No warehouses yet" />
        ) : null}
      </Card>
    </div>
  );
}

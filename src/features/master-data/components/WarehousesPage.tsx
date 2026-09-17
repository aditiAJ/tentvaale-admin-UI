"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Warehouse } from "lucide-react";
import {
  deleteWarehouse,
  listWarehouses,
  masterDataKeys,
} from "@/features/master-data/api";
import type { WarehouseView } from "@/features/master-data/types";
import { WarehouseDialog } from "@/features/master-data/components/WarehouseDialog";
import { RowActions } from "@/features/master-data/components/RowActions";
import { useCan } from "@/features/auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export function WarehousesPage() {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<WarehouseView | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<WarehouseView | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: masterDataKeys.warehouses,
    queryFn: ({ signal }) => listWarehouses(signal),
  });

  const columns = canWrite ? 4 : 3;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Warehouses"
        description="Where stock is held between events."
        actions={
          canWrite ? (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              New warehouse
            </Button>
          ) : null
        }
      />

      <Card>
        <TableWrapper>
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>City</TH>
                <TH>ID</TH>
                {canWrite ? <TH className="text-right">Actions</TH> : null}
              </tr>
            </THead>
            <TBody>
              {isPending ? <TableSkeleton columns={columns} /> : null}

              {!isPending && data
                ? data.map((warehouse) => (
                    <TR key={warehouse.id}>
                      <TD className="font-medium">{warehouse.name}</TD>
                      <TD>{warehouse.city}</TD>
                      <TD className="font-mono text-xs text-muted-foreground">{warehouse.id}</TD>
                      {canWrite ? (
                        <TD>
                          <RowActions
                            label={warehouse.name}
                            onEdit={() => setEditing(warehouse)}
                            onRemove={() => setRemoving(warehouse)}
                          />
                        </TD>
                      ) : null}
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
          <EmptyState
            icon={<Warehouse />}
            title="No warehouses yet"
            action={
              canWrite ? (
                <Button onClick={() => setCreating(true)}>
                  <Plus />
                  New warehouse
                </Button>
              ) : null
            }
          />
        ) : null}
      </Card>

      {creating ? <WarehouseDialog onClose={() => setCreating(false)} /> : null}
      {editing ? (
        <WarehouseDialog existing={editing} onClose={() => setEditing(null)} />
      ) : null}
      {removing ? (
        <ConfirmDialog
          title={`Delete ${removing.name}?`}
          description="It is removed outright. A warehouse that any stock movement still refers to cannot be deleted."
          confirmLabel="Delete warehouse"
          fallbackError="Could not delete the warehouse."
          action={() => deleteWarehouse(removing.id)}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: masterDataKeys.warehouses });
            setRemoving(null);
          }}
          onClose={() => setRemoving(null)}
        />
      ) : null}
    </div>
  );
}

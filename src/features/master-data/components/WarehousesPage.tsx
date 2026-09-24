"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Warehouse } from "lucide-react";
import {
  deleteWarehouse,
  listWarehouses,
  masterDataKeys,
} from "@/features/master-data/api";
import type { WarehouseView } from "@/features/master-data/types";
import { WarehouseDialog } from "@/features/master-data/components/WarehouseDialog";
import { WarehouseProductsDialog } from "@/features/master-data/components/WarehouseProductsDialog";
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
  const [viewingProducts, setViewingProducts] = useState<WarehouseView | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: masterDataKeys.warehouses,
    queryFn: ({ signal }) => listWarehouses(signal),
  });

  // Actions is always shown: anyone who can see a warehouse can see what it holds.
  const columns = 5;

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
                <TH>Address</TH>
                <TH>City</TH>
                <TH>ID</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {isPending ? <TableSkeleton columns={columns} /> : null}

              {!isPending && data
                ? data.map((warehouse) => (
                    <TR key={warehouse.id}>
                      <TD className="font-medium">{warehouse.name}</TD>
                      {/* Truncated to one line with the full value on hover, the
                          same way the notification log handles a long recipient.
                          Wrapping instead would make every row a different
                          height and cost the table its scannability. */}
                      <TD className="max-w-56 truncate" title={warehouse.address}>
                        {warehouse.address}
                      </TD>
                      <TD>{warehouse.city}</TD>
                      <TD className="font-mono text-xs text-muted-foreground">{warehouse.id}</TD>
                      <TD>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingProducts(warehouse)}
                            aria-label={`Products in ${warehouse.name}`}
                          >
                            <Package />
                            Products
                          </Button>
                          {canWrite ? (
                            <RowActions
                              label={warehouse.name}
                              onEdit={() => setEditing(warehouse)}
                              onRemove={() => setRemoving(warehouse)}
                            />
                          ) : null}
                        </div>
                      </TD>
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
      {viewingProducts ? (
        <WarehouseProductsDialog
          warehouse={viewingProducts}
          onClose={() => setViewingProducts(null)}
        />
      ) : null}
      {removing ? (
        <ConfirmDialog
          title={`Delete ${removing.name}?`}
          description="It is removed outright, along with the product quantities it holds. A warehouse that any stock movement still refers to cannot be deleted."
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

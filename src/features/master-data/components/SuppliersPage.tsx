"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Package, Pencil, Plus } from "lucide-react";
import { listSuppliers, masterDataKeys } from "@/features/master-data/api";
import type { SupplierView } from "@/features/master-data/types";
import { SupplierDialog } from "@/features/master-data/components/SupplierDialog";
import { SupplierStockDialog } from "@/features/master-data/components/SupplierStockDialog";
import { useCan } from "@/features/auth";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

/** Rental suppliers and what each can provide. Internal only: customers never see a supplier. */
export function SuppliersPage() {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SupplierView | null>(null);
  const [viewingStock, setViewingStock] = useState<SupplierView | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: masterDataKeys.suppliers,
    queryFn: ({ signal }) => listSuppliers(signal),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Suppliers"
        description="Outside rental partners you can draw stock from when your own runs out."
        actions={
          canWrite ? (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              New supplier
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
                <TH>Contact</TH>
                <TH>Phone</TH>
                <TH>Email</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {isPending ? <TableSkeleton columns={5} /> : null}

              {!isPending && data
                ? data.map((supplier) => (
                    <TR key={supplier.id}>
                      <TD className="font-medium">
                        {supplier.name}
                        {!supplier.active ? <Badge className="ml-2">Inactive</Badge> : null}
                      </TD>
                      <TD>{supplier.contactPerson ?? <span className="text-muted-foreground">—</span>}</TD>
                      <TD className="tabular text-xs">
                        {supplier.phone ?? <span className="text-muted-foreground">—</span>}
                      </TD>
                      <TD className="text-xs">
                        {supplier.email ?? <span className="text-muted-foreground">—</span>}
                      </TD>
                      <TD>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingStock(supplier)}
                            aria-label={`Stock at ${supplier.name}`}
                          >
                            <Package />
                            Stock
                          </Button>
                          {canWrite ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditing(supplier)}
                              aria-label={`Edit ${supplier.name}`}
                              title="Edit"
                            >
                              <Pencil />
                            </Button>
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
            title="Could not load suppliers"
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
            icon={<Building2 />}
            title="No suppliers yet"
            action={
              canWrite ? (
                <Button onClick={() => setCreating(true)}>
                  <Plus />
                  New supplier
                </Button>
              ) : null
            }
          />
        ) : null}
      </Card>

      {creating ? <SupplierDialog onClose={() => setCreating(false)} /> : null}
      {editing ? <SupplierDialog existing={editing} onClose={() => setEditing(null)} /> : null}
      {viewingStock ? (
        <SupplierStockDialog supplier={viewingStock} onClose={() => setViewingStock(null)} />
      ) : null}
    </div>
  );
}

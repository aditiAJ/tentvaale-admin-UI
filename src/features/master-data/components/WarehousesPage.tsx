"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus, Warehouse } from "lucide-react";
import { deleteWarehouse, listWarehouses, masterDataKeys } from "@/features/master-data/api";
import type { WarehouseView } from "@/features/master-data/types";
import { WarehouseDialog } from "@/features/master-data/components/WarehouseDialog";
import { WarehouseStockPanel } from "@/features/master-data/components/WarehouseStockPanel";
import { RowActions } from "@/features/master-data/components/RowActions";
import { useCan } from "@/features/auth";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Warehouses as a workspace: the warehouses run down the left as tabs, and the one you pick shows
 * its stock on the right, with the form to add more. On a phone the tabs become a row above.
 * A product added to a warehouse appears in that warehouse's tab straight away.
 */
export function WarehousesPage() {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<WarehouseView | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<WarehouseView | null>(null);
  // Which warehouse's add form is open; switching tabs closes it.
  const [addingFor, setAddingFor] = useState<string | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: masterDataKeys.warehouses,
    queryFn: ({ signal }) => listWarehouses(signal),
  });

  // The picked warehouse, or the first when none is picked (or the picked one was deleted).
  const selected = data?.find((warehouse) => warehouse.id === selectedId) ?? data?.[0] ?? null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Warehouses"
        description="Where stock is held between events. Pick a warehouse to see and change what it holds."
        actions={
          canWrite ? (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              New warehouse
            </Button>
          ) : null
        }
      />

      {isError ? (
        <Card>
          <EmptyState
            title="Could not load warehouses"
            description={error instanceof Error ? error.message : undefined}
            action={
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : null}

      {isPending ? (
        <div className="grid gap-4 lg:grid-cols-[17rem_1fr]">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : null}

      {!isPending && !isError && !data?.length ? (
        <Card>
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
        </Card>
      ) : null}

      {data && data.length > 0 && selected ? (
        <div className="grid items-start gap-4 lg:grid-cols-[17rem_1fr]">
          <nav aria-label="Warehouses" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {data.map((warehouse) => {
              const active = warehouse.id === selected.id;
              return (
                <button
                  key={warehouse.id}
                  type="button"
                  onClick={() => setSelectedId(warehouse.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "min-w-44 shrink-0 rounded-lg border px-3 py-2.5 text-left transition-colors lg:min-w-0",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:bg-muted",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Warehouse className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{warehouse.name}</span>
                    {warehouse.active === false ? <Badge className="ml-auto">Inactive</Badge> : null}
                  </span>
                  {warehouse.city ? (
                    <span className="mt-0.5 block truncate pl-6 text-xs text-muted-foreground">{warehouse.city}</span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <Card className="p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">{selected.name}</h2>
                {selected.address || selected.city ? (
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" />
                    <span className="wrap-break-word">{[selected.address, selected.city].filter(Boolean).join(", ")}</span>
                  </p>
                ) : null}
              </div>
              {canWrite ? (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={addingFor === selected.id ? "outline" : "default"}
                    aria-expanded={addingFor === selected.id}
                    onClick={() => setAddingFor(addingFor === selected.id ? null : selected.id)}
                  >
                    <Plus />
                    Add product
                  </Button>
                  <RowActions
                    label={selected.name}
                    onEdit={() => setEditing(selected)}
                    onRemove={() => setRemoving(selected)}
                  />
                </div>
              ) : null}
            </div>
            {/* Keyed by warehouse so each tab starts with a clean form and search. */}
            <WarehouseStockPanel
              key={selected.id}
              warehouse={selected}
              adding={addingFor === selected.id}
              onCloseAdd={() => setAddingFor(null)}
            />
          </Card>
        </div>
      ) : null}

      {creating ? (
        <WarehouseDialog
          onClose={() => setCreating(false)}
        />
      ) : null}
      {editing ? <WarehouseDialog existing={editing} onClose={() => setEditing(null)} /> : null}
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

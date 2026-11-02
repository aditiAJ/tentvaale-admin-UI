"use client";

import { useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus, Warehouse } from "lucide-react";
import { deleteWarehouse, listWarehouseProducts, listWarehouses, masterDataKeys } from "@/features/master-data/api";
import type { StorageLocationView, WarehouseProductView, WarehouseView } from "@/features/master-data/types";
import { unplacedOf } from "@/features/master-data/components/WarehouseStockPanel";
import { formatCount } from "@/components/ui/stat";
import { WarehouseDialog } from "@/features/master-data/components/WarehouseDialog";
import { WarehouseImportButton } from "@/features/master-data/components/WarehouseImportButton";
import { WarehouseStockPanel } from "@/features/master-data/components/WarehouseStockPanel";
import { WarehouseLayoutPanel } from "@/features/master-data/components/WarehouseLayoutPanel";
import { WarehousePlacementPanel } from "@/features/master-data/components/WarehousePlacementPanel";
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

/** The three views of a warehouse: id, label, and what it is for (shown as a hint). */
const TABS = [
  ["stock", "Stock", "What the warehouse holds, and how much has no location yet"],
  ["layout", "Layout", "Zones, bays, racks and levels"],
  ["placement", "Where it is kept", "Which location each product is in"],
] as const;

/**
 * Warehouses as a workspace: the warehouses run down the left as tabs, and the one you pick shows
 * its stock on the right, with the form to add more. On a phone the tabs become a row above.
 * A product added to a warehouse appears in that warehouse's tab straight away.
 */
export function WarehousesPage() {
  const canWrite = useCan("LOGISTICS_WRITE");
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<WarehouseView | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<WarehouseView | null>(null);
  // Which warehouse's add form is open; switching tabs closes it.
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [tab, setTab] = useState<"stock" | "layout" | "placement">("stock");

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: masterDataKeys.warehouses,
    queryFn: ({ signal }) => listWarehouses(signal),
  });

  // The picked warehouse, or the first when none is picked (or the picked one was deleted).
  const selected = data?.find((warehouse) => warehouse.id === selectedId) ?? data?.[0] ?? null;

  // A line of stock to place, handed from the Stock tab to "Where it is kept" (which opens its Place form ready).
  const [placeRequest, setPlaceRequest] = useState<WarehouseProductView | null>(null);
  // A location the Layout tab sent over: "Where it is kept" opens narrowed to it (and everything inside it).
  const [filterRequest, setFilterRequest] = useState<StorageLocationView | null>(null);

  // What each warehouse holds, for its card. The same query the Stock tab uses, so picking a warehouse costs nothing
  // more. Past a dozen warehouses the cards simply go without the figures rather than fetching every list.
  const cardStock = useQueries({
    queries: (data && data.length <= 12 ? data : []).map((warehouse) => ({
      queryKey: masterDataKeys.warehouseProducts(warehouse.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => listWarehouseProducts(warehouse.id, signal),
    })),
  });
  const stockSummary = new Map<string, { units: number; unplaced: number }>();
  (data && data.length <= 12 ? data : []).forEach((warehouse, index) => {
    const lines = cardStock[index]?.data;
    if (lines) {
      stockSummary.set(warehouse.id, {
        units: lines.reduce((sum, line) => sum + line.quantity, 0),
        unplaced: lines.reduce((sum, line) => sum + unplacedOf(line), 0),
      });
    }
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Warehouses"
        description="Where stock is held between events. Pick a warehouse to see and change what it holds."
        actions={
          canWrite ? (
            <>
              <WarehouseImportButton />
              <Button onClick={() => setCreating(true)}>
                <Plus />
                New warehouse
              </Button>
            </>
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
          <nav aria-label="Warehouses" className="flex min-w-0 gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {data.map((warehouse) => {
              const active = warehouse.id === selected.id;
              return (
                <button
                  key={warehouse.id}
                  type="button"
                  onClick={() => setSelectedId(warehouse.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "min-w-52 shrink-0 rounded-lg border px-3 py-2.5 text-left transition-colors lg:min-w-0",
                    active
                      ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                      : "border-border bg-card hover:bg-muted",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Warehouse className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                    <span className="truncate">{warehouse.name}</span>
                    {warehouse.active === false ? <Badge className="ml-auto">Inactive</Badge> : null}
                  </span>
                  {warehouse.city || warehouse.code ? (
                    <span className="mt-0.5 flex items-center gap-1.5 truncate pl-6 text-xs text-muted-foreground">
                      {warehouse.code ? <span className="rounded border border-border px-1 font-mono text-[0.65rem]">{warehouse.code}</span> : null}
                      {warehouse.city ? <span className="truncate">{warehouse.city}</span> : null}
                    </span>
                  ) : null}
                  {(() => {
                    const summary = stockSummary.get(warehouse.id);
                    if (!summary) return null;
                    return summary.units === 0 ? (
                      <span className="block truncate pl-6 text-xs text-muted-foreground">No stock yet</span>
                    ) : (
                      <span className="block truncate pl-6 text-xs text-muted-foreground">
                        {formatCount(summary.units)} unit{summary.units === 1 ? "" : "s"} in stock
                        {summary.unplaced > 0 ? (
                          <span className="text-[var(--warning)]"> · {formatCount(summary.unplaced)} not placed yet</span>
                        ) : (
                          " · all placed"
                        )}
                      </span>
                    );
                  })()}
                  {warehouse.locationCount ? (
                    <span className="block truncate pl-6 text-xs text-muted-foreground">
                      {warehouse.zoneCount} zone{warehouse.zoneCount === 1 ? "" : "s"} · {warehouse.locationCount}{" "}
                      location{warehouse.locationCount === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <Card className="min-w-0 p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                  {selected.name}
                  {selected.code ? (
                    <span className="rounded border border-border px-1.5 py-0.5 font-mono text-xs font-normal text-muted-foreground">
                      {selected.code}
                    </span>
                  ) : null}
                  {selected.active === false ? <Badge>Inactive</Badge> : null}
                </h2>
                {selected.address || selected.city ? (
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" />
                    <span className="wrap-break-word">{[selected.address, selected.city].filter(Boolean).join(", ")}</span>
                  </p>
                ) : null}
                {selected.contactPerson || selected.contactNumber ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {[selected.contactPerson, selected.contactNumber].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
                {selected.description ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">{selected.description}</p>
                ) : null}
              </div>
              {canWrite ? (
                <div className="flex items-center gap-2">
                  {tab === "stock" ? (
                  <Button
                    size="sm"
                    variant={addingFor === selected.id ? "outline" : "default"}
                    aria-expanded={addingFor === selected.id}
                    onClick={() => setAddingFor(addingFor === selected.id ? null : selected.id)}
                  >
                    <Plus />
                    Add product
                  </Button>
                  ) : null}
                  <RowActions
                    label={selected.name}
                    onEdit={() => setEditing(selected)}
                    onRemove={() => setRemoving(selected)}
                  />
                </div>
              ) : null}
            </div>
            <div role="tablist" aria-label="Warehouse sections" className="mb-4 flex gap-1 border-b border-border">
              {TABS.map(([id, label, hint], index) => (
                <button
                  key={id}
                  id={`warehouse-tab-${id}`}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  aria-controls="warehouse-tabpanel"
                  // One tab stop for the whole row; the arrow keys move between the tabs (the standard tab pattern).
                  tabIndex={tab === id ? 0 : -1}
                  title={hint}
                  onClick={() => setTab(id)}
                  onKeyDown={(event) => {
                    const last = TABS.length - 1;
                    const next =
                      event.key === "ArrowRight" ? (index + 1) % TABS.length
                      : event.key === "ArrowLeft" ? (index + last) % TABS.length
                      : event.key === "Home" ? 0
                      : event.key === "End" ? last
                      : null;
                    if (next === null) return;
                    event.preventDefault();
                    setTab(TABS[next][0]);
                    document.getElementById(`warehouse-tab-${TABS[next][0]}`)?.focus();
                  }}
                  className={cn(
                    "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                    tab === id
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                  {id === "layout" && selected.locationCount ? (
                    <span className="tabular ml-1.5 text-xs font-normal text-muted-foreground">{selected.locationCount}</span>
                  ) : null}
                </button>
              ))}
            </div>
            {/* Keyed by warehouse so each tab starts with a clean form and search. */}
            <div role="tabpanel" id="warehouse-tabpanel" aria-labelledby={`warehouse-tab-${tab}`}>
            {tab === "stock" ? (
              <WarehouseStockPanel
                key={selected.id}
                warehouse={selected}
                adding={addingFor === selected.id}
                onCloseAdd={() => setAddingFor(null)}
                onPlace={(entry) => {
                  setPlaceRequest(entry);
                  setTab("placement");
                }}
              />
            ) : null}
            {tab === "layout" ? (
              <WarehouseLayoutPanel
                key={selected.id}
                warehouse={selected}
                onOpenPlacement={(location) => {
                  setFilterRequest(location);
                  setTab("placement");
                }}
              />
            ) : null}
            {tab === "placement" ? (
              <WarehousePlacementPanel
                key={selected.id}
                warehouse={selected}
                placeRequest={placeRequest}
                onPlaceRequestHandled={() => setPlaceRequest(null)}
                filterRequest={filterRequest}
                onFilterRequestHandled={() => setFilterRequest(null)}
              />
            ) : null}
            </div>
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
          description="It is removed outright, along with the product quantities it holds, its storage layout and where stock is placed in it. A warehouse that any stock movement still refers to cannot be deleted; deactivate it instead."
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

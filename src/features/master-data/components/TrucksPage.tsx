"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Truck } from "lucide-react";
import { deleteTruck, listTrucks, masterDataKeys } from "@/features/master-data/api";
import type { TruckView } from "@/features/master-data/types";
import { TruckDialog } from "@/features/master-data/components/TruckDialog";
import { RowActions } from "@/features/master-data/components/RowActions";
import { makeAndModel, truckStatus, vehicleTypeLabel, type TruckStatus } from "@/features/master-data/trucks";
import { useCan } from "@/features/auth";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Pagination, paginate } from "@/components/ui/pagination";
import { nextSort, SortHeader, type SortState } from "@/components/ui/sort-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { formatCount } from "@/components/ui/stat";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Filter = "all" | TruckStatus;
type SortKey = "registration" | "vehicle" | "load" | "space" | "status";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "available", label: "Available" },
  { id: "maintenance", label: "In maintenance" },
  { id: "inactive", label: "Inactive" },
];

const STATUS_ORDER: Record<TruckStatus, number> = { available: 0, maintenance: 1, inactive: 2 };

const COMPARE: Record<SortKey, (a: TruckView, b: TruckView) => number> = {
  registration: (a, b) => a.registration.localeCompare(b.registration),
  vehicle: (a, b) =>
    `${vehicleTypeLabel(a.vehicleType) ?? "~"} ${makeAndModel(a) ?? ""}`.localeCompare(
      `${vehicleTypeLabel(b.vehicleType) ?? "~"} ${makeAndModel(b) ?? ""}`,
    ),
  load: (a, b) => a.capacityKg - b.capacityKg,
  // A truck with no cargo space recorded sorts after the ones that have it.
  space: (a, b) => (a.volumeCapacityM3 ?? Infinity) - (b.volumeCapacityM3 ?? Infinity),
  status: (a, b) => STATUS_ORDER[truckStatus(a)] - STATUS_ORDER[truckStatus(b)],
};

/** Registration (spaces ignored, so "MH12AB" finds "MH 12 AB 4471"), type, make, model and notes match as typed. */
function matches(truck: TruckView, term: string): boolean {
  const squash = (text: string) => text.toLowerCase().replace(/[\s-]/g, "");
  if (squash(truck.registration).includes(squash(term))) return true;
  return [vehicleTypeLabel(truck.vehicleType), truck.make, truck.model, truck.notes]
    .join(" ")
    .toLowerCase()
    .includes(term);
}

const dash = <span className="text-muted-foreground">—</span>;

function StatusBadge({ truck }: { truck: TruckView }) {
  const status = truckStatus(truck);
  if (status === "available") return <Badge variant="success">Available</Badge>;
  if (status === "maintenance") return <Badge variant="warning">In maintenance</Badge>;
  return <Badge>Inactive</Badge>;
}

/** The fleet: what each vehicle is, how much it carries, and whether it can go out. */
export function TrucksPage() {
  const canWrite = useCan("LOGISTICS_WRITE");
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TruckView | null>(null);
  const [removing, setRemoving] = useState<TruckView | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "registration", descending: false });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: masterDataKeys.trucks,
    queryFn: ({ signal }) => listTrucks(signal),
  });

  const deferredSearch = useDeferredValue(search);
  const all = useMemo(() => data ?? [], [data]);

  const counts: Record<Filter, number> = {
    all: all.length,
    available: all.filter((t) => truckStatus(t) === "available").length,
    maintenance: all.filter((t) => truckStatus(t) === "maintenance").length,
    inactive: all.filter((t) => truckStatus(t) === "inactive").length,
  };

  const visible = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    const compare = COMPARE[sort.key];
    return all
      .filter((t) => (filter === "all" || truckStatus(t) === filter) && (!term || matches(t, term)))
      .sort((a, b) => (sort.descending ? -compare(a, b) : compare(a, b)) || a.registration.localeCompare(b.registration));
  }, [all, deferredSearch, filter, sort]);

  const rows = paginate(visible, page, pageSize);
  const filtering = search.trim() !== "" || filter !== "all";
  const columns = canWrite ? 6 : 5;

  const onSort = (key: SortKey) => {
    setSort((current) => nextSort(current, key));
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Trucks"
        description="The fleet that moves stock to and from events."
        actions={
          canWrite ? (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              New truck
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => {
                setFilter(f.id);
                setPage(1);
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === f.id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
              {data ? <span className="tabular ml-1.5 text-muted-foreground">{counts[f.id]}</span> : null}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search registration, type, make or model"
            className="pl-8"
            aria-label="Search trucks"
          />
        </div>
      </div>

      <Card>
        <TableWrapper>
          <Table>
            <THead>
              <tr>
                <SortHeader label="Registration" column="registration" sort={sort} onSort={onSort} />
                <SortHeader label="Vehicle" column="vehicle" sort={sort} onSort={onSort} />
                <SortHeader label="Load" column="load" sort={sort} onSort={onSort} className="text-right" />
                <SortHeader label="Cargo space" column="space" sort={sort} onSort={onSort} className="text-right" />
                <SortHeader label="Status" column="status" sort={sort} onSort={onSort} />
                {canWrite ? (
                  <TH className="text-right">
                    <span className="sr-only">Actions</span>
                  </TH>
                ) : null}
              </tr>
            </THead>
            <TBody>
              {isPending ? <TableSkeleton columns={columns} /> : null}

              {!isPending
                ? rows.map((truck) => {
                    const type = vehicleTypeLabel(truck.vehicleType);
                    const name = makeAndModel(truck);
                    return (
                      <TR key={truck.id} className={cn(truckStatus(truck) === "inactive" && "text-muted-foreground")}>
                        <TD className="font-mono text-xs font-medium">
                          {truck.registration}
                          {truck.notes ? (
                            <span className="block max-w-56 truncate font-sans font-normal text-muted-foreground" title={truck.notes}>
                              {truck.notes}
                            </span>
                          ) : null}
                        </TD>
                        <TD className="text-xs">
                          {type || name ? (
                            <>
                              <span className="font-medium">{type ?? name}</span>
                              {type && name ? <span className="block text-muted-foreground">{name}</span> : null}
                            </>
                          ) : (
                            dash
                          )}
                        </TD>
                        <TD className="text-right tabular">{formatCount(truck.capacityKg)} kg</TD>
                        <TD className="text-right tabular">
                          {truck.volumeCapacityM3 == null ? dash : `${formatCount(truck.volumeCapacityM3)} m³`}
                        </TD>
                        <TD>
                          <StatusBadge truck={truck} />
                        </TD>
                        {canWrite ? (
                          <TD>
                            <RowActions
                              label={truck.registration}
                              onEdit={() => setEditing(truck)}
                              onRemove={() => setRemoving(truck)}
                            />
                          </TD>
                        ) : null}
                      </TR>
                    );
                  })
                : null}
            </TBody>
          </Table>
        </TableWrapper>

        {isError ? (
          <EmptyState
            title="Could not load trucks"
            description={error instanceof Error ? error.message : undefined}
            action={
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        ) : null}

        {!isPending && !isError && !all.length ? (
          <EmptyState
            icon={<Truck />}
            title="No trucks yet"
            description="Add the vehicles you send stock out in."
            action={
              canWrite ? (
                <Button onClick={() => setCreating(true)}>
                  <Plus />
                  New truck
                </Button>
              ) : null
            }
          />
        ) : null}

        {!isPending && !isError && all.length > 0 && visible.length === 0 ? (
          <EmptyState
            title="No truck matches"
            description="Try another word, or clear the filters."
            action={
              filtering ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
                    setPage(1);
                  }}
                >
                  Show all trucks
                </Button>
              ) : undefined
            }
          />
        ) : null}

        {!isPending && !isError ? (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={visible.length}
            noun="trucks"
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        ) : null}
      </Card>

      {creating ? <TruckDialog onClose={() => setCreating(false)} /> : null}
      {editing ? <TruckDialog existing={editing} onClose={() => setEditing(null)} /> : null}
      {removing ? (
        <ConfirmDialog
          title={`Delete ${removing.registration}?`}
          description="It is removed outright. To keep it on record but out of use, cancel and mark it Inactive from Edit instead."
          confirmLabel="Delete truck"
          fallbackError="Could not delete the truck."
          action={() => deleteTruck(removing.id)}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: masterDataKeys.trucks });
            setRemoving(null);
          }}
          onClose={() => setRemoving(null)}
        />
      ) : null}
    </div>
  );
}

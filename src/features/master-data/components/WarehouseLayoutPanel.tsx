"use client";

import { createContext, useContext, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Loader2, MapPin, Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createLocation,
  deleteLocation,
  getLayoutSummary,
  listAllocations,
  listLocations,
  masterDataKeys,
  updateLocation,
} from "@/features/master-data/api";
import {
  CHILD_TYPES,
  LOCATION_TYPE_LABEL,
  type LocationType,
  type StorageLocationView,
  type WarehouseView,
} from "@/features/master-data/types";
import { useCan } from "@/features/auth";
import { ApiError } from "@/services/api-client";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { formatCount, StatTile } from "@/components/ui/stat";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const CODE_SHAPE = /^[A-Za-z0-9]{1,10}$/;

/** One line each, so the person adding a location knows what the kinds are for. */
const KIND_HELP: Record<LocationType, string> = {
  ZONE: "A section of the warehouse, such as a cold room, a yard or a hall.",
  BAY: "An aisle or a bay inside a zone.",
  RACK: "A rack or a shelving unit. It can sit directly in a zone.",
  LEVEL: "A shelf level or a bin, the smallest place stock is kept. It can sit directly in a zone or a bay.",
};

/** What the create / edit dialog is working on. */
type Editing =
  | { mode: "create"; parent: StorageLocationView | null }
  | { mode: "edit"; location: StorageLocationView };

/**
 * "Expand all" and "Collapse all" reach every node, including ones not fetched yet: a node that is shown after the
 * button was pressed starts in the state the button asked for, and a node the user then toggles by hand keeps its own
 * choice until the next press.
 */
const ExpandContext = createContext<{ version: number; open: boolean }>({ version: 0, open: false });

/**
 * A warehouse's layout as a tree: zones as sections, each opening to its bays, racks and levels (a level may be
 * skipped). Only the children of an opened node are fetched, so a large layout is never loaded in one go. Every row
 * says how many units are kept inside it, and opens a list of what is stored there. Typing in the search box swaps
 * the tree for a flat list matching the code or name at any level.
 */
export function WarehouseLayoutPanel({
  warehouse,
  onOpenPlacement,
}: {
  warehouse: WarehouseView;
  /** Shows "Where it is kept" narrowed to this location (and everything inside it). */
  onOpenPlacement?: (location: StorageLocationView) => void;
}) {
  const canWrite = useCan("LOGISTICS_WRITE");
  const queryClient = useQueryClient();
  const layoutKey = masterDataKeys.warehouseLayout(warehouse.id);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState<StorageLocationView | null>(null);
  const [viewing, setViewing] = useState<StorageLocationView | null>(null);
  const [expand, setExpand] = useState({ version: 0, open: false });
  const term = search.trim();

  const summary = useQuery({
    queryKey: [...layoutKey, "summary"],
    queryFn: ({ signal }) => getLayoutSummary(warehouse.id, signal),
  });
  const zones = useQuery({
    queryKey: [...layoutKey, "children", "root"],
    queryFn: ({ signal }) => listLocations(warehouse.id, {}, signal),
    enabled: !term,
  });
  const found = useQuery({
    queryKey: [...layoutKey, "search", term],
    queryFn: ({ signal }) => listLocations(warehouse.id, { q: term, flat: true, size: 50 }, signal),
    enabled: Boolean(term),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: layoutKey });
    queryClient.invalidateQueries({ queryKey: masterDataKeys.warehouses });
  };

  const list = term ? found : zones;
  const s = summary.data;
  const canAdd = canWrite && warehouse.active !== false;
  const handlers: RowHandlers = {
    canWrite,
    onAdd: setEditing,
    onEdit: (l) => setEditing({ mode: "edit", location: l }),
    onRemove: setRemoving,
    onView: setViewing,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Zones" value={s ? formatCount(s.zones) : "–"} />
        <StatTile label="Bays / aisles" value={s ? formatCount(s.bays) : "–"} />
        <StatTile label="Racks" value={s ? formatCount(s.racks) : "–"} />
        <StatTile label="Levels / bins" value={s ? formatCount(s.levels) : "–"} />
        <StatTile label="Units placed" value={s ? formatCount(s.unitsPlaced) : "–"} hint="have a location" />
        <StatTile
          label="Not placed yet"
          value={s ? formatCount(s.unitsUnplaced) : "–"}
          hint="still without a location"
          className={s && s.unitsUnplaced > 0 ? "border-[color-mix(in_srgb,var(--warning)_45%,transparent)]" : undefined}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        The layout says <strong className="font-medium text-foreground">where</strong> stock is kept: zone, then bay or aisle, then
        rack, then level or bin. A level can be skipped (a rack straight in a zone). Open a row to see what is inside it.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find a location by code or name"
            aria-label="Search storage locations"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!term && list.data?.length ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setExpand((e) => ({ version: e.version + 1, open: true }))}>
                <ChevronsUpDown />
                Expand all
              </Button>
              <Button size="sm" variant="outline" onClick={() => setExpand((e) => ({ version: e.version + 1, open: false }))}>
                <ChevronsDownUp />
                Collapse all
              </Button>
            </>
          ) : null}
          {canAdd ? (
            <Button size="sm" onClick={() => setEditing({ mode: "create", parent: null })}>
              <Plus />
              Add zone
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        {list.isPending ? <Skeleton className="h-24" /> : null}
        {list.isError ? (
          <div className="overflow-hidden rounded-md border border-border">
            <EmptyState
              title="Could not load the layout"
              description={list.error instanceof Error ? list.error.message : undefined}
              action={
                <Button variant="outline" onClick={() => list.refetch()}>
                  Try again
                </Button>
              }
            />
          </div>
        ) : null}
        {list.data && !list.data.length ? (
          <div className="overflow-hidden rounded-md border border-border">
            <EmptyState
              icon={<MapPin />}
              title={term ? "No location matches that search" : "No layout yet"}
              description={
                term
                  ? undefined
                  : "This warehouse works without one. Add a zone, then the bays, racks and levels inside it, to record where stock is kept."
              }
              action={
                !term && canAdd ? (
                  <Button onClick={() => setEditing({ mode: "create", parent: null })}>
                    <Plus />
                    Add the first zone
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : null}

        <ExpandContext.Provider value={expand}>
          {term && list.data?.length ? (
            <ul className="overflow-hidden rounded-md border border-border">
              {list.data.map((location) => (
                <li key={location.id} className="border-b border-border last:border-b-0">
                  <LocationRow location={location} flat {...handlers} />
                </li>
              ))}
            </ul>
          ) : null}
          {!term
            ? (list.data ?? []).map((zone) => (
                <ul key={zone.id} className="overflow-hidden rounded-lg border border-border bg-card">
                  <LocationNode warehouse={warehouse} location={zone} {...handlers} />
                </ul>
              ))
            : null}
        </ExpandContext.Provider>
      </div>

      {editing ? (
        <LocationDialog
          warehouse={warehouse}
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            refresh();
            setEditing(null);
          }}
        />
      ) : null}
      {removing ? (
        <ConfirmDialog
          title={`Delete ${removing.fullCode}?`}
          description="Only a location that never had sub-locations or stock can be deleted. Otherwise deactivate it from Edit."
          confirmLabel="Delete location"
          fallbackError="Could not delete the location."
          action={() => deleteLocation(warehouse.id, removing.id)}
          onDone={() => {
            refresh();
            setRemoving(null);
          }}
          onClose={() => setRemoving(null)}
        />
      ) : null}
      {viewing ? (
        <StoredHereDialog
          warehouse={warehouse}
          location={viewing}
          onClose={() => setViewing(null)}
          onOpenPlacement={
            onOpenPlacement
              ? (location) => {
                  setViewing(null);
                  onOpenPlacement(location);
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

interface RowHandlers {
  canWrite: boolean;
  onAdd: (editing: Editing) => void;
  onEdit: (location: StorageLocationView) => void;
  onRemove: (location: StorageLocationView) => void;
  onView: (location: StorageLocationView) => void;
}

/** One node of the tree; its children are fetched only once it is opened. */
function LocationNode({
  warehouse,
  location,
  nested = false,
  ...handlers
}: { warehouse: WarehouseView; location: StorageLocationView; nested?: boolean } & RowHandlers) {
  const expand = useContext(ExpandContext);
  // The user's own toggle counts only until the next Expand all / Collapse all.
  const [manual, setManual] = useState({ version: expand.version, open: expand.version > 0 && expand.open });
  const open = manual.version === expand.version ? manual.open : expand.open;
  const children = useQuery({
    queryKey: [...masterDataKeys.warehouseLayout(warehouse.id), "children", location.id],
    queryFn: ({ signal }) => listLocations(warehouse.id, { parentId: location.id }, signal),
    enabled: open && location.childCount > 0,
  });

  return (
    <li className={cn(nested && "border-t border-border")}>
      <LocationRow
        location={location}

        open={open}
        onToggle={location.childCount > 0 ? () => setManual({ version: expand.version, open: !open }) : undefined}
        {...handlers}
      />
      {open ? (
        <ul className="ml-[1.1rem] border-l border-border/70">
          {children.isPending && location.childCount > 0 ? <Skeleton className="m-2 h-8" /> : null}
          {children.isError ? <li className="px-4 py-2 text-sm text-destructive">Could not load what is inside.</li> : null}
          {(children.data ?? []).map((child) => (
            <LocationNode key={child.id} warehouse={warehouse} location={child} nested {...handlers} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function LocationRow({
  location,
  flat = false,
  open,
  onToggle,
  canWrite,
  onAdd,
  onEdit,
  onRemove,
  onView,
}: {
  location: StorageLocationView;
  flat?: boolean;
  open?: boolean;
  onToggle?: () => void;
} & RowHandlers) {
  const canHaveChildren = CHILD_TYPES[location.type].length > 0;
  const isZone = location.type === "ZONE" && !flat;
  const inside = location.unitsInside;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 text-sm", isZone ? "bg-muted/40 py-3" : "py-2", !location.active && "opacity-70")}>
      <div className="flex min-w-0 flex-1 basis-56 items-center gap-2">
        {flat ? null : onToggle ? (
          <Button
            size="icon"
            variant="ghost"
            className="size-6 shrink-0"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={`${open ? "Collapse" : "Expand"} ${location.fullCode}`}
          >
            {open ? <ChevronDown /> : <ChevronRight />}
          </Button>
        ) : (
          <span className="inline-block size-6 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">{LOCATION_TYPE_LABEL[location.type]}</span>
            <span className={cn("truncate font-medium", isZone && "text-base")}>{location.name}</span>
            {!location.active ? <Badge>Inactive</Badge> : null}
          </p>
          <p className="font-mono text-xs text-muted-foreground">{location.fullCode}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {location.childCount > 0 ? (
          <span title="Places directly inside it">
            {location.childCount} inside
          </span>
        ) : null}
        <span
          className={cn("tabular", inside > 0 ? "font-medium text-foreground" : "")}
          title={
            location.units !== inside
              ? `${inside} kept here and in everything inside it (${location.units} at this level itself)`
              : "Units kept here and in everything inside it"
          }
        >
          {inside > 0 ? `${formatCount(inside)} unit${inside === 1 ? "" : "s"} kept` : "Empty"}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {inside > 0 ? (
          <Button size="sm" variant="ghost" aria-label={`See what is stored in ${location.fullCode}`} onClick={() => onView(location)}>
            <Package />
            <span className="hidden md:inline">What&apos;s here</span>
          </Button>
        ) : null}
        {canWrite ? (
          <>
            {canHaveChildren && location.active ? (
              <Button size="sm" variant="ghost" aria-label={`Add inside ${location.fullCode}`} title="Add a place inside this one" onClick={() => onAdd({ mode: "create", parent: location })}>
                <Plus />
                <span className="hidden md:inline">Add inside</span>
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" aria-label={`Edit ${location.fullCode}`} title="Edit" onClick={() => onEdit(location)}>
              <Pencil />
              <span className="hidden md:inline">Edit</span>
            </Button>
            <Button size="icon" variant="ghost" aria-label={`Delete ${location.fullCode}`} title="Delete" onClick={() => onRemove(location)}>
              <Trash2 />
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** What is kept at a location and everything inside it, from the placements the backend already serves. */
function StoredHereDialog({
  warehouse,
  location,
  onClose,
  onOpenPlacement,
}: {
  warehouse: WarehouseView;
  location: StorageLocationView;
  onClose: () => void;
  onOpenPlacement?: (location: StorageLocationView) => void;
}) {
  const rows = useQuery({
    queryKey: [...masterDataKeys.warehouseAllocations(warehouse.id), "stored-here", location.id],
    queryFn: ({ signal }) => listAllocations(warehouse.id, { locationId: location.id, subtree: true }, signal),
  });
  const total = (rows.data ?? []).reduce((sum, row) => sum + row.quantity, 0);
  // Where exactly, below the place that was opened: the names of the steps after it.
  const below = (row: NonNullable<typeof rows.data>[number]) => {
    const at = row.trail.findIndex((crumb) => crumb.id === location.id);
    const steps = at >= 0 ? row.trail.slice(at + 1) : row.trail;
    return steps.length ? steps.map((crumb) => crumb.name).join(" › ") : "Here itself";
  };
  return (
    <Dialog
      open
      onClose={onClose}
      className="max-w-3xl"
      title={`Stored in ${location.fullCode}`}
      description={`${location.name}. Everything kept here and in everything inside it.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {onOpenPlacement ? (
            <Button onClick={() => onOpenPlacement(location)}>
              <MapPin />
              Open in Where it is kept
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground" role="status">
          {rows.data ? `${rows.data.length} placement${rows.data.length === 1 ? "" : "s"} · ${formatCount(total)} unit${total === 1 ? "" : "s"}` : "Loading…"}
        </p>
        <div className="overflow-hidden rounded-md border border-border">
          <TableWrapper className="max-h-80 overflow-y-auto">
            <Table>
              <THead className="sticky top-0 bg-card">
                <TR className="hover:bg-transparent">
                  <TH>Product</TH>
                  <TH>Exactly where</TH>
                  <TH className="text-right">Units</TH>
                </TR>
              </THead>
              <TBody>
                {rows.isPending ? <TableSkeleton rows={3} columns={3} /> : null}
                {(rows.data ?? []).map((row) => (
                  <TR key={row.id}>
                    <TD>
                      <span className="font-medium">{row.productName}</span>
                      {row.variantName && row.variantName !== "Standard" ? <span className="ml-2 text-muted-foreground">{row.variantName}</span> : null}
                      <span className="block font-mono text-[0.7rem] text-muted-foreground">{row.variantSku ?? row.sku}</span>
                    </TD>
                    <TD className="text-muted-foreground">{below(row)}</TD>
                    <TD className="tabular text-right">{formatCount(row.quantity)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrapper>
          {rows.isError ? (
            <EmptyState
              title="Could not load what is stored here"
              description={rows.error instanceof Error ? rows.error.message : undefined}
              action={
                <Button variant="outline" onClick={() => rows.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : null}
          {rows.data && !rows.data.length ? <EmptyState icon={<Package />} title="Nothing is kept here" /> : null}
        </div>
      </div>
    </Dialog>
  );
}

function LocationDialog({
  warehouse,
  editing,
  onClose,
  onSaved,
}: {
  warehouse: WarehouseView;
  editing: Editing;
  onClose: () => void;
  onSaved: () => void;
}) {
  const existing = editing.mode === "edit" ? editing.location : null;
  const parent = editing.mode === "create" ? editing.parent : null;
  const allowedTypes = CHILD_TYPES[parent ? parent.type : "WAREHOUSE"];
  const [type, setType] = useState<LocationType>(allowedTypes[0] ?? "ZONE");
  const [name, setName] = useState(existing?.name ?? "");
  const [code, setCode] = useState(existing?.code ?? "");
  const [active, setActive] = useState(existing?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  // The server fixes a code once the location has sub-locations or has held stock.
  const codeLocked = Boolean(existing && (existing.childCount > 0 || existing.units > 0));

  const save = useMutation({
    mutationFn: () =>
      existing
        ? updateLocation(warehouse.id, existing.id, {
            name: name.trim(),
            code: codeLocked ? undefined : code.trim(),
            active,
          })
        : createLocation(warehouse.id, {
            type,
            parentId: parent?.id,
            code: code.trim(),
            name: name.trim(),
          }),
    onSuccess: (saved) => {
      toast.success(existing ? `${saved.fullCode} updated` : `${saved.fullCode} added`);
      onSaved();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not save the location."),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Name is required");
    if (!codeLocked && !CODE_SHAPE.test(code.trim())) {
      return setError("The code must be 1 to 10 letters or digits, with no spaces or dashes");
    }
    setError(null);
    save.mutate();
  }

  const prefix = existing
    ? existing.fullCode.slice(0, existing.fullCode.length - existing.code.length)
    : `${parent ? parent.fullCode : (warehouse.code ?? "")}-`;
  const shownType = existing ? existing.type : type;

  return (
    <Dialog
      open
      onClose={onClose}
      title={
        existing
          ? `Edit ${existing.fullCode}`
          : `Add ${LOCATION_TYPE_LABEL[type].toLowerCase()}${parent ? ` in ${parent.fullCode}` : ` to ${warehouse.name}`}`
      }
      description="The code is letters and digits. The full code is built from the codes above it, so a place is always found by one code."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button form="location-form" type="submit" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            {existing ? "Save changes" : "Add"}
          </Button>
        </>
      }
    >
      <form id="location-form" noValidate className="space-y-4" onSubmit={submit}>
        {error ? <Alert tone="error" title={error} /> : null}
        {!existing && allowedTypes.length > 1 ? (
          <Field label="Kind" hint={KIND_HELP[type]}>
            {(props) => (
              <Select {...props} value={type} onChange={(event) => setType(event.target.value as LocationType)}>
                {allowedTypes.map((t) => (
                  <option key={t} value={t}>
                    {LOCATION_TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : (
          <p className="text-xs text-muted-foreground">{KIND_HELP[shownType]}</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Code"
            required
            hint={
              codeLocked
                ? "Fixed: it has places inside it or has held stock."
                : `Full code: ${prefix}${code.trim().toUpperCase() || "…"}`
            }
          >
            {(props) => (
              <Input
                {...props}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                disabled={codeLocked}
                className="uppercase"
                autoFocus={!existing}
              />
            )}
          </Field>
          <Field label="Name" required>
            {(props) => <Input {...props} value={name} onChange={(event) => setName(event.target.value)} />}
          </Field>
        </div>
        {existing ? (
          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[var(--primary)]"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            <span>
              <span className="font-medium">Active</span>
              <span className="block text-xs text-muted-foreground">
                Deactivating also deactivates everything inside, and is refused while stock is placed there.
              </span>
            </span>
          </label>
        ) : null}
      </form>
    </Dialog>
  );
}

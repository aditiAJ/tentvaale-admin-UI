"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ArrowRightLeft, CheckCircle2, Loader2, MapPin, Pencil, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import {
  listAllocations,
  listLocations,
  listWarehouseProducts,
  masterDataKeys,
  moveStock,
  placeStock,
} from "@/features/master-data/api";
import {
  LOCATION_TYPE_LABEL,
  type StockAllocationView,
  type StorageLocationView,
  type WarehouseProductView,
  type WarehouseView,
} from "@/features/master-data/types";
import { unplacedOf } from "@/features/master-data/components/WarehouseStockPanel";
import { useCan } from "@/features/auth";
import { ApiError } from "@/services/api-client";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/skeleton";
import { formatCount } from "@/components/ui/stat";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const lineKey = (line: { productId: string; variantId: string | null }) => `${line.productId}:${line.variantId ?? ""}`;

/** How many unplaced lines the strip lists before "Show all". */
const STRIP_LIMIT = 4;

/** "Cold room › Bay One › Rack One", the names of the steps from the zone down to a placement's location. */
const pathOf = (row: StockAllocationView) =>
  row.trail.length ? row.trail.map((crumb) => crumb.name).join(" › ") : row.locationName;

const variantLabel = (name: string | null | undefined) => (name && name !== "Standard" ? name : null);

/**
 * Where a warehouse keeps its stock, one row per product or variant per location. Three things to do here: see where a
 * product is (search by product, SKU, variant or location code, or narrow to a zone or any place), put stock that has no
 * location yet somewhere (the strip on top lists it), and change or move what is placed. Placing or moving units never
 * changes what the warehouse owns, dispatches or returns; it only records where the units are kept.
 */
export function WarehousePlacementPanel({
  warehouse,
  placeRequest,
  onPlaceRequestHandled,
  filterRequest,
  onFilterRequestHandled,
}: {
  warehouse: WarehouseView;
  /** A stock line the Stock tab sent here: the Place form opens with it already chosen. */
  placeRequest?: WarehouseProductView | null;
  onPlaceRequestHandled?: () => void;
  /** A location the Layout tab sent here: the list opens narrowed to it and everything inside it. */
  filterRequest?: StorageLocationView | null;
  onFilterRequestHandled?: () => void;
}) {
  const canWrite = useCan("LOGISTICS_WRITE");
  const canEdit = canWrite && warehouse.active !== false;
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterLocation, setFilterLocation] = useState<StorageLocationView | null>(filterRequest ?? null);
  const [placing, setPlacing] = useState(Boolean(placeRequest));
  const [initialLine, setInitialLine] = useState<string | null>(placeRequest ? lineKey(placeRequest) : null);
  const [changing, setChanging] = useState<StockAllocationView | null>(null);
  const [moving, setMoving] = useState<StockAllocationView | null>(null);
  const [showAllUnplaced, setShowAllUnplaced] = useState(false);
  const term = search.trim();
  // Requests are used once, when this tab opens; the page forgets them so coming back later does not repeat them.
  useEffect(() => {
    if (placeRequest) onPlaceRequestHandled?.();
    if (filterRequest) onFilterRequestHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useQuery({
    queryKey: [...masterDataKeys.warehouseAllocations(warehouse.id), term, filterLocation?.id ?? ""],
    queryFn: ({ signal }) =>
      listAllocations(warehouse.id, { q: term || undefined, locationId: filterLocation?.id, subtree: true }, signal),
  });
  // The same stock list the Stock tab uses: it says what has no location yet, and feeds the previews.
  const stock = useQuery({
    queryKey: masterDataKeys.warehouseProducts(warehouse.id),
    queryFn: ({ signal }) => listWarehouseProducts(warehouse.id, signal),
  });
  const zones = useQuery({
    queryKey: [...masterDataKeys.warehouseLayout(warehouse.id), "children", "root"],
    queryFn: ({ signal }) => listLocations(warehouse.id, {}, signal),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: masterDataKeys.warehouseAllocations(warehouse.id) });
    queryClient.invalidateQueries({ queryKey: masterDataKeys.warehouseProducts(warehouse.id) });
    queryClient.invalidateQueries({ queryKey: masterDataKeys.warehouseLayout(warehouse.id) });
  };

  const total = useMemo(() => (rows.data ?? []).reduce((sum, row) => sum + row.quantity, 0), [rows.data]);
  const unplaced = useMemo(() => (stock.data ?? []).filter((line) => unplacedOf(line) > 0), [stock.data]);
  const unplacedUnits = unplaced.reduce((sum, line) => sum + unplacedOf(line), 0);
  const lineOf = (row: StockAllocationView) =>
    stock.data?.find((line) => line.productId === row.productId && (line.variantId ?? null) === (row.variantId ?? null));
  const filtering = Boolean(term || filterLocation);

  return (
    <div className="space-y-4">
      {stock.data && stock.data.length > 0 ? (
        <section aria-label="Stock without a location" className="rounded-lg border border-border">
          {unplaced.length === 0 ? (
            <p className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-[var(--success)]" />
              Everything this warehouse owns has a location.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
                <p className="text-sm">
                  <span className="font-medium text-[var(--warning)]">{formatCount(unplacedUnits)} unit{unplacedUnits === 1 ? "" : "s"}</span>{" "}
                  <span className="text-muted-foreground">
                    in {unplaced.length} product line{unplaced.length === 1 ? "" : "s"} have no location yet. They are still
                    available to rent; they just have no recorded shelf.
                  </span>
                </p>
                {unplaced.length > STRIP_LIMIT ? (
                  <Button size="sm" variant="ghost" onClick={() => setShowAllUnplaced((v) => !v)} aria-expanded={showAllUnplaced}>
                    {showAllUnplaced ? "Show fewer" : `Show all ${unplaced.length}`}
                  </Button>
                ) : null}
              </div>
              <ul className="divide-y divide-border">
                {(showAllUnplaced ? unplaced : unplaced.slice(0, STRIP_LIMIT)).map((line) => (
                  <li key={lineKey(line)} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 basis-48">
                      <span className="font-medium">{line.productName}</span>
                      {variantLabel(line.variantName) ? <span className="ml-2 text-muted-foreground">{variantLabel(line.variantName)}</span> : null}
                      {line.sku ? <span className="block font-mono text-[0.7rem] text-muted-foreground">{line.sku}</span> : null}
                    </span>
                    <span className="tabular text-xs text-muted-foreground">
                      <strong className="font-medium text-[var(--warning)]">{formatCount(unplacedOf(line))}</strong> of {formatCount(line.quantity)} not placed
                    </span>
                    {canEdit ? (
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Place ${line.productName}${variantLabel(line.variantName) ? ` ${variantLabel(line.variantName)}` : ""}`}
                        onClick={() => {
                          setInitialLine(lineKey(line));
                          setPlacing(true);
                        }}
                      >
                        <MapPin />
                        Place
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-muted-foreground" role="status">
          {rows.data
            ? `${rows.data.length} placement${rows.data.length === 1 ? "" : "s"} · ${formatCount(total)} unit${total === 1 ? "" : "s"}${filtering ? " shown" : " have a location"}`
            : "Loading…"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Product, SKU, variant or code"
              aria-label="Search placements"
              className="pl-8"
            />
          </div>
          {zones.data && zones.data.length > 0 ? (
            <div className="w-full sm:w-44">
              <Select
                aria-label="Show one zone"
                value={filterLocation?.type === "ZONE" ? filterLocation.id : ""}
                onChange={(event) => setFilterLocation(zones.data.find((z) => z.id === event.target.value) ?? null)}
              >
                <option value="">All zones</option>
                {zones.data.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <div className="w-full sm:w-52">
            {filterLocation ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm">
                <span className="truncate font-mono text-xs" title={filterLocation.name}>
                  {filterLocation.fullCode}
                </span>
                <Button size="icon" variant="ghost" className="size-5" aria-label="Clear the location filter" onClick={() => setFilterLocation(null)}>
                  <X />
                </Button>
              </div>
            ) : (
              <LocationPicker warehouseId={warehouse.id} onPick={setFilterLocation} placeholder="Any place, by code or name" />
            )}
          </div>
          {canEdit ? (
            <Button size="sm" onClick={() => setPlacing(true)}>
              <Plus />
              Place stock
            </Button>
          ) : null}
        </div>
      </div>

      {/* Wide screens: one table. Narrow screens: one card per placement, with the same actions. */}
      <div className="hidden overflow-hidden rounded-md border border-border md:block">
        <TableWrapper>
          <Table>
            <THead>
              <tr>
                <TH>Location</TH>
                <TH>Product</TH>
                <TH className="text-right">Units</TH>
                {canWrite ? <TH className="w-44 text-right"><span className="sr-only">Actions</span></TH> : null}
              </tr>
            </THead>
            <TBody>
              {rows.isPending ? <TableSkeleton rows={4} columns={canWrite ? 4 : 3} /> : null}
              {(rows.data ?? []).map((row) => (
                <TR key={row.id}>
                  <TD>
                    <Where row={row} />
                  </TD>
                  <TD>
                    <WhatIs row={row} />
                  </TD>
                  <TD className="tabular text-right font-medium">{formatCount(row.quantity)}</TD>
                  {canWrite ? (
                    <TD>
                      <RowActions row={row} onChange={setChanging} onMove={setMoving} />
                    </TD>
                  ) : null}
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrapper>
      </div>
      <ul className="space-y-2 md:hidden" aria-label="Placements">
        {(rows.data ?? []).map((row) => (
          <li key={row.id} className="rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <WhatIs row={row} />
              <span className="tabular shrink-0 text-lg font-semibold">
                {formatCount(row.quantity)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">units</span>
              </span>
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <Where row={row} />
              {canWrite ? <RowActions row={row} onChange={setChanging} onMove={setMoving} /> : null}
            </div>
          </li>
        ))}
      </ul>

      {rows.isError ? (
        <div className="overflow-hidden rounded-md border border-border">
          <EmptyState
            title="Could not load the placements"
            description={rows.error instanceof Error ? rows.error.message : undefined}
            action={
              <Button variant="outline" onClick={() => rows.refetch()}>
                Try again
              </Button>
            }
          />
        </div>
      ) : null}
      {rows.data && !rows.data.length ? (
        <div className="overflow-hidden rounded-md border border-border">
          <EmptyState
            icon={<MapPin />}
            title={filtering ? "Nothing placed matches that" : "No stock placed in locations yet"}
            description={
              filtering
                ? undefined
                : "Stock the warehouse owns stays available without a location. Place it to record where it is kept."
            }
            action={
              filtering ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setFilterLocation(null);
                  }}
                >
                  Show everything
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : null}

      {placing ? (
        <PlaceDialog
          warehouse={warehouse}
          initialLineId={initialLine ?? ""}
          onClose={() => {
            setPlacing(false);
            setInitialLine(null);
          }}
          onSaved={() => {
            refresh();
            setPlacing(false);
            setInitialLine(null);
          }}
        />
      ) : null}
      {changing ? (
        <ChangeDialog
          warehouse={warehouse}
          row={changing}
          line={lineOf(changing)}
          onClose={() => setChanging(null)}
          onSaved={() => {
            refresh();
            setChanging(null);
          }}
        />
      ) : null}
      {moving ? (
        <MoveDialog
          warehouse={warehouse}
          row={moving}
          onClose={() => setMoving(null)}
          onSaved={() => {
            refresh();
            setMoving(null);
          }}
        />
      ) : null}
    </div>
  );
}

/** The place, in words first (zone › bay › rack), with its code underneath. */
function Where({ row }: { row: StockAllocationView }) {
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-x-2">
        <span className="font-medium">{pathOf(row)}</span>
        {!row.locationActive ? <Badge>Inactive</Badge> : null}
      </p>
      <p className="font-mono text-xs text-muted-foreground" title={LOCATION_TYPE_LABEL[row.locationType]}>
        {row.locationCode}
      </p>
    </div>
  );
}

/** The product, its variant and its SKU as one thing. */
function WhatIs({ row }: { row: StockAllocationView }) {
  const variant = variantLabel(row.variantName);
  return (
    <div className="min-w-0">
      <p>
        <span className="font-medium">{row.productName}</span>
        {variant ? <span className="ml-2 text-muted-foreground">{variant}</span> : null}
      </p>
      <p className="font-mono text-[0.7rem] text-muted-foreground">{row.variantSku ?? row.sku}</p>
    </div>
  );
}

function RowActions({
  row,
  onChange,
  onMove,
}: {
  row: StockAllocationView;
  onChange: (row: StockAllocationView) => void;
  onMove: (row: StockAllocationView) => void;
}) {
  return (
    <div className="flex justify-end gap-1">
      <Button size="sm" variant="ghost" aria-label={`Change quantity of ${row.productName} at ${row.locationCode}`} title="Change how many are kept here" onClick={() => onChange(row)}>
        <Pencil />
        Change
      </Button>
      <Button size="sm" variant="ghost" aria-label={`Move ${row.productName} from ${row.locationCode}`} title="Move to another location" onClick={() => onMove(row)}>
        <ArrowRightLeft />
        Move
      </Button>
    </div>
  );
}

/** "Before → after" lines, so nobody has to do the sums to know what pressing the button will do. */
function Preview({ lines }: { lines: { label: string; from: React.ReactNode; to: React.ReactNode }[] }) {
  return (
    <div className="space-y-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm" role="status" aria-label="What will happen">
      {lines.map((line) => (
        <p key={line.label} className="flex flex-wrap items-center gap-x-2">
          <span className="text-muted-foreground">{line.label}</span>
          <span className="tabular">{line.from}</span>
          <ArrowRight className="size-3.5 text-muted-foreground" aria-label="becomes" />
          <strong className="tabular font-semibold">{line.to}</strong>
        </p>
      ))}
    </div>
  );
}

/** A type-ahead over the warehouse's locations of every level, fed by the flat search. */
export function LocationPicker({
  warehouseId,
  onPick,
  placeholder = "Search a location by code or name",
  excludeId,
}: {
  warehouseId: string;
  onPick: (location: StorageLocationView) => void;
  placeholder?: string;
  excludeId?: string;
}) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const term = text.trim();
  const results = useQuery({
    queryKey: [...masterDataKeys.warehouseLayout(warehouseId), "picker", term],
    queryFn: ({ signal }) => listLocations(warehouseId, { flat: true, q: term, size: 20 }, signal),
    enabled: focused,
  });
  const shown = (results.data ?? []).filter((l) => l.id !== excludeId);
  return (
    <div className="relative">
      <Input
        value={text}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => setText(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
      />
      {focused ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-full min-w-64 overflow-auto rounded-md border border-border bg-card shadow-md">
          {results.isPending ? <li className="px-3 py-2 text-sm text-muted-foreground">Searching…</li> : null}
          {results.data && !shown.length ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No location found</li>
          ) : null}
          {shown.map((location) => (
            <li key={location.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onPick(location);
                  setText("");
                  setFocused(false);
                }}
              >
                <span>
                  <span className="font-mono text-xs">{location.fullCode}</span>
                  <span className="ml-2">{location.name}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {LOCATION_TYPE_LABEL[location.type]}
                  {location.active ? "" : " · inactive"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function errorText(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

const wholeNumber = (text: string) => (text.trim() !== "" && Number.isInteger(Number(text)) ? Number(text) : null);

/** Picks a stock line the warehouse owns, a location, and how many units to keep there. */
function PlaceDialog({
  warehouse,
  initialLineId = "",
  onClose,
  onSaved,
}: {
  warehouse: WarehouseView;
  /** The stock line to have chosen when the form opens (from a Place button). */
  initialLineId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [lineId, setLineId] = useState(initialLineId);
  const [location, setLocation] = useState<StorageLocationView | null>(null);
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const stock = useQuery({
    queryKey: masterDataKeys.warehouseProducts(warehouse.id),
    queryFn: ({ signal }) => listWarehouseProducts(warehouse.id, signal),
  });
  const line: WarehouseProductView | undefined = stock.data?.find((entry) => lineKey(entry) === lineId);
  const unplaced = line ? unplacedOf(line) : 0;
  // What this line already has at the chosen location, so "Place 3" adds 3 rather than replacing.
  const existing = useQuery({
    queryKey: [...masterDataKeys.warehouseAllocations(warehouse.id), "at", lineId, location?.id ?? ""],
    queryFn: ({ signal }) =>
      listAllocations(warehouse.id, { locationId: location!.id, subtree: false, productId: line!.productId }, signal),
    enabled: Boolean(line && location),
  });
  const existingAt = line
    ? existing.data?.find((row) => (row.variantId ?? "") === (line.variantId ?? ""))?.quantity ?? 0
    : 0;
  const n = wholeNumber(quantity);
  const valid = n !== null && n >= 1 && n <= unplaced;

  const save = useMutation({
    mutationFn: () =>
      // The call sets the number kept at the location, so add to what is already there.
      placeStock(warehouse.id, {
        productId: line!.productId,
        variantId: line!.variantId ?? undefined,
        locationId: location!.id,
        quantity: Number(quantity) + existingAt,
      }),
    onSuccess: () => {
      toast.success(`Placed ${quantity} at ${location?.fullCode}`);
      onSaved();
    },
    onError: (e) => setError(errorText(e, "Could not place the stock.")),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!line) return setError("Choose a product");
    if (!location) return setError("Choose a location");
    if (n === null || n < 1) return setError("Enter a whole number of at least 1");
    if (n > unplaced) return setError(`Only ${unplaced} of this are not placed yet`);
    setError(null);
    save.mutate();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Place stock"
      description={`Say where some of what ${warehouse.name} owns is kept.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button form="place-form" type="submit" disabled={save.isPending || existing.isFetching}>
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            Place
          </Button>
        </>
      }
    >
      <form id="place-form" noValidate className="space-y-4" onSubmit={submit}>
        {error ? <Alert tone="error" title={error} /> : null}
        <Field label="Product" required>
          {(props) => (
            <Select {...props} value={lineId} onChange={(event) => setLineId(event.target.value)}>
              <option value="">{stock.isPending ? "Loading stock" : "Choose what to place"}</option>
              {(stock.data ?? []).map((entry) => (
                <option key={lineKey(entry)} value={lineKey(entry)} disabled={unplacedOf(entry) <= 0}>
                  {entry.productName}
                  {variantLabel(entry.variantName) ? ` · ${variantLabel(entry.variantName)}` : ""}
                  {entry.sku ? ` (${entry.sku})` : ""} — {unplacedOf(entry)} of {entry.quantity} not placed
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Location" required hint={location ? undefined : "Active places in this warehouse, at any level."}>
          {() =>
            location ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <span>
                  <span className="font-mono text-xs">{location.fullCode}</span>
                  <span className="ml-2">{location.name}</span>
                </span>
                <Button type="button" size="sm" variant="ghost" onClick={() => setLocation(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <LocationPicker
                warehouseId={warehouse.id}
                onPick={(picked) => (picked.active ? setLocation(picked) : setError("That location is inactive"))}
              />
            )
          }
        </Field>
        <Field
          label="Quantity"
          required
          hint={line ? `${unplaced} of ${line.quantity} not placed yet${existingAt ? `; ${existingAt} already kept at this location` : ""}` : undefined}
        >
          {(props) => (
            <Input {...props} value={quantity} inputMode="numeric" className="tabular" onChange={(event) => setQuantity(event.target.value)} />
          )}
        </Field>
        {/* Only once what is already kept there is known: a preview with a guessed "before" would mislead. */}
        {line && location && valid && existing.isSuccess && !existing.isFetching ? (
          <Preview
            lines={[
              { label: `Kept at ${location.fullCode}`, from: existingAt, to: existingAt + (n as number) },
              { label: "Not placed yet", from: unplaced, to: unplaced - (n as number) },
            ]}
          />
        ) : null}
      </form>
    </Dialog>
  );
}

/** Sets the number kept at one location; 0 removes the placement. */
function ChangeDialog({
  warehouse,
  row,
  line,
  onClose,
  onSaved,
}: {
  warehouse: WarehouseView;
  row: StockAllocationView;
  /** The warehouse's stock line for this product, when loaded: it says how many are not placed yet. */
  line?: WarehouseProductView;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [quantity, setQuantity] = useState(String(row.quantity));
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () =>
      placeStock(warehouse.id, {
        productId: row.productId,
        variantId: row.variantId ?? undefined,
        locationId: row.locationId,
        quantity: Number(quantity),
      }),
    onSuccess: () => {
      toast.success(Number(quantity) === 0 ? "Placement removed" : "Quantity changed");
      onSaved();
    },
    onError: (e) => setError(errorText(e, "Could not change the quantity.")),
  });
  const n = wholeNumber(quantity);
  const now = line ? unplacedOf(line) : null;
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${row.productName} at ${row.locationCode}`}
      description="How many are kept at this location. 0 removes the placement. It cannot push the total placed above what the warehouse owns."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button form="change-form" type="submit" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            Save
          </Button>
        </>
      }
    >
      <form
        id="change-form"
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (n === null || n < 0) return setError("Enter a whole number, 0 or more");
          setError(null);
          save.mutate();
        }}
      >
        {error ? <Alert tone="error" title={error} /> : null}
        <Field label="Quantity kept here" required>
          {(props) => (
            <Input {...props} value={quantity} inputMode="numeric" className="tabular" autoFocus onChange={(event) => setQuantity(event.target.value)} />
          )}
        </Field>
        {n !== null && n >= 0 && n !== row.quantity ? (
          <Preview
            lines={[
              { label: `Kept at ${row.locationCode}`, from: row.quantity, to: n },
              ...(now !== null ? [{ label: "Not placed yet", from: now, to: Math.max(now + row.quantity - n, 0) }] : []),
            ]}
          />
        ) : null}
      </form>
    </Dialog>
  );
}

/** Moves some or all of a placement to another location of the same warehouse. */
function MoveDialog({
  warehouse,
  row,
  onClose,
  onSaved,
}: {
  warehouse: WarehouseView;
  row: StockAllocationView;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [target, setTarget] = useState<StorageLocationView | null>(null);
  const [quantity, setQuantity] = useState(String(row.quantity));
  const [error, setError] = useState<string | null>(null);
  // What the target already holds of this line, to say what it will hold afterwards.
  const atTarget = useQuery({
    queryKey: [...masterDataKeys.warehouseAllocations(warehouse.id), "at", lineKey(row), target?.id ?? ""],
    queryFn: ({ signal }) => listAllocations(warehouse.id, { locationId: target!.id, subtree: false, productId: row.productId }, signal),
    enabled: Boolean(target),
  });
  const targetHolds = atTarget.data?.find((r) => (r.variantId ?? "") === (row.variantId ?? ""))?.quantity ?? 0;
  const save = useMutation({
    mutationFn: () =>
      moveStock(warehouse.id, {
        productId: row.productId,
        variantId: row.variantId ?? undefined,
        fromLocationId: row.locationId,
        toLocationId: target!.id,
        quantity: Number(quantity),
      }),
    onSuccess: () => {
      toast.success(`Moved ${quantity} to ${target?.fullCode}`);
      onSaved();
    },
    onError: (e) => setError(errorText(e, "Could not move the stock.")),
  });
  const n = wholeNumber(quantity);
  const valid = n !== null && n >= 1 && n <= row.quantity;
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Move ${row.productName}`}
      description={`From ${row.locationCode}. Only the place changes: the warehouse total stays the same and no stock movement is recorded.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button form="move-form" type="submit" disabled={save.isPending || atTarget.isFetching}>
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            Move
          </Button>
        </>
      }
    >
      <form
        id="move-form"
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!target) return setError("Choose where to move it");
          if (!valid) return setError(`Enter a whole number from 1 to ${row.quantity}`);
          setError(null);
          save.mutate();
        }}
      >
        {error ? <Alert tone="error" title={error} /> : null}
        <Field label="Move to" required>
          {() =>
            target ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <span>
                  <span className="font-mono text-xs">{target.fullCode}</span>
                  <span className="ml-2">{target.name}</span>
                </span>
                <Button type="button" size="sm" variant="ghost" onClick={() => setTarget(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <LocationPicker
                warehouseId={warehouse.id}
                excludeId={row.locationId}
                onPick={(picked) => (picked.active ? setTarget(picked) : setError("That location is inactive"))}
              />
            )
          }
        </Field>
        <Field label="How many" required hint={`${row.quantity} kept at ${row.locationCode}`}>
          {(props) => (
            <Input {...props} value={quantity} inputMode="numeric" className="tabular" onChange={(event) => setQuantity(event.target.value)} />
          )}
        </Field>
        {target && valid && atTarget.isSuccess && !atTarget.isFetching ? (
          <Preview
            lines={[
              { label: `Kept at ${row.locationCode}`, from: row.quantity, to: row.quantity - (n as number) },
              { label: `Kept at ${target.fullCode}`, from: targetHolds, to: targetHolds + (n as number) },
            ]}
          />
        ) : null}
      </form>
    </Dialog>
  );
}

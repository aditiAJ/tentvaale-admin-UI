"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, MapPin, Package, Pencil, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import {
  addProductToWarehouse,
  listProducts,
  listWarehouseProducts,
  masterDataKeys,
} from "@/features/master-data/api";
import type { WarehouseProductView, WarehouseView } from "@/features/master-data/types";
import { useCan } from "@/features/auth";
import { ApiError } from "@/services/api-client";
import { positiveIntegerField } from "@/lib/forms";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/skeleton";
import { formatCount, StatTile } from "@/components/ui/stat";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const schema = z.object({
  productId: z.string().min(1, "Choose a product"),
  // "" for a product without variants; whether one is needed depends on the chosen product.
  variantId: z.string(),
  quantity: positiveIntegerField("Quantity"),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const keyOf = (entry: Pick<WarehouseProductView, "productId" | "variantId">) =>
  `${entry.productId}:${entry.variantId ?? ""}`;

/** Units of a line that have no location yet: what the warehouse owns minus what is placed. Never below 0. */
export const unplacedOf = (entry: Pick<WarehouseProductView, "quantity" | "placed">) =>
  Math.max(entry.quantity - (entry.placed ?? 0), 0);

type Filter = "all" | "open" | "done";

const FILTERS: { id: Filter; label: string; keep: (entry: WarehouseProductView) => boolean }[] = [
  { id: "all", label: "All", keep: () => true },
  { id: "open", label: "Not fully placed", keep: (entry) => unplacedOf(entry) > 0 },
  { id: "done", label: "Fully placed", keep: (entry) => entry.quantity > 0 && unplacedOf(entry) === 0 },
];

/**
 * What one warehouse holds, shown in the page itself (no dialog): the four numbers that matter, a search box and
 * filters, the stock table, and an "add stock" form. Three numbers per line, kept apart on purpose:
 *   In stock       what the warehouse owns (the number an admin sets),
 *   Placed         the part of it given a location in the Layout,
 *   Not placed yet what is left (In stock minus Placed), worked out here, never stored.
 * A product added here appears in the table at once, from the server's own answer, and its row is highlighted for a
 * moment. Setting a quantity replaces what was held (the backend's rule), so editing a row sends the same call; the
 * server refuses a number below what is already placed.
 */
export function WarehouseStockPanel({
  warehouse,
  adding,
  onCloseAdd,
  onPlace,
}: {
  warehouse: WarehouseView;
  /** The add form is hidden until the page's "Add product" button opens it. */
  adding: boolean;
  onCloseAdd: () => void;
  /** Opens "Where it is kept" with this line ready to place. */
  onPlace?: (entry: WarehouseProductView) => void;
}) {
  const canWrite = useCan("LOGISTICS_WRITE");
  const queryClient = useQueryClient();
  const stockKey = masterDataKeys.warehouseProducts(warehouse.id);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [formError, setFormError] = useState<string | null>(null);
  const [justSet, setJustSet] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState("");

  const holdings = useQuery({ queryKey: stockKey, queryFn: ({ signal }) => listWarehouseProducts(warehouse.id, signal) });
  const products = useQuery({
    queryKey: masterDataKeys.products,
    queryFn: ({ signal }) => listProducts(signal),
    enabled: canWrite && adding,
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { productId: "", variantId: "", quantity: "" },
  });

  // The highlight is a nudge, not state worth keeping.
  useEffect(() => {
    if (!justSet) return;
    const timer = setTimeout(() => setJustSet(null), 3500);
    return () => clearTimeout(timer);
  }, [justSet]);

  const save = useMutation({
    mutationFn: (values: { productId: string; variantId?: string; quantity: number }) =>
      addProductToWarehouse(warehouse.id, values),
    onSuccess: (entry) => {
      // Show the server's answer straight away, then let a refetch confirm it.
      queryClient.setQueryData<WarehouseProductView[]>(stockKey, (current) => {
        const rest = (current ?? []).filter((row) => keyOf(row) !== keyOf(entry));
        return [...rest, entry].sort((a, b) =>
          `${a.productName} ${a.variantName ?? ""}`.localeCompare(`${b.productName} ${b.variantName ?? ""}`),
        );
      });
      queryClient.invalidateQueries({ queryKey: stockKey });
      queryClient.invalidateQueries({ queryKey: masterDataKeys.products });
      // The layout's "not placed yet" count and the placements follow the stock.
      queryClient.invalidateQueries({ queryKey: masterDataKeys.warehouseLayout(warehouse.id) });
      setJustSet(keyOf(entry));
      const label = entry.variantName ? `${entry.productName} (${entry.variantName})` : entry.productName;
      toast.success(`${label} now ${entry.quantity} in ${warehouse.name}`);
    },
  });

  const selected = useWatch({ control, name: "productId" });
  const selectedVariant = useWatch({ control, name: "variantId" });
  const selectedProduct = products.data?.find((product) => product.id === selected);
  const needsVariant = Boolean(selectedProduct?.hasVariants);
  const alreadyHeld = holdings.data?.find(
    (entry) => entry.productId === selected && (entry.variantId ?? "") === (needsVariant ? selectedVariant : ""),
  );

  const all = useMemo(() => holdings.data ?? [], [holdings.data]);
  const keep = FILTERS.find((f) => f.id === filter)?.keep ?? FILTERS[0].keep;
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter(
      (entry) =>
        keep(entry) && (!term || `${entry.productName} ${entry.variantName ?? ""} ${entry.sku ?? ""}`.toLowerCase().includes(term)),
    );
  }, [all, search, keep]);

  const totalUnits = all.reduce((sum, entry) => sum + entry.quantity, 0);
  const totalPlaced = all.reduce((sum, entry) => sum + Math.min(entry.placed ?? 0, entry.quantity), 0);
  const totalUnplaced = all.reduce((sum, entry) => sum + unplacedOf(entry), 0);
  const productCount = new Set(all.map((entry) => entry.productId)).size;
  const counts: Record<Filter, number> = {
    all: all.length,
    open: all.filter(FILTERS[1].keep).length,
    done: all.filter(FILTERS[2].keep).length,
  };
  const loaded = Boolean(holdings.data);

  // A product's lines together: stock is held per variant, so the product itself is the total of its variants.
  const groups = useMemo(() => {
    const byProduct = new Map<string, WarehouseProductView[]>();
    for (const entry of rows) byProduct.set(entry.productId, [...(byProduct.get(entry.productId) ?? []), entry]);
    return [...byProduct.values()];
  }, [rows]);

  const commitEdit = (entry: WarehouseProductView) => {
    const quantity = Number(editQuantity);
    if (editQuantity.trim() === "" || !Number.isInteger(quantity) || quantity < 0) {
      toast.error("Enter a whole number, 0 or more");
      return;
    }
    save.mutate(
      { productId: entry.productId, variantId: entry.variantId ?? undefined, quantity },
      {
        onSuccess: () => setEditingKey(null),
        // e.g. "…of these units are placed in storage locations…; move them out first"
        onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not change the quantity."),
      },
    );
  };

  /** The "Not placed yet" figure: a plain number to act on, a calm "All placed", or a dash when nothing is in stock. */
  const unplacedCell = (unplaced: number, quantity: number) => {
    if (quantity === 0) return <span className="text-muted-foreground">–</span>;
    if (unplaced === 0) return <Badge variant="success">All placed</Badge>;
    return <span className="font-medium text-[var(--warning)]">{formatCount(unplaced)}</span>;
  };

  const renderLine = (entry: WarehouseProductView, indented: boolean) => {
    const key = keyOf(entry);
    const editing = editingKey === key;
    const unplaced = unplacedOf(entry);
    const variant = entry.variantName && entry.variantName !== "Standard" ? entry.variantName : null;
    return (
      <TR
        key={key}
        className={
          justSet === key
            ? "bg-[color-mix(in_srgb,var(--success)_14%,transparent)] transition-colors"
            : "transition-colors"
        }
      >
        <TD>
          {indented ? (
            <span className="pl-5 text-muted-foreground">{variant ?? "Main product"}</span>
          ) : (
            <>
              <span className="font-medium">{entry.productName}</span>
              {variant ? <span className="ml-2 text-muted-foreground">{variant}</span> : null}
            </>
          )}
          {entry.sku ? <span className="block font-mono text-[0.7rem] text-muted-foreground">{entry.sku}</span> : null}
          {/* On a phone the Placed column is hidden; its number is kept here. */}
          <span className="block text-xs text-muted-foreground sm:hidden">Placed {formatCount(Math.min(entry.placed ?? 0, entry.quantity))}</span>
        </TD>
        <TD className="tabular text-right">
          {editing ? (
            <Input
              autoFocus
              value={editQuantity}
              inputMode="numeric"
              aria-label={`New quantity in stock for ${entry.productName}${variant ? ` ${variant}` : ""}`}
              className="tabular ml-auto h-8 w-24 text-right"
              onChange={(event) => setEditQuantity(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitEdit(entry);
                if (event.key === "Escape") setEditingKey(null);
              }}
            />
          ) : (
            formatCount(entry.quantity)
          )}
        </TD>
        <TD className="tabular hidden text-right text-muted-foreground sm:table-cell">
          {entry.placed === undefined ? "–" : formatCount(Math.min(entry.placed, entry.quantity))}
        </TD>
        <TD className="tabular text-right">{entry.placed === undefined ? "–" : unplacedCell(unplaced, entry.quantity)}</TD>
        {canWrite ? (
          <TD>
            <div className="flex justify-end gap-1">
              {editing ? (
                <>
                  <Button size="sm" variant="ghost" aria-label="Save quantity" disabled={save.isPending} onClick={() => commitEdit(entry)}>
                    <Check />
                  </Button>
                  <Button size="sm" variant="ghost" aria-label="Cancel" onClick={() => setEditingKey(null)}>
                    <X />
                  </Button>
                </>
              ) : (
                <>
                  {onPlace && warehouse.active !== false && unplaced > 0 ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Place ${entry.productName}${variant ? ` ${variant}` : ""}`}
                      title={`Say where the ${formatCount(unplaced)} not placed yet are kept`}
                      onClick={() => onPlace(entry)}
                    >
                      <MapPin />
                      <span className="hidden md:inline">Place</span>
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Change quantity in stock of ${entry.productName}${variant ? ` ${variant}` : ""}`}
                    title="Change how many are in stock"
                    onClick={() => {
                      setEditingKey(key);
                      setEditQuantity(String(entry.quantity));
                    }}
                  >
                    <Pencil />
                  </Button>
                </>
              )}
            </div>
          </TD>
        ) : null}
      </TR>
    );
  };

  return (
    <div className="space-y-4">
      {canWrite && adding ? (
        <form
          noValidate
          className="rounded-lg border border-border p-3"
          onSubmit={handleSubmit((values) => {
            if (needsVariant && !values.variantId) {
              setError("variantId", { message: "Choose a variant" });
              return;
            }
            setFormError(null);
            save.mutate(
              { productId: values.productId, variantId: values.variantId || undefined, quantity: values.quantity },
              {
                onSuccess: () => reset(),
                onError: (error) =>
                  setFormError(error instanceof ApiError ? error.message : "Could not add the product."),
              },
            );
          })}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Add a product to {warehouse.name}</p>
            <Button type="button" size="sm" variant="ghost" onClick={onCloseAdd} aria-label="Close the add form">
              <X />
            </Button>
          </div>
          {formError ? <Alert tone="error" title={formError} className="mb-2" /> : null}
          <div className="grid gap-3 sm:grid-cols-[2fr_1.4fr_1fr_auto] sm:items-start">
            <Field label="Product" error={errors.productId?.message}>
              {(props) => (
                <Select
                  {...props}
                  {...register("productId", { onChange: () => setValue("variantId", "") })}
                  disabled={products.isPending}
                >
                  <option value="">{products.isPending ? "Loading catalogue" : "Choose a product"}</option>
                  {(products.data ?? []).map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field
              label="Variant"
              error={errors.variantId?.message}
              hint={needsVariant && !selectedProduct?.variants.length ? "No variants yet. Add them in Products." : undefined}
            >
              {(props) => (
                <Select {...props} {...register("variantId")} disabled={!needsVariant || !selectedProduct?.variants.length}>
                  <option value="">{needsVariant ? "Choose a variant" : "Not needed"}</option>
                  {(selectedProduct?.variants ?? []).map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field
              label="Quantity in stock"
              error={errors.quantity?.message}
              hint={alreadyHeld ? `Holds ${alreadyHeld.quantity}; this replaces it` : undefined}
            >
              {(props) => <Input {...props} {...register("quantity")} inputMode="numeric" placeholder="1" className="tabular" />}
            </Field>
            <div className="sm:pt-[1.375rem]">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                Add
              </Button>
            </div>
          </div>
        </form>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Products" value={loaded ? formatCount(productCount) : "–"} hint="kept in this warehouse" />
        <StatTile label="In stock" value={loaded ? formatCount(totalUnits) : "–"} hint="units this warehouse owns" />
        <StatTile label="Placed" value={loaded ? formatCount(totalPlaced) : "–"} hint="units with a location" />
        <StatTile
          label="Not placed yet"
          value={loaded ? formatCount(totalUnplaced) : "–"}
          hint={loaded && totalUnplaced === 0 ? "everything has a location" : "units still without a location"}
          className={loaded && totalUnplaced > 0 ? "border-[color-mix(in_srgb,var(--warning)_45%,transparent)]" : undefined}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        <strong className="font-medium text-foreground">In stock</strong> is what the warehouse owns.{" "}
        <strong className="font-medium text-foreground">Placed</strong> is the part given a location in the Layout.{" "}
        <strong className="font-medium text-foreground">Not placed yet</strong> is the rest. It is still available to
        rent; it just has no recorded shelf.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === f.id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
              {loaded ? <span className="tabular ml-1.5 text-muted-foreground">{counts[f.id]}</span> : null}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Product, variant or SKU"
            aria-label="Search products in this warehouse"
            className="pl-8"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        <TableWrapper>
          <Table>
            <THead>
              <tr>
                <TH>Product</TH>
                <TH className="text-right" title="Units this warehouse owns">In stock</TH>
                <TH className="hidden text-right sm:table-cell" title="Units given a location in the Layout">Placed</TH>
                <TH className="text-right" title="In stock minus Placed">Not placed yet</TH>
                {canWrite ? <TH className="w-28 text-right"><span className="sr-only">Actions</span></TH> : null}
              </tr>
            </THead>
            <TBody>
              {holdings.isPending ? <TableSkeleton rows={4} columns={canWrite ? 5 : 4} /> : null}
              {groups.map((lines) => {
                const grouped = lines.length > 1;
                const first = lines[0];
                const sum = (pick: (line: WarehouseProductView) => number) => lines.reduce((total, line) => total + pick(line), 0);
                return (
                  <Fragment key={first.productId}>
                    {grouped ? (
                      <TR className="bg-muted/40">
                        <TD>
                          <span className="font-medium">{first.productName}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{lines.length} variants</span>
                        </TD>
                        <TD className="tabular text-right font-medium">{formatCount(sum((line) => line.quantity))}</TD>
                        <TD className="tabular hidden text-right font-medium text-muted-foreground sm:table-cell">
                          {formatCount(sum((line) => Math.min(line.placed ?? 0, line.quantity)))}
                        </TD>
                        <TD className="tabular text-right">{unplacedCell(sum(unplacedOf), sum((line) => line.quantity))}</TD>
                        {canWrite ? <TD /> : null}
                      </TR>
                    ) : null}
                    {lines.map((entry) => renderLine(entry, grouped))}
                  </Fragment>
                );
              })}
            </TBody>
          </Table>
        </TableWrapper>

        {holdings.isError ? (
          <EmptyState
            title="Could not load this warehouse's products"
            description={holdings.error instanceof Error ? holdings.error.message : undefined}
            action={
              <Button variant="outline" onClick={() => holdings.refetch()}>
                Try again
              </Button>
            }
          />
        ) : null}
        {holdings.data && !holdings.data.length ? (
          <EmptyState icon={<Package />} title="No products in this warehouse yet" description={canWrite ? "Use Add product to add the first one." : undefined} />
        ) : null}
        {holdings.data && holdings.data.length > 0 && rows.length === 0 ? (
          <EmptyState
            title={search.trim() ? "No product matches that search" : "Nothing in this view"}
            action={
              filter !== "all" || search ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilter("all");
                    setSearch("");
                  }}
                >
                  Show everything
                </Button>
              ) : undefined
            }
          />
        ) : null}
      </div>
    </div>
  );
}

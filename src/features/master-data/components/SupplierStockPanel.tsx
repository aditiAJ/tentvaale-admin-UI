"use client";

import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCheck, FileUp, Loader2, Package, Pencil, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import {
  listProducts,
  listSupplierStock,
  masterDataKeys,
  setSupplierStock,
} from "@/features/master-data/api";
import type { SupplierStockView, SupplierView } from "@/features/master-data/types";
import { SupplierStockImportDialog } from "@/features/master-data/components/SupplierStockImportDialog";
import { confirmedLabel, STALE_AFTER_DAYS } from "@/features/master-data/supplierUtils";
import { choosableVariants } from "@/features/master-data/variants";
import { useCan } from "@/features/auth";
import { ApiError } from "@/services/api-client";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { Pagination, paginate } from "@/components/ui/pagination";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { TableSkeleton } from "@/components/ui/skeleton";
import { formatCount } from "@/components/ui/stat";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const rateText = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d+(\.\d{1,2})?$/.test(value), "Enter an amount like 125 or 125.50");

const schema = z.object({
  productId: z.string().min(1, "Choose a product"),
  // "" for a product without variants; whether one is needed depends on the product, so it is checked on submit.
  variantId: z.string(),
  // Unlike a warehouse top-up, zero is a real answer here: the supplier has none right now.
  quantity: z
    .string()
    .trim()
    .min(1, "Quantity is required")
    .regex(/^\d+$/, "Whole numbers only")
    .transform(Number),
  rate: rateText,
  reason: z.string().trim().max(200, "Maximum 200 characters"),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const keyOf = (line: Pick<SupplierStockView, "productId" | "variantId">) => `${line.productId}:${line.variantId ?? ""}`;

type Filter = "all" | "available" | "none" | "stale";

const FILTERS: { id: Filter; label: string; keep: (line: SupplierStockView) => boolean }[] = [
  { id: "all", label: "All", keep: () => true },
  { id: "available", label: "Available", keep: (line) => line.quantity > 0 },
  { id: "none", label: "None right now", keep: (line) => line.quantity === 0 },
  { id: "stale", label: `Not confirmed in ${STALE_AFTER_DAYS}+ days`, keep: (line) => confirmedLabel(line.confirmedAt).stale },
];

const labelOf = (line: Pick<SupplierStockView, "productName" | "variantName">) =>
  line.variantName && line.variantName !== "Standard" ? `${line.productName} (${line.variantName})` : line.productName;

/**
 * What one supplier can provide: a count and a price per unit for each item, how long ago the supplier last confirmed
 * it, and the tools to keep that fresh. The count is SET, not added to (entering 30 where the table says 50 leaves 30).
 * Supplier stock is kept apart from owned stock and is never shown on the storefront.
 */
export function SupplierStockPanel({ supplier }: { supplier: SupplierView }) {
  const canWrite = useCan("LOGISTICS_WRITE");
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [justSet, setJustSet] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editRate, setEditRate] = useState("");
  const [editReason, setEditReason] = useState("");

  const stockKey = masterDataKeys.supplierStock(supplier.id);
  const holdings = useQuery({ queryKey: stockKey, queryFn: ({ signal }) => listSupplierStock(supplier.id, signal) });
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
    defaultValues: { productId: "", variantId: "", quantity: "", rate: "", reason: "" },
  });

  const save = useMutation({
    mutationFn: (values: { productId: string; variantId?: string; quantity: number; rate?: number; reason?: string }) =>
      setSupplierStock(supplier.id, values),
    onSuccess: (entry) => {
      // Show the server's answer straight away, then let a refetch confirm it.
      queryClient.setQueryData<SupplierStockView[]>(stockKey, (current) => {
        const rest = (current ?? []).filter((row) => keyOf(row) !== keyOf(entry));
        return [...rest, entry].sort((a, b) => labelOf(a).localeCompare(labelOf(b)));
      });
      // The list's product and unit counts, this supplier's history and a product's stock figures all follow.
      queryClient.invalidateQueries({ queryKey: masterDataKeys.suppliers });
      queryClient.invalidateQueries({ queryKey: masterDataKeys.products });
      setJustSet(keyOf(entry));
      setTimeout(() => setJustSet((current) => (current === keyOf(entry) ? null : current)), 3500);
    },
  });

  const selected = useWatch({ control, name: "productId" });
  const selectedVariant = useWatch({ control, name: "variantId" });
  const selectedProduct = products.data?.find((product) => product.id === selected);
  const needsVariant = Boolean(selectedProduct?.hasVariants);
  const variantChoices = selectedProduct ? choosableVariants(selectedProduct) : [];
  const alreadyHeld = holdings.data?.find(
    (line) => line.productId === selected && (line.variantId ?? "") === (needsVariant ? selectedVariant : ""),
  );

  const productOptions = useMemo<SearchSelectOption[]>(
    () =>
      (products.data ?? [])
        .filter((product) => product.active !== false)
        .map((product) => ({
          value: product.id,
          label: product.name,
          hint: product.sku,
          keywords: [product.sku, ...product.variants.map((variant) => variant.sku ?? "")].join(" "),
        })),
    [products.data],
  );

  const all = useMemo(() => holdings.data ?? [], [holdings.data]);
  const loaded = Boolean(holdings.data);
  const keep = FILTERS.find((f) => f.id === filter)?.keep ?? FILTERS[0].keep;
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter(
      (line) => keep(line) && (!term || `${line.productName} ${line.variantName ?? ""} ${line.sku ?? ""}`.toLowerCase().includes(term)),
    );
  }, [all, search, keep]);
  const pageRows = paginate(rows, page, pageSize);

  const counts: Record<Filter, number> = {
    all: all.length,
    available: all.filter(FILTERS[1].keep).length,
    none: all.filter(FILTERS[2].keep).length,
    stale: all.filter(FILTERS[3].keep).length,
  };

  const commitEdit = (line: SupplierStockView) => {
    const quantity = Number(editQuantity);
    if (editQuantity.trim() === "" || !Number.isInteger(quantity) || quantity < 0) {
      toast.error("Enter a whole number, 0 or more");
      return;
    }
    if (editRate.trim() !== "" && !/^\d+(\.\d{1,2})?$/.test(editRate.trim())) {
      toast.error("Enter a rate like 125 or 125.50");
      return;
    }
    save.mutate(
      {
        productId: line.productId,
        variantId: line.variantId ?? undefined,
        quantity,
        rate: editRate.trim() === "" ? undefined : Number(editRate),
        reason: editReason.trim() || undefined,
      },
      {
        onSuccess: () => {
          setEditingKey(null);
          toast.success(`${labelOf(line)}: ${quantity} available`);
        },
        onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not change the stock."),
      },
    );
  };

  /** "Still correct": asks nothing new, only records that the supplier has just confirmed the same numbers. */
  const reconfirm = (line: SupplierStockView) =>
    save.mutate(
      { productId: line.productId, variantId: line.variantId ?? undefined, quantity: line.quantity },
      {
        onSuccess: () => toast.success(`${labelOf(line)} confirmed as it is`),
        onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not confirm the stock."),
      },
    );

  return (
    <div className="space-y-4">
      {canWrite ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => setImporting(true)}>
            <FileUp />
            Import list
          </Button>
          <Button onClick={() => setAdding((open) => !open)} aria-expanded={adding}>
            <Plus />
            Add item
          </Button>
        </div>
      ) : null}

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
              {
                productId: values.productId,
                variantId: values.variantId || undefined,
                quantity: values.quantity,
                rate: values.rate === "" ? undefined : Number(values.rate),
                reason: values.reason || undefined,
              },
              {
                onSuccess: (entry) => {
                  toast.success(`${supplier.name} can provide ${entry.quantity} × ${labelOf(entry)}`);
                  reset();
                },
                onError: (error) =>
                  setFormError(error instanceof ApiError ? error.message : "Could not save the stock."),
              },
            );
          })}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Set what {supplier.name} can provide</p>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)} aria-label="Close the form">
              <X />
            </Button>
          </div>
          {formError ? <Alert tone="error" title={formError} className="mb-2" /> : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.4fr_1fr_1fr]">
            <Field label="Product" required error={errors.productId?.message}>
              {(props) => (
                <Controller
                  control={control}
                  name="productId"
                  render={({ field }) => (
                    <SearchSelect
                      id={props.id}
                      aria-invalid={props["aria-invalid"]}
                      value={field.value}
                      onChange={(value) => {
                        field.onChange(value);
                        setValue("variantId", "");
                      }}
                      options={productOptions}
                      placeholder={products.isPending ? "Loading catalogue" : "Search name or SKU"}
                      disabled={products.isPending}
                    />
                  )}
                />
              )}
            </Field>
            <Field
              label="Variant"
              error={errors.variantId?.message}
              hint={needsVariant && !variantChoices.length ? "No variants yet. Add them in Products." : undefined}
            >
              {(props) => (
                <Select {...props} {...register("variantId")} disabled={!needsVariant || !variantChoices.length}>
                  <option value="">{needsVariant ? "Choose a variant" : "Not needed"}</option>
                  {variantChoices.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field
              label="Quantity available"
              required
              error={errors.quantity?.message}
              hint={alreadyHeld ? `Currently ${alreadyHeld.quantity}. This replaces it.` : undefined}
            >
              {(props) => <Input {...props} {...register("quantity")} inputMode="numeric" placeholder="0" className="tabular" />}
            </Field>
            <Field
              label="Rate per unit (₹)"
              error={errors.rate?.message}
              hint={alreadyHeld?.rate != null ? `Now ${formatMoney({ amount: alreadyHeld.rate, currency: "INR" })}. Leave empty to keep.` : "Optional."}
            >
              {(props) => <Input {...props} {...register("rate")} inputMode="decimal" placeholder="125.00" className="tabular" />}
            </Field>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Reason" error={errors.reason?.message} hint="Optional. Kept in the history.">
              {(props) => <Input {...props} {...register("reason")} placeholder="e.g. Called Raj, new price list" />}
            </Field>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" /> : <Check />}
              Save
            </Button>
          </div>
        </form>
      ) : null}

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
              {loaded ? <span className="tabular ml-1.5 text-muted-foreground">{counts[f.id]}</span> : null}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Product, variant or SKU"
            aria-label="Search this supplier's stock"
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
                <TH className="text-right">Available</TH>
                <TH className="text-right">Rate / unit</TH>
                <TH>Last confirmed</TH>
                {canWrite ? (
                  <TH className="w-28 text-right">
                    <span className="sr-only">Actions</span>
                  </TH>
                ) : null}
              </tr>
            </THead>
            <TBody>
              {holdings.isPending ? <TableSkeleton rows={4} columns={canWrite ? 5 : 4} /> : null}
              {pageRows.map((line) => {
                const key = keyOf(line);
                const editing = editingKey === key;
                const age = confirmedLabel(line.confirmedAt);
                const variant = line.variantName && line.variantName !== "Standard" ? line.variantName : null;
                const below =
                  supplier.minimumOrderQuantity != null && line.quantity > 0 && line.quantity < supplier.minimumOrderQuantity;
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
                      <span className="font-medium">{line.productName}</span>
                      {variant ? <span className="ml-2 text-muted-foreground">{variant}</span> : null}
                      {line.sku ? <span className="block font-mono text-[0.7rem] text-muted-foreground">{line.sku}</span> : null}
                    </TD>
                    <TD className="tabular text-right">
                      {editing ? (
                        <Input
                          autoFocus
                          value={editQuantity}
                          inputMode="numeric"
                          aria-label={`New quantity available for ${labelOf(line)}`}
                          className="tabular ml-auto h-8 w-24 text-right"
                          onChange={(event) => setEditQuantity(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") commitEdit(line);
                            if (event.key === "Escape") setEditingKey(null);
                          }}
                        />
                      ) : line.quantity === 0 ? (
                        <span className="text-muted-foreground">None</span>
                      ) : (
                        <span title={below ? `Below their minimum order of ${supplier.minimumOrderQuantity}` : undefined}>
                          {formatCount(line.quantity)}
                          {below ? <span className="ml-1 text-[var(--warning)]">*</span> : null}
                        </span>
                      )}
                    </TD>
                    <TD className="tabular text-right">
                      {editing ? (
                        <Input
                          value={editRate}
                          inputMode="decimal"
                          aria-label={`New rate per unit for ${labelOf(line)}`}
                          placeholder="keep"
                          className="tabular ml-auto h-8 w-24 text-right"
                          onChange={(event) => setEditRate(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") commitEdit(line);
                            if (event.key === "Escape") setEditingKey(null);
                          }}
                        />
                      ) : line.rate == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        formatMoney({ amount: line.rate, currency: "INR" })
                      )}
                    </TD>
                    <TD className="text-xs">
                      {editing ? (
                        <Input
                          value={editReason}
                          aria-label={`Reason for changing ${labelOf(line)}`}
                          placeholder="Reason (optional)"
                          maxLength={200}
                          className="h-8 min-w-40"
                          onChange={(event) => setEditReason(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") commitEdit(line);
                            if (event.key === "Escape") setEditingKey(null);
                          }}
                        />
                      ) : age.stale ? (
                        <Badge variant="warning" title={`Ask the supplier again. Not confirmed in ${STALE_AFTER_DAYS}+ days.`}>
                          {age.text}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">{age.text}</span>
                      )}
                    </TD>
                    {canWrite ? (
                      <TD>
                        <div className="flex justify-end gap-1">
                          {editing ? (
                            <>
                              <Button size="sm" variant="ghost" aria-label="Save" disabled={save.isPending} onClick={() => commitEdit(line)}>
                                <Check />
                              </Button>
                              <Button size="sm" variant="ghost" aria-label="Cancel" onClick={() => setEditingKey(null)}>
                                <X />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={`Confirm ${labelOf(line)} as it is`}
                                title="Still correct: the supplier confirmed these numbers today"
                                disabled={save.isPending}
                                onClick={() => reconfirm(line)}
                              >
                                <CheckCheck />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={`Change stock of ${labelOf(line)}`}
                                title="Change the count or the rate"
                                onClick={() => {
                                  setEditingKey(key);
                                  setEditQuantity(String(line.quantity));
                                  setEditRate(line.rate == null ? "" : String(line.rate));
                                  setEditReason("");
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
              })}
            </TBody>
          </Table>
        </TableWrapper>

        {holdings.isError ? (
          <EmptyState
            title="Could not load this supplier's stock"
            description={holdings.error instanceof Error ? holdings.error.message : undefined}
            action={
              <Button variant="outline" onClick={() => holdings.refetch()}>
                Try again
              </Button>
            }
          />
        ) : null}

        {loaded && !all.length ? (
          <EmptyState
            icon={<Package />}
            title="No stock recorded for this supplier yet"
            description={canWrite ? "Use Add item for one product, or Import list to paste a whole price list." : undefined}
          />
        ) : null}

        {loaded && all.length > 0 && rows.length === 0 ? (
          <EmptyState
            title={search.trim() ? "No product matches that search" : "Nothing in this view"}
            action={
              filter !== "all" || search ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilter("all");
                    setSearch("");
                    setPage(1);
                  }}
                >
                  Show everything
                </Button>
              ) : undefined
            }
          />
        ) : null}

        <Pagination
          page={page}
          pageSize={pageSize}
          total={rows.length}
          noun="items"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>

      {supplier.minimumOrderQuantity != null ? (
        <p className="text-xs text-muted-foreground">
          <span className="text-[var(--warning)]">*</span> Below this supplier&apos;s minimum order of{" "}
          {formatCount(supplier.minimumOrderQuantity)} units.
        </p>
      ) : null}

      {importing ? (
        <SupplierStockImportDialog supplier={supplier} current={all} onClose={() => setImporting(false)} />
      ) : null}
    </div>
  );
}

"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Package, Pencil, Plus, Search, X } from "lucide-react";
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
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/skeleton";
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

/**
 * What one warehouse holds, shown in the page itself (no dialog): a search box, the stock table, and
 * an "add stock" form above it. A product added here appears in the table at once, from the server's
 * own answer, and its row is highlighted for a moment so the result of "add 5 to 20" is easy to find.
 * Setting a quantity replaces what was held (the backend's rule), so editing a row sends the same call.
 */
export function WarehouseStockPanel({
  warehouse,
  adding,
  onCloseAdd,
}: {
  warehouse: WarehouseView;
  /** The add form is hidden until the page's "Add product" button opens it. */
  adding: boolean;
  onCloseAdd: () => void;
}) {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const queryClient = useQueryClient();
  const stockKey = masterDataKeys.warehouseProducts(warehouse.id);
  const [search, setSearch] = useState("");
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

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (holdings.data ?? []).filter(
      (entry) => !term || `${entry.productName} ${entry.variantName ?? ""}`.toLowerCase().includes(term),
    );
  }, [holdings.data, search]);
  const totalUnits = (holdings.data ?? []).reduce((sum, entry) => sum + entry.quantity, 0);
  const productCount = new Set((holdings.data ?? []).map((entry) => entry.productId)).size;
  // A product's lines together: stock is held per variant, so the product itself is the total of its variants.
  const groups = useMemo(() => {
    const byProduct = new Map<string, WarehouseProductView[]>();
    for (const entry of rows) byProduct.set(entry.productId, [...(byProduct.get(entry.productId) ?? []), entry]);
    return [...byProduct.values()];
  }, [rows]);

  const commitEdit = (entry: WarehouseProductView) => {
    const quantity = Number(editQuantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      toast.error("Enter a whole number of at least 1");
      return;
    }
    save.mutate(
      { productId: entry.productId, variantId: entry.variantId ?? undefined, quantity },
      {
        onSuccess: () => setEditingKey(null),
        onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not change the quantity."),
      },
    );
  };

  const renderLine = (entry: WarehouseProductView, indented: boolean) => {
      const key = keyOf(entry);
      const editing = editingKey === key;
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
              <span className="pl-5 text-muted-foreground">{entry.variantName && entry.variantName !== "Standard" ? entry.variantName : "Main product"}</span>
            ) : (
              <>
                <span className="font-medium">{entry.productName}</span>
                {entry.variantName ? <span className="ml-2 text-muted-foreground">{entry.variantName}</span> : null}
              </>
            )}
          </TD>
          <TD className="tabular text-right">
            {editing ? (
              <Input
                autoFocus
                value={editQuantity}
                inputMode="numeric"
                aria-label={`New quantity for ${entry.productName}`}
                className="tabular ml-auto h-8 w-24 text-right"
                onChange={(event) => setEditQuantity(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitEdit(entry);
                  if (event.key === "Escape") setEditingKey(null);
                }}
              />
            ) : (
              entry.quantity
            )}
          </TD>
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
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Change quantity of ${entry.productName}`}
                    onClick={() => {
                      setEditingKey(key);
                      setEditQuantity(String(entry.quantity));
                    }}
                  >
                    <Pencil />
                  </Button>
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
              label="Quantity"
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {holdings.data
            ? `${productCount} product${productCount === 1 ? "" : "s"} · ${totalUnits} unit${totalUnits === 1 ? "" : "s"}`
            : "Loading stock…"}
        </p>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products here"
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
                <TH className="text-right">Quantity</TH>
                {canWrite ? <TH className="w-24 text-right">Change</TH> : null}
              </tr>
            </THead>
            <TBody>
              {holdings.isPending ? <TableSkeleton rows={4} columns={canWrite ? 3 : 2} /> : null}
              {groups.map((lines) => {
                const grouped = lines.length > 1;
                const first = lines[0];
                return (
                  <Fragment key={first.productId}>
                    {grouped ? (
                      <TR className="bg-muted/40">
                        <TD>
                          <span className="font-medium">{first.productName}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{lines.length} variants</span>
                        </TD>
                        <TD className="tabular text-right font-medium">{lines.reduce((sum, line) => sum + line.quantity, 0)}</TD>
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
          <EmptyState icon={<Package />} title="No products in this warehouse yet" description={canWrite ? "Use the form above to add the first one." : undefined} />
        ) : null}
        {holdings.data && holdings.data.length > 0 && rows.length === 0 ? (
          <EmptyState title="No product matches that search" />
        ) : null}
      </div>
    </div>
  );
}

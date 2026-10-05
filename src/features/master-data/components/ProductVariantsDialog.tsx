"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createProductVariant,
  deleteProductVariant,
  generateVariants,
  getStockGrid,
  listFacetOptions,
  listProducts,
  listVariantCombinations,
  masterDataKeys,
  saveStockGrid,
  setProductAxes,
  setVariantActive,
  updateProductVariant,
} from "@/features/master-data/api";
import type { ProductVariantView, ProductView } from "@/features/master-data/types";
import { useCan } from "@/features/auth";
import { ApiError } from "@/services/api-client";
import { amountField } from "@/lib/forms";
import { formatMoney } from "@/lib/money";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const FORM_ID = "product-variant-form";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Maximum 100 characters"),
  wholesaleRate: amountField("Wholesale rate"),
  retailRate: amountField("Retail rate"),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

/** Money comes back as a number or a numeric string; the form wants "1500". */
const amountText = (amount: number | string) => String(Number(amount));

type Mode =
  | { kind: "list" }
  | { kind: "form"; variant?: ProductVariantView }
  | { kind: "delete"; variant: ProductVariantView };

const messageOf = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

/**
 * The form for one variant. Mounted per open, keyed by the variant. A variant that sits on axes is
 * named from its values, so only its rates are edited; the name field is for plain variants.
 */
function VariantForm({
  product,
  variant,
  onSubmit,
}: {
  product: ProductView;
  variant?: ProductVariantView;
  onSubmit: (values: FormOutput) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: variant?.name ?? "",
      wholesaleRate: amountText((variant ?? product).wholesaleRate.amount),
      retailRate: amountText((variant ?? product).retailRate.amount),
    },
  });

  return (
    <form id={FORM_ID} className="space-y-4" noValidate onSubmit={handleSubmit(onSubmit)}>
      <Field label="Name" required error={errors.name?.message}>
        {(props) => <Input {...props} {...register("name")} placeholder="Red" autoFocus />}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Wholesale rate" required error={errors.wholesaleRate?.message} hint="Per day, in INR.">
          {(props) => <Input {...props} {...register("wholesaleRate")} inputMode="decimal" />}
        </Field>
        <Field label="Retail rate" required error={errors.retailRate?.message} hint="Per day, in INR.">
          {(props) => <Input {...props} {...register("retailRate")} inputMode="decimal" />}
        </Field>
      </div>
    </form>
  );
}

/** Pick the facets this product varies on, then tick the combinations that are really stocked. */
function AxesAndCombinations({ product, canWrite }: { product: ProductView; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const axes = product.axes ?? [];
  const [picked, setPicked] = useState<string[]>(axes.map((axis) => axis.facetId));
  const [ticked, setTicked] = useState<string[][]>([]);
  const [error, setError] = useState<string | null>(null);
  const axesFixed = product.variants.some((variant) => variant.hasAttributes);

  const facets = useQuery({
    queryKey: ["master-data", "facet-options"],
    queryFn: ({ signal }) => listFacetOptions(signal),
  });
  const combinations = useQuery({
    queryKey: ["master-data", "variant-combinations", product.id, axes.map((a) => a.facetId).join(",")],
    queryFn: ({ signal }) => listVariantCombinations(product.id, signal),
    enabled: axes.length > 0,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: masterDataKeys.products });

  const saveAxes = useMutation({
    mutationFn: () => setProductAxes(product.id, picked),
    onSuccess: () => {
      setError(null);
      setTicked([]);
      refresh();
      toast.success("Axes saved", { description: product.name });
    },
    onError: (e) => setError(messageOf(e, "Could not save the axes.")),
  });

  const create = useMutation({
    mutationFn: () => generateVariants(product.id, ticked),
    onSuccess: (created) => {
      setError(null);
      setTicked([]);
      refresh();
      queryClient.invalidateQueries({ queryKey: ["master-data", "variant-combinations", product.id] });
      toast.success(`${created.length} variant${created.length === 1 ? "" : "s"} created`, {
        description: product.name,
      });
    },
    onError: (e) => setError(messageOf(e, "Could not create the variants.")),
  });

  const key = (ids: string[]) => ids.join("|");
  const isTicked = (ids: string[]) => ticked.some((t) => key(t) === key(ids));
  const toggle = (ids: string[]) =>
    setTicked((current) => (isTicked(ids) ? current.filter((t) => key(t) !== key(ids)) : [...current, ids]));

  if (!canWrite && !axes.length) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium">Varies on</h3>
      {error ? <Alert tone="error" title={error} /> : null}
      {facets.isError ? <Alert tone="error" title="Could not load the facets." /> : null}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {(facets.data ?? []).map((facet) => (
          <label key={facet.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--primary)]"
              checked={picked.includes(facet.id)}
              disabled={!canWrite || axesFixed}
              onChange={(event) =>
                setPicked((current) =>
                  event.target.checked ? [...current, facet.id] : current.filter((id) => id !== facet.id),
                )
              }
            />
            {facet.label}
          </label>
        ))}
      </div>
      {canWrite && !axesFixed ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => saveAxes.mutate()}
          disabled={saveAxes.isPending || picked.join() === axes.map((a) => a.facetId).join()}
        >
          {saveAxes.isPending ? <Loader2 className="animate-spin" /> : null}
          Save axes
        </Button>
      ) : axesFixed && axes.length ? (
        <p className="text-xs text-muted-foreground">Axes are fixed once variants use them.</p>
      ) : null}

      {axes.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Tick the combinations you actually stock</h3>
          {combinations.isPending ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
          {combinations.isError ? (
            <Alert tone="error" title={messageOf(combinations.error, "Could not load the combinations.")} />
          ) : null}
          <div className="grid gap-1.5 sm:grid-cols-2">
            {(combinations.data ?? []).map((combo) => (
              <label key={key(combo.valueIds)} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--primary)]"
                  checked={combo.existingVariantId != null || isTicked(combo.valueIds)}
                  disabled={!canWrite || combo.existingVariantId != null}
                  onChange={() => toggle(combo.valueIds)}
                />
                <span className={combo.existingVariantId != null ? "text-muted-foreground" : undefined}>
                  {combo.label}
                </span>
              </label>
            ))}
          </div>
          {canWrite ? (
            <Button size="sm" onClick={() => create.mutate()} disabled={!ticked.length || create.isPending}>
              {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              Create {ticked.length || ""} variant{ticked.length === 1 ? "" : "s"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** Variants against warehouses. Each cell is the number the admin writes (a set, not an add). */
function StockTab({ product, canWrite }: { product: ProductView; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const grid = useQuery({
    queryKey: ["master-data", "stock-grid", product.id],
    queryFn: ({ signal }) => getStockGrid(product.id, signal),
  });
  // Only what the admin typed; every other cell shows what is saved.
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const cellKey = (variantId: string, warehouseId: string) => `${variantId}:${warehouseId}`;
  const savedText = (variantId: string, warehouseId: string) => {
    const cell = grid.data?.cells.find((c) => c.variantId === variantId && c.warehouseId === warehouseId);
    return cell ? String(cell.quantity) : "";
  };

  const save = useMutation({
    mutationFn: () => {
      const data = grid.data!;
      const cells = data.variants.flatMap((variant) =>
        data.warehouses.flatMap((warehouse) => {
          const text = edits[cellKey(variant.id, warehouse.id)];
          return text === undefined
            ? []
            : [{ variantId: variant.id, warehouseId: warehouse.id, quantity: text === "" ? 0 : Number(text) }];
        }),
      );
      if (cells.some((c) => !Number.isInteger(c.quantity) || c.quantity < 0)) {
        return Promise.reject(new ApiError("Quantities must be whole numbers, zero or more.", 400));
      }
      return saveStockGrid(product.id, cells);
    },
    onSuccess: (saved) => {
      setError(null);
      setEdits({});
      queryClient.setQueryData(["master-data", "stock-grid", product.id], saved);
      queryClient.invalidateQueries({ queryKey: masterDataKeys.products });
      toast.success("Stock saved", { description: `${saved.shownToCustomers} shown to customers` });
    },
    onError: (e) => setError(messageOf(e, "Could not save the stock.")),
  });

  if (grid.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (grid.isError) return <Alert tone="error" title={messageOf(grid.error, "Could not load the stock.")} />;
  const data = grid.data;
  if (!data.warehouses.length) {
    return <EmptyState icon={<Layers />} title="Add a warehouse first" />;
  }

  return (
    <div className="space-y-3">
      {error ? <Alert tone="error" title={error} /> : null}
      <p className="text-sm text-muted-foreground">
        Customers are shown <span className="font-medium text-foreground tabular">{data.shownToCustomers}</span>: the
        total of the active variants. Orders and dispatches never change it.
      </p>
      <div className="overflow-hidden rounded-md border border-border">
        <TableWrapper>
          <Table>
            <THead>
              <tr>
                <TH>Variant</TH>
                {data.warehouses.map((warehouse) => (
                  <TH key={warehouse.id} className="text-right">
                    {warehouse.name}
                  </TH>
                ))}
              </tr>
            </THead>
            <TBody>
              {data.variants.map((variant) => (
                <TR key={variant.id}>
                  <TD className="font-medium">
                    {variant.name}
                    {!variant.active ? <Badge className="ml-1.5">Inactive</Badge> : null}
                    <div className="text-xs font-normal text-muted-foreground">{variant.sku}</div>
                  </TD>
                  {data.warehouses.map((warehouse) => (
                    <TD key={warehouse.id} className="text-right">
                      <Input
                        className="ml-auto w-24 text-right tabular"
                        inputMode="numeric"
                        aria-label={`${variant.name} in ${warehouse.name}`}
                        disabled={!canWrite}
                        value={edits[cellKey(variant.id, warehouse.id)] ?? savedText(variant.id, warehouse.id)}
                        placeholder="0"
                        onChange={(event) =>
                          setEdits((current) => ({
                            ...current,
                            [cellKey(variant.id, warehouse.id)]: event.target.value,
                          }))
                        }
                      />
                    </TD>
                  ))}
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrapper>
      </div>
      {canWrite ? (
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="animate-spin" /> : null}
          Save stock
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Variants and stock of one product. The list, the add/edit form and the delete confirmation swap
 * inside this one dialog rather than stacking a second, because Dialog closes on Escape at the
 * document level. A product with only its default variant shows no variants to customers.
 */
export function ProductVariantsDialog({
  product: initial,
  onClose,
}: {
  product: ProductView;
  onClose: () => void;
}) {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"variants" | "stock">("variants");
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [formError, setFormError] = useState<string | null>(null);

  // Read back from the catalogue query so the list reflects each save.
  const products = useQuery({
    queryKey: masterDataKeys.products,
    queryFn: ({ signal }) => listProducts(signal),
  });
  const product = products.data?.find((candidate) => candidate.id === initial.id) ?? initial;
  const hasAxes = (product.axes ?? []).length > 0;

  const back = () => {
    setFormError(null);
    setMode({ kind: "list" });
  };

  const save = useMutation({
    mutationFn: ({ variant, values }: { variant?: ProductVariantView; values: FormOutput }) =>
      variant
        ? updateProductVariant(product.id, variant.id, values)
        : createProductVariant(product.id, values),
    onSuccess: (variant, { variant: previous }) => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.products });
      toast.success(previous ? `${variant.name} updated` : `${variant.name} added`, { description: product.name });
      back();
    },
    onError: (error) => setFormError(messageOf(error, "Could not save the variant.")),
  });

  const remove = useMutation({
    mutationFn: (variant: ProductVariantView) => deleteProductVariant(product.id, variant.id),
    onSuccess: (_, variant) => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.products });
      toast.success(`${variant.name} deleted`, { description: product.name });
      back();
    },
    onError: (error) => setFormError(messageOf(error, "Could not delete the variant.")),
  });

  const toggleActive = useMutation({
    mutationFn: (variant: ProductVariantView) => setVariantActive(variant.id, variant.active === false),
    onSuccess: (variant) => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.products });
      toast.success(`${variant.name} ${variant.active ? "switched on" : "switched off"}`, {
        description: product.name,
      });
    },
    onError: (error) => setFormError(messageOf(error, "Could not change the variant.")),
  });

  const pending = save.isPending || remove.isPending;

  const footer =
    tab === "stock" ? (
      <Button variant="outline" onClick={onClose}>
        Close
      </Button>
    ) : mode.kind === "form" ? (
      <>
        <Button variant="outline" onClick={back} disabled={pending}>
          Cancel
        </Button>
        <Button form={FORM_ID} type="submit" disabled={pending}>
          {save.isPending ? <Loader2 className="animate-spin" /> : null}
          {mode.variant ? "Save changes" : "Add variant"}
        </Button>
      </>
    ) : mode.kind === "delete" ? (
      <>
        <Button variant="outline" onClick={back} disabled={pending}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={() => remove.mutate(mode.variant)} disabled={pending}>
          {remove.isPending ? <Loader2 className="animate-spin" /> : null}
          Delete variant
        </Button>
      </>
    ) : (
      <>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        {canWrite && !hasAxes ? (
          <Button onClick={() => setMode({ kind: "form" })}>
            <Plus />
            Add variant
          </Button>
        ) : null}
      </>
    );

  return (
    <Dialog
      open
      onClose={onClose}
      title={
        tab === "variants" && mode.kind === "form"
          ? mode.variant
            ? `Edit ${mode.variant.name}`
            : `New variant of ${product.name}`
          : `${product.name}: ${tab === "stock" ? "stock" : "variants"}`
      }
      description={`SKU ${product.sku}`}
      className="max-w-3xl"
      footer={footer}
    >
      <div className="space-y-4">
        <div className="flex gap-1 border-b border-border">
          {(["variants", "stock"] as const).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setTab(name);
                back();
              }}
              className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium ${
                tab === name ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
              }`}
            >
              {name === "variants" ? "Variants" : "Stock"}
            </button>
          ))}
        </div>

        {tab === "stock" ? <StockTab product={product} canWrite={canWrite} /> : null}

        {tab === "variants" ? (
          <>
            {formError ? <Alert tone="error" title={formError} /> : null}

            {mode.kind === "list" ? <AxesAndCombinations product={product} canWrite={canWrite} /> : null}

            {mode.kind === "form" ? (
              <VariantForm
                key={mode.variant?.id ?? "new"}
                product={product}
                variant={mode.variant}
                onSubmit={(values) => {
                  setFormError(null);
                  save.mutate({ variant: mode.variant, values });
                }}
              />
            ) : null}

            {mode.kind === "delete" ? (
              <p className="text-sm">
                Delete <span className="font-medium">{mode.variant.name}</span>? {product.name} and its other
                variants are not affected.
              </p>
            ) : null}

            {mode.kind === "list" ? (
              <div className="overflow-hidden rounded-md border border-border">
                <TableWrapper>
                  <Table>
                    <THead>
                      <tr>
                        <TH>Variant</TH>
                        <TH className="text-right">Retail rate</TH>
                        <TH className="text-right">Stock</TH>
                        {canWrite ? <TH className="text-right">Actions</TH> : null}
                      </tr>
                    </THead>
                    <TBody>
                      {product.variants.map((variant) => (
                        <TR key={variant.id}>
                          <TD className="font-medium">
                            {variant.name}
                            {variant.isDefault ? <Badge className="ml-1.5">Default</Badge> : null}
                            {variant.active === false ? <Badge className="ml-1.5">Off</Badge> : null}
                            <div className="text-xs font-normal text-muted-foreground">{variant.sku}</div>
                          </TD>
                          <TD className="tabular text-right">{formatMoney(variant.retailRate)}</TD>
                          <TD className="tabular text-right">{variant.stock}</TD>
                          {canWrite ? (
                            <TD>
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleActive.mutate(variant)}
                                  disabled={toggleActive.isPending}
                                >
                                  {variant.active === false ? "Switch on" : "Switch off"}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setMode({ kind: "form", variant })}
                                  aria-label={`Edit ${variant.name}`}
                                  title="Edit"
                                >
                                  <Pencil />
                                </Button>
                                {variant.isDefault ? null : (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setMode({ kind: "delete", variant })}
                                    aria-label={`Delete ${variant.name}`}
                                    title="Delete"
                                  >
                                    <Trash2 />
                                  </Button>
                                )}
                              </div>
                            </TD>
                          ) : null}
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableWrapper>

                {!product.variants.length ? <EmptyState icon={<Layers />} title="No variants yet" /> : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </Dialog>
  );
}

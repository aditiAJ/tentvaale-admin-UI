"use client";

import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { listFacetOptions, listWarehouses, masterDataKeys } from "@/features/master-data/api";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";

/** What a variant can differ by; the facets already in the system are listed too. */
export const VARIANT_TYPES = ["Colour", "Size", "Fabric", "Material", "Style"];

// Everything stays text until the product form's save, where only the filled rows are turned into numbers.
const stockLine = z.object({ warehouseId: z.string(), quantity: z.string().trim() });

const variantLine = z.object({
  // Set for a variant the product already has.
  id: z.string().optional(),
  active: z.boolean().optional(),
  type: z.string(),
  name: z.string().trim(),
  // Left empty, a variant takes the product's own rate.
  wholesaleRate: z.string().trim(),
  retailRate: z.string().trim(),
  stock: z.array(stockLine).max(20, "At most 20 warehouses"),
});

/** The fields of the variant and stock inputs, for the product form's schema. */
export const variantStepShape = {
  variants: z.array(variantLine).max(30, "At most 30 variants"),
  stock: z.array(stockLine).max(20, "At most 20 warehouses"),
};

export interface StockLineValues {
  warehouseId: string;
  quantity: string;
}

export interface VariantLineValues {
  id?: string;
  active?: boolean;
  type: string;
  name: string;
  wholesaleRate: string;
  retailRate: string;
  stock: StockLineValues[];
}

/** The form values this step reads and writes (the product form has more; they are not touched here). */
export interface VariantStepValues {
  variants: VariantLineValues[];
  stock: StockLineValues[];
}

export const blankStockLine = (): StockLineValues => ({ warehouseId: "", quantity: "" });

export const blankVariant = (): VariantLineValues => ({
  type: "",
  name: "",
  wholesaleRate: "",
  retailRate: "",
  stock: [blankStockLine()],
});

/** A stock row counts once anything is entered in it; an empty one is skipped. */
export const stockLineUsed = (line: StockLineValues) => line.warehouseId !== "" || line.quantity.trim() !== "";

/** A variant row counts when it is one the product has, or has a name or stock; an empty row is skipped. */
export const variantFilled = (variant: VariantLineValues) =>
  Boolean(variant.id) || variant.name.trim() !== "" || variant.stock.some(stockLineUsed);

const AMOUNT = /^\d+(\.\d{1,2})?$/;

function checkStock(lines: StockLineValues[], path: (string | number)[], ctx: z.RefinementCtx) {
  const seen = new Set<string>();
  lines.forEach((line, index) => {
    if (!stockLineUsed(line)) return;
    if (!line.warehouseId) {
      ctx.addIssue({ code: "custom", path: [...path, index, "warehouseId"], message: "Choose a warehouse" });
    } else if (seen.has(line.warehouseId)) {
      ctx.addIssue({ code: "custom", path: [...path, index, "warehouseId"], message: "Already listed" });
    } else {
      seen.add(line.warehouseId);
    }
    if (!/^\d+$/.test(line.quantity.trim())) {
      ctx.addIssue({ code: "custom", path: [...path, index, "quantity"], message: "Whole number, 0 or more" });
    }
  });
}

/** The rules that look at filled rows: a name, a type, valid rates, no repeated name or warehouse. */
export function checkVariantStep(value: VariantStepValues, ctx: z.RefinementCtx) {
  checkStock(value.stock, ["stock"], ctx);
  const seen = new Set<string>();
  value.variants.forEach((variant, index) => {
    if (!variantFilled(variant)) return;
    const name = variant.name.trim().toLowerCase();
    if (!name) {
      ctx.addIssue({ code: "custom", path: ["variants", index, "name"], message: "Name the variant" });
    } else if (seen.has(name)) {
      ctx.addIssue({ code: "custom", path: ["variants", index, "name"], message: "Already listed" });
    }
    seen.add(name);
    if (!variant.id && !variant.type.trim()) {
      ctx.addIssue({ code: "custom", path: ["variants", index, "type"], message: "Choose a type" });
    }
    (["wholesaleRate", "retailRate"] as const).forEach((rate) => {
      if (variant[rate] !== "" && !AMOUNT.test(variant[rate])) {
        ctx.addIssue({ code: "custom", path: ["variants", index, rate], message: "Enter an amount like 1500" });
      }
    });
    checkStock(variant.stock, ["variants", index, "stock"], ctx);
  });
}

/**
 * The variants of a product, one row each: its type (Colour, Size ...), name, wholesale and retail rate, and where
 * it is stocked. One empty row is always there: fill it to add a variant, leave it and it is skipped. Every variant
 * has its own type, so two colours and two sizes can sit side by side. Saved with the product, all or nothing.
 */
export function ProductVariantsStep() {
  const { control, register, getValues, formState } = useFormContext<VariantStepValues>();
  const errors = formState.errors;
  const variants = useFieldArray({ control, name: "variants" });
  const facets = useQuery({
    queryKey: ["master-data", "facet-options"],
    queryFn: ({ signal }) => listFacetOptions(signal),
  });

  const types = [...VARIANT_TYPES];
  for (const facet of facets.data ?? []) {
    if (!types.some((type) => type.toLowerCase() === facet.label.toLowerCase())) types.push(facet.label);
  }

  const remove = (index: number) => {
    variants.remove(index);
    // One row always stays, for the next variant.
    if (variants.fields.length === 1) variants.append(blankVariant());
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Fill a variant to add it; an empty one is skipped. Each variant has its own type, so you can add colours and
        sizes together. A variant with no rate uses the product&apos;s.
      </p>

      <ul className="space-y-3">
        {variants.fields.map((field, index) => {
          const existingId = getValues(`variants.${index}.id`);
          const rowErrors = errors.variants?.[index];
          return (
            <li key={field.id} className="space-y-3 rounded-lg border border-border p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-muted-foreground">Variant {index + 1}</p>
                <div className="flex items-center gap-2">
                  {existingId ? (
                    <label className="flex items-center gap-1.5 text-xs">
                      <input type="checkbox" className="size-3.5" {...register(`variants.${index}.active`)} />
                      Offered to customers
                    </label>
                  ) : null}
                  <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} aria-label={`Remove variant ${index + 1}`}>
                    <Trash2 />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_1fr_1fr]">
                <Field label="Variant type" error={rowErrors?.type?.message}>
                  {(props) =>
                    existingId ? (
                      // An existing variant keeps its type; it is shown, not chosen again.
                      <Input {...props} value={getValues(`variants.${index}.type`) || "None"} readOnly className="bg-muted" />
                    ) : (
                      <Select {...props} {...register(`variants.${index}.type`)}>
                        <option value="">Choose a type</option>
                        {types.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </Select>
                    )
                  }
                </Field>
                <Field label="Variant name" error={rowErrors?.name?.message}>
                  {(props) => (
                    <Input
                      {...props}
                      {...register(`variants.${index}.name`)}
                      placeholder="Red"
                      autoComplete="off"
                      // An existing variant on a type is named from its value.
                      readOnly={Boolean(existingId) && Boolean(getValues(`variants.${index}.type`))}
                    />
                  )}
                </Field>
                <Field label="Wholesale rate" error={rowErrors?.wholesaleRate?.message}>
                  {(props) => <Input {...props} {...register(`variants.${index}.wholesaleRate`)} inputMode="decimal" placeholder="Product's rate" />}
                </Field>
                <Field label="Retail rate" error={rowErrors?.retailRate?.message}>
                  {(props) => <Input {...props} {...register(`variants.${index}.retailRate`)} inputMode="decimal" placeholder="Product's rate" />}
                </Field>
              </div>

              <StockFields name={`variants.${index}.stock`} />
            </li>
          );
        })}
      </ul>

      <Button type="button" variant="outline" onClick={() => variants.append(blankVariant())}>
        <Plus />
        Add another variant
      </Button>
    </div>
  );
}

type StockPath = "stock" | `variants.${number}.stock`;

/**
 * Warehouse and quantity, always showing. Once a row is filled, a link opens the next warehouse; a row left empty is
 * skipped. Used for the product itself and for each variant.
 */
export function StockFields({ name, warehouseLabel = "Warehouse" }: { name: StockPath; warehouseLabel?: string }) {
  const { control, register, formState } = useFormContext<VariantStepValues>();
  const lines = useFieldArray({ control, name });
  const watched = useWatch({ control, name }) ?? [];
  const warehouses = useQuery({ queryKey: masterDataKeys.warehouses, queryFn: ({ signal }) => listWarehouses(signal) });
  const options = (warehouses.data ?? []).filter((warehouse) => warehouse.active !== false);
  const loading = warehouses.isPending;

  const errors = formState.errors;
  const lineErrors = name === "stock" ? errors.stock : errors.variants?.[Number(name.split(".")[1])]?.stock;
  const last = watched[watched.length - 1];
  const lastFilled = Boolean(last) && last.warehouseId !== "" && last.quantity.trim() !== "";

  return (
    <div className="space-y-2">
      {lines.fields.map((field, index) => (
        <div key={field.id} className="grid items-start gap-2 sm:grid-cols-[2fr_1fr_auto]">
          <Field label={index === 0 ? warehouseLabel : ""} error={lineErrors?.[index]?.warehouseId?.message}>
            {(props) => (
              <Select
                {...props}
                {...register(`${name}.${index}.warehouseId` as `stock.${number}.warehouseId`)}
                disabled={loading || options.length === 0}
              >
                <option value="">
                  {loading ? "Loading warehouses" : options.length === 0 ? "No warehouse yet: add one under Warehouses" : "Choose a warehouse"}
                </option>
                {options.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={index === 0 ? "Quantity" : ""} error={lineErrors?.[index]?.quantity?.message}>
            {(props) => (
              <Input {...props} {...register(`${name}.${index}.quantity` as `stock.${number}.quantity`)} inputMode="numeric" placeholder="10" className="tabular" />
            )}
          </Field>
          <div className={index === 0 ? "sm:pt-[1.375rem]" : undefined}>
            {lines.fields.length > 1 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => lines.remove(index)} aria-label="Remove this warehouse line">
                <Trash2 />
              </Button>
            ) : null}
          </div>
        </div>
      ))}
      {lastFilled ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => lines.append(blankStockLine())}>
          <Plus />
          Another warehouse
        </Button>
      ) : null}
    </div>
  );
}

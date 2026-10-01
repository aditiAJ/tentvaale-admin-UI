"use client";

import { useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createPriceList,
  listProducts,
  masterDataKeys,
  updatePriceList,
} from "@/features/master-data/api";
import type { PriceListView } from "@/features/master-data/types";
import { ActiveToggle } from "@/features/master-data/components/ActiveToggle";
import { ApiError } from "@/services/api-client";
import { amountField } from "@/lib/forms";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

const FORM_ID = "price-list-form";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150, "Maximum 150 characters"),
  // A percentage with at most two decimals, 0 to 100.
  discount: z
    .string()
    .trim()
    .min(1, "Enter 0 for no discount")
    .regex(/^\d{1,3}(\.\d{1,2})?$/, "A percentage like 10 or 12.5")
    .transform(Number)
    .refine((value) => value <= 100, "At most 100"),
  active: z.boolean(),
  items: z.array(
    z.object({
      productId: z.string(),
      variantId: z.string(),
      dailyRate: amountField("Rate"),
    }),
  ),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

/**
 * Add or edit one price list: its default discount and the explicit trade rates that override it.
 *
 * A planner on the list pays the explicit rate where there is one, otherwise the standard rate less
 * the default discount. Only an approved planner on an active list gets any of it (ADR-004).
 */
export function PriceListDialog({
  existing,
  onClose,
}: {
  existing?: PriceListView;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [rate, setRate] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const products = useQuery({
    queryKey: masterDataKeys.products,
    queryFn: ({ signal }) => listProducts(signal),
  });
  const catalogue = useMemo(() => products.data ?? [], [products.data]);
  const picked = catalogue.find((product) => product.id === productId);

  const {
    control,
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: existing?.name ?? "",
      discount: existing ? String(existing.defaultDiscountPercent) : "0",
      active: existing?.active ?? true,
      items: (existing?.items ?? []).map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? "",
        dailyRate: String(item.dailyRate),
      })),
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  // A product deactivated after it was priced keeps its row, labelled from the list itself.
  const fallback = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of existing?.items ?? []) map.set(item.productId, item.productName);
    return map;
  }, [existing]);
  const labelOf = (id: string, variant: string) => {
    const product = catalogue.find((candidate) => candidate.id === id);
    const name = product?.name ?? fallback.get(id) ?? id;
    const variantName = product?.variants.find((candidate) => candidate.id === variant)?.name;
    return variantName ? `${name} (${variantName})` : name;
  };

  const addRate = () => {
    if (!productId) {
      setAddError("Choose a product");
      return;
    }
    if (picked?.hasVariants && !variantId) {
      setAddError("Choose a variant, or pick the product's own rate from a product without variants");
      return;
    }
    const parsed = amountField("Rate").safeParse(rate);
    if (!parsed.success) {
      setAddError(parsed.error.issues[0]?.message ?? "Enter a rate");
      return;
    }
    if (getValues("items").some((item) => item.productId === productId && item.variantId === variantId)) {
      setAddError("That product already has a rate on this list");
      return;
    }
    append({ productId, variantId, dailyRate: rate });
    setProductId("");
    setVariantId("");
    setRate("");
    setAddError(null);
  };

  const mutation = useMutation({
    mutationFn: (values: FormOutput) => {
      const request = {
        name: values.name,
        defaultDiscountPercent: values.discount,
        active: values.active,
        items: values.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId || undefined,
          dailyRate: item.dailyRate,
        })),
      };
      return existing ? updatePriceList(existing.id, request) : createPriceList(request);
    },
    onSuccess: (list) => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.priceLists });
      queryClient.invalidateQueries({ queryKey: masterDataKeys.customers });
      toast.success(existing ? `${list.name} updated` : `${list.name} added`, {
        description: `${list.defaultDiscountPercent}% off, ${list.items.length} explicit ${
          list.items.length === 1 ? "rate" : "rates"
        }`,
      });
      onClose();
    },
    onError: (error) =>
      setFormError(error instanceof ApiError ? error.message : "Could not save the price list."),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={existing ? "Edit price list" : "New price list"}
      description="Trade rates for verified event planners."
      className="max-w-xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button form={FORM_ID} type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            {existing ? "Save changes" : "Create price list"}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        className="space-y-4"
        noValidate
        onSubmit={handleSubmit((values) => {
          setFormError(null);
          mutation.mutate(values);
        })}
      >
        {formError ? <Alert tone="error" title={formError} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required error={errors.name?.message}>
            {(props) => <Input {...props} {...register("name")} placeholder="Trade" autoFocus />}
          </Field>
          <Field
            label="Default discount (%)"
            required
            error={errors.discount?.message}
            hint="Off the standard rate, for products with no explicit rate below."
          >
            {(props) => <Input {...props} {...register("discount")} inputMode="decimal" placeholder="10" />}
          </Field>
        </div>

        {existing ? (
          <ActiveToggle
            {...register("active")}
            label="Active"
            hint="An inactive list gives nobody trade rates until it is switched back on."
          />
        ) : null}

        <div className="space-y-2">
          <p className="text-xs font-medium">Explicit rates</p>
          <p className="text-xs text-muted-foreground">
            A rate here wins over the default discount. A product with variants is priced per variant.
          </p>

          <div className="flex flex-wrap items-start gap-2">
            <Select
              value={productId}
              onChange={(event) => {
                setProductId(event.target.value);
                setVariantId("");
                setAddError(null);
              }}
              disabled={products.isPending || mutation.isPending}
              aria-label="Product to price"
              className="min-w-0 flex-1"
            >
              <option value="">{products.isPending ? "Loading catalogue" : "Choose a product"}</option>
              {catalogue.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </Select>
            {picked?.hasVariants ? (
              <Select
                value={variantId}
                onChange={(event) => {
                  setVariantId(event.target.value);
                  setAddError(null);
                }}
                disabled={mutation.isPending}
                aria-label="Variant to price"
                className="w-40"
              >
                <option value="">Choose a variant</option>
                {picked.variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.name}
                  </option>
                ))}
              </Select>
            ) : null}
            <Input
              value={rate}
              onChange={(event) => {
                setRate(event.target.value);
                setAddError(null);
              }}
              inputMode="decimal"
              aria-label="Trade rate per day"
              placeholder="Rate / day"
              className="tabular w-28 text-right"
              disabled={mutation.isPending}
            />
            <Button type="button" variant="outline" onClick={addRate} disabled={mutation.isPending}>
              <Plus />
              Add rate
            </Button>
          </div>
          {addError ? <p className="text-xs text-destructive">{addError}</p> : null}

          {fields.length ? (
            <ul className="divide-y divide-border rounded-md border border-border">
              {fields.map((field, index) => {
                const rowError = errors.items?.[index]?.dailyRate?.message;
                const label = labelOf(field.productId, field.variantId);
                const inactive = Boolean(catalogue.length) && !catalogue.some((p) => p.id === field.productId);
                return (
                  <li key={field.id} className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 text-sm">
                        {label}
                        {inactive ? <Badge className="ml-2 align-middle">Inactive</Badge> : null}
                      </span>
                      <Input
                        {...register(`items.${index}.dailyRate`)}
                        inputMode="decimal"
                        aria-label={`Trade rate for ${label}`}
                        aria-invalid={Boolean(rowError)}
                        className="tabular h-8 w-28 text-right"
                        disabled={mutation.isPending}
                      />
                      <span className="text-xs text-muted-foreground">/ day</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => remove(index)}
                        disabled={mutation.isPending}
                        aria-label={`Remove the rate for ${label}`}
                        title="Remove"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    {rowError ? <p className="mt-1 text-right text-xs text-destructive">{rowError}</p> : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No explicit rates: the default discount applies to everything.</p>
          )}
        </div>
      </form>
    </Dialog>
  );
}

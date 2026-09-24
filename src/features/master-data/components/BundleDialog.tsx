"use client";

import { useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createBundle,
  listProducts,
  masterDataKeys,
  updateBundle,
} from "@/features/master-data/api";
import { addBundleComponent } from "@/features/master-data/bundles";
import type { BundleView } from "@/features/master-data/types";
import { ApiError } from "@/services/api-client";
import { amountField, positiveIntegerField } from "@/lib/forms";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

const FORM_ID = "bundle-form";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150, "Maximum 150 characters"),
  rentalRate: amountField("Rental rate"),
  components: z
    .array(z.object({ productId: z.string(), quantity: positiveIntegerField("Quantity") }))
    .min(1, "A bundle needs at least one product"),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

/** The add row's quantity, checked the same way as a component's. */
const addQuantity = positiveIntegerField("Quantity");

/**
 * Add or edit one bundle: its name, its own rental rate, and the existing
 * products it packages with a quantity each.
 *
 * Picking a product the bundle already contains adds to that line's quantity
 * instead of creating a second line — the rule lives in addBundleComponent.
 * Removing a line takes the product out of this bundle only.
 */
export function BundleDialog({
  existing,
  onClose,
}: {
  existing?: BundleView;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [pickProductId, setPickProductId] = useState("");
  const [pickQuantity, setPickQuantity] = useState("1");
  const [pickError, setPickError] = useState<string | null>(null);

  const products = useQuery({
    queryKey: masterDataKeys.products,
    queryFn: ({ signal }) => listProducts(signal),
  });

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
      rentalRate: existing ? String(Number(existing.rentalRate.amount)) : "",
      components: (existing?.components ?? []).map((component) => ({
        productId: component.productId,
        quantity: String(component.quantity),
      })),
    },
  });

  const { fields, remove, replace } = useFieldArray({ control, name: "components" });
  const watched = useWatch({ control, name: "components" });

  // The catalogue lists active products only; a product deactivated after it
  // joined the bundle is labelled from the bundle's own copy instead.
  const labels = useMemo(() => {
    const map = new Map<string, { name: string; sku: string; active: boolean }>();
    for (const component of existing?.components ?? []) {
      map.set(component.productId, {
        name: component.productName,
        sku: component.sku,
        active: component.active,
      });
    }
    for (const product of products.data ?? []) {
      map.set(product.id, { name: product.name, sku: product.sku, active: true });
    }
    return map;
  }, [existing, products.data]);

  const addPicked = () => {
    if (!pickProductId) {
      setPickError("Choose a product");
      return;
    }
    const parsed = addQuantity.safeParse(pickQuantity);
    if (!parsed.success) {
      setPickError(parsed.error.issues[0]?.message ?? "Enter a quantity");
      return;
    }
    // Merged on the current form values, so a quantity already typed into an
    // existing line is what gets added to. A line whose own quantity is not a
    // number yet is treated as zero rather than blocking the add.
    const current = getValues("components").map((component) => ({
      productId: component.productId,
      quantity: /^\d+$/.test(component.quantity.trim()) ? Number(component.quantity) : 0,
    }));
    const merged = addBundleComponent(current, pickProductId, parsed.data);
    replace(merged.map((component) => ({ ...component, quantity: String(component.quantity) })));
    setPickError(null);
    setPickProductId("");
    setPickQuantity("1");
  };

  const mutation = useMutation({
    mutationFn: (values: FormOutput) => {
      const request = {
        name: values.name,
        rentalRate: values.rentalRate,
        components: values.components,
      };
      return existing ? updateBundle(existing.id, request) : createBundle(request);
    },
    onSuccess: (bundle) => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.bundles });
      toast.success(existing ? `${bundle.name} updated` : `${bundle.name} added`, {
        description: `${bundle.components.length} ${
          bundle.components.length === 1 ? "product" : "products"
        }`,
      });
      onClose();
    },
    onError: (error) =>
      setFormError(error instanceof ApiError ? error.message : "Could not save the bundle."),
  });

  const componentsError = errors.components?.root?.message ?? errors.components?.message;
  const inBundle = new Set((watched ?? []).map((component) => component.productId));

  return (
    <Dialog
      open
      onClose={onClose}
      title={existing ? "Edit bundle" : "New bundle"}
      description="A pre-priced group of products, quoted as a single line."
      className="max-w-xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button form={FORM_ID} type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            {existing ? "Save changes" : "Create bundle"}
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
            {(props) => (
              <Input
                {...props}
                {...register("name")}
                placeholder="Wedding Mandap Set"
                autoFocus
              />
            )}
          </Field>

          <Field label="Rental rate" required error={errors.rentalRate?.message} hint="In INR.">
            {(props) => (
              <Input
                {...props}
                {...register("rentalRate")}
                inputMode="decimal"
                placeholder="28000.00"
              />
            )}
          </Field>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium">
            Products
            <span className="ml-0.5 text-destructive">*</span>
          </p>

          <div className="flex items-start gap-2">
            <Select
              value={pickProductId}
              onChange={(event) => {
                setPickProductId(event.target.value);
                setPickError(null);
              }}
              disabled={products.isPending || mutation.isPending}
              aria-label="Product to add"
              className="min-w-0 flex-1"
            >
              <option value="">{products.isPending ? "Loading catalogue" : "Choose a product"}</option>
              {(products.data ?? []).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                  {inBundle.has(product.id) ? " (in bundle)" : ""}
                </option>
              ))}
            </Select>
            <Input
              value={pickQuantity}
              onChange={(event) => {
                setPickQuantity(event.target.value);
                setPickError(null);
              }}
              inputMode="numeric"
              aria-label="Quantity to add"
              className="tabular w-20 text-right"
              disabled={mutation.isPending}
            />
            <Button
              type="button"
              variant="outline"
              onClick={addPicked}
              disabled={mutation.isPending}
            >
              <Plus />
              Add
            </Button>
          </div>
          {pickError ? <p className="text-xs text-destructive">{pickError}</p> : null}

          {fields.length ? (
            <ul className="divide-y divide-border rounded-md border border-border">
              {fields.map((field, index) => {
                const label = labels.get(field.productId);
                const rowError = errors.components?.[index]?.quantity?.message;
                return (
                  <li key={field.id} className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-sm">{label?.name ?? field.productId}</span>
                        {label ? (
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {label.sku}
                          </span>
                        ) : null}
                        {label && !label.active ? (
                          <Badge className="ml-2 align-middle">Inactive</Badge>
                        ) : null}
                      </div>
                      <span className="text-xs text-muted-foreground">×</span>
                      <Input
                        {...register(`components.${index}.quantity`)}
                        inputMode="numeric"
                        aria-label={`Quantity of ${label?.name ?? "product"}`}
                        aria-invalid={Boolean(rowError)}
                        className="tabular h-8 w-20 text-right"
                        disabled={mutation.isPending}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => remove(index)}
                        disabled={mutation.isPending}
                        aria-label={`Remove ${label?.name ?? "product"} from this bundle`}
                        title="Remove from bundle"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    {rowError ? (
                      <p className="mt-1 text-right text-xs text-destructive">{rowError}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {componentsError ? <p className="text-xs text-destructive">{componentsError}</p> : null}
        </div>
      </form>
    </Dialog>
  );
}

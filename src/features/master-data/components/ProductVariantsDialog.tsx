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
  listProducts,
  masterDataKeys,
  updateProductVariant,
} from "@/features/master-data/api";
import type { ProductVariantView, ProductView } from "@/features/master-data/types";
import { useCan } from "@/features/auth";
import { ApiError } from "@/services/api-client";
import { amountField } from "@/lib/forms";
import { formatMoney } from "@/lib/money";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

/**
 * The form for one variant. Mounted per open, keyed by the variant, so opening
 * it is what loads its values — the same reason the other dialogs mount on
 * demand. New variants start from the product's own rates, since most
 * versions of a product cost the same.
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
        <Field
          label="Wholesale rate"
          required
          error={errors.wholesaleRate?.message}
          hint="Per day, in INR."
        >
          {(props) => (
            <Input {...props} {...register("wholesaleRate")} inputMode="decimal" />
          )}
        </Field>
        <Field
          label="Retail rate"
          required
          error={errors.retailRate?.message}
          hint="Per day, in INR."
        >
          {(props) => <Input {...props} {...register("retailRate")} inputMode="decimal" />}
        </Field>
      </div>
    </form>
  );
}

/**
 * Lists and manages the variants of one product that has hasVariants set.
 *
 * The list, the add/edit form and the delete confirmation swap inside this one
 * dialog rather than stacking a second on top, because Dialog closes on Escape
 * at the document level and two open at once would both close.
 *
 * Stock is shown, not edited: it is added per variant from a warehouse.
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
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [formError, setFormError] = useState<string | null>(null);

  // Read back from the catalogue query so the list reflects each save; the
  // product passed in is only the starting point.
  const products = useQuery({
    queryKey: masterDataKeys.products,
    queryFn: ({ signal }) => listProducts(signal),
  });
  const product = products.data?.find((candidate) => candidate.id === initial.id) ?? initial;

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
      toast.success(previous ? `${variant.name} updated` : `${variant.name} added`, {
        description: product.name,
      });
      back();
    },
    onError: (error) =>
      setFormError(error instanceof ApiError ? error.message : "Could not save the variant."),
  });

  const remove = useMutation({
    mutationFn: (variant: ProductVariantView) => deleteProductVariant(product.id, variant.id),
    onSuccess: (_, variant) => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.products });
      toast.success(`${variant.name} deleted`, { description: product.name });
      back();
    },
    onError: (error) =>
      setFormError(error instanceof ApiError ? error.message : "Could not delete the variant."),
  });

  const pending = save.isPending || remove.isPending;

  const footer =
    mode.kind === "form" ? (
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
        <Button
          variant="destructive"
          onClick={() => remove.mutate(mode.variant)}
          disabled={pending}
        >
          {remove.isPending ? <Loader2 className="animate-spin" /> : null}
          Delete variant
        </Button>
      </>
    ) : (
      <>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        {canWrite ? (
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
        mode.kind === "form"
          ? mode.variant
            ? `Edit ${mode.variant.name}`
            : `New variant of ${product.name}`
          : `${product.name} variants`
      }
      description={`SKU ${product.sku}`}
      className="max-w-xl"
      footer={footer}
    >
      <div className="space-y-4">
        {formError ? <Alert tone="error" title={formError} /> : null}

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
            Delete <span className="font-medium">{mode.variant.name}</span>? {product.name} and
            its other variants are not affected.
          </p>
        ) : null}

        {mode.kind === "list" ? (
          <div className="overflow-hidden rounded-md border border-border">
            <TableWrapper>
              <Table>
                <THead>
                  <tr>
                    <TH>Variant</TH>
                    <TH className="text-right">Wholesale rate</TH>
                    <TH className="text-right">Retail rate</TH>
                    <TH className="text-right">Stock</TH>
                    {canWrite ? <TH className="text-right">Actions</TH> : null}
                  </tr>
                </THead>
                <TBody>
                  {product.variants.map((variant) => (
                    <TR key={variant.id}>
                      <TD className="font-medium">{variant.name}</TD>
                      <TD className="tabular text-right">{formatMoney(variant.wholesaleRate)}</TD>
                      <TD className="tabular text-right">{formatMoney(variant.retailRate)}</TD>
                      <TD className="tabular text-right">{variant.stock}</TD>
                      {canWrite ? (
                        <TD>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setMode({ kind: "form", variant })}
                              aria-label={`Edit ${variant.name}`}
                              title="Edit"
                            >
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setMode({ kind: "delete", variant })}
                              aria-label={`Delete ${variant.name}`}
                              title="Delete"
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </TD>
                      ) : null}
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrapper>

            {!product.variants.length ? (
              <EmptyState icon={<Layers />} title="No variants yet" />
            ) : null}
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}

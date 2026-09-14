"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createProduct, masterDataKeys } from "@/features/master-data/api";
import { ApiError } from "@/services/api-client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Amounts are kept as strings through validation and converted at the edge.
 * A number input bound straight to z.coerce.number() turns an empty field into
 * a legitimate 0, which would quietly create a free product; requiring the
 * string first makes "blank" and "zero" different answers. The two-decimal rule
 * matches the numeric(19,2) column, so an over-precise rate is rejected here
 * rather than silently rounded by the database.
 */
const amount = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .regex(/^\d+(\.\d{1,2})?$/, "Enter an amount like 1500 or 1500.50")
    .transform(Number);

const schema = z.object({
  sku: z.string().trim().min(1, "SKU is required").max(60, "Maximum 60 characters"),
  name: z.string().trim().min(1, "Name is required").max(200, "Maximum 200 characters"),
  description: z.string().trim().max(2000, "Maximum 2000 characters").optional(),
  categoryId: z
    .string()
    .trim()
    .refine((value) => value === "" || UUID_PATTERN.test(value), "Must be a valid UUID")
    .transform((value) => (value === "" ? undefined : value)),
  rentalRate: amount("Rental rate"),
  securityDeposit: amount("Security deposit"),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const EMPTY: FormInput = {
  sku: "",
  name: "",
  description: "",
  categoryId: "",
  rentalRate: "",
  securityDeposit: "",
};

/**
 * Mounted only while it is open, so opening it is what resets it. An always
 * mounted dialog would need an effect to clear the previous attempt's fields
 * and error, which is a cascading render for something a fresh mount does for
 * free.
 */
export function CreateProductDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  const mutation = useMutation({
    mutationFn: createProduct,
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.products });
      toast.success(`${product.name} added`, { description: `SKU ${product.sku}` });
      onClose();
    },
    onError: (error) => {
      // A 422 here is almost always the duplicate-SKU rule, and the backend's
      // message names the offending SKU, so it is shown verbatim.
      setFormError(error instanceof ApiError ? error.message : "Could not save the product.");
    },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    mutation.mutate(values);
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="New product"
      description="Added to this company's catalogue and immediately active."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button form="create-product" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            Create product
          </Button>
        </>
      }
    >
      <form id="create-product" onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError ? <Alert tone="error" title={formError} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SKU" required error={errors.sku?.message} hint="Unique per company.">
            {(props) => <Input {...props} {...register("sku")} placeholder="TENT-20X40" />}
          </Field>

          <Field label="Name" required error={errors.name?.message}>
            {(props) => <Input {...props} {...register("name")} placeholder="20x40 Frame Tent" />}
          </Field>
        </div>

        <Field label="Description" error={errors.description?.message}>
          {(props) => (
            <Textarea {...props} {...register("description")} placeholder="Optional details" />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Rental rate"
            required
            error={errors.rentalRate?.message}
            hint="Per day, in INR."
          >
            {(props) => (
              <Input {...props} {...register("rentalRate")} inputMode="decimal" placeholder="1500.00" />
            )}
          </Field>

          <Field
            label="Security deposit"
            required
            error={errors.securityDeposit?.message}
            hint="In INR. Enter 0 if none."
          >
            {(props) => (
              <Input
                {...props}
                {...register("securityDeposit")}
                inputMode="decimal"
                placeholder="0.00"
              />
            )}
          </Field>
        </div>

        <Field
          label="Category ID"
          error={errors.categoryId?.message}
          hint="Optional. A picker needs a category list endpoint, which the backend does not expose yet — see the note on the products page."
        >
          {(props) => (
            <Input {...props} {...register("categoryId")} placeholder="00000000-0000-0000-0000-000000000000" />
          )}
        </Field>
      </form>
    </Dialog>
  );
}

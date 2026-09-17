"use client";

import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
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
import type { BundleView } from "@/features/master-data/types";
import { ApiError } from "@/services/api-client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

const FORM_ID = "bundle-form";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150, "Maximum 150 characters"),
  rentalRate: z
    .string()
    .trim()
    .min(1, "Rental rate is required")
    .regex(/^\d+(\.\d{1,2})?$/, "Enter an amount like 28000 or 28000.50")
    .transform(Number),
  contents: z
    .array(z.object({ name: z.string().trim().min(1, "Choose a product") }))
    .min(1, "A bundle needs at least one product"),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

/**
 * Add or edit one bundle.
 *
 * Contents are product *names*, not ids, because BundleView has no line entity
 * to hold an id — the shape was invented for a module with no backend and kept
 * minimal. They are still picked from the catalogue rather than typed, so the
 * names at least match real products; a bundle built before a product was
 * renamed will quietly disagree with it, which is one of the things whoever
 * designs the real table will need to fix.
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

  const products = useQuery({
    queryKey: masterDataKeys.products,
    queryFn: ({ signal }) => listProducts(signal),
  });

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: existing?.name ?? "",
      rentalRate: existing ? String(Number(existing.rentalRate.amount)) : "",
      contents: existing?.contents.length
        ? existing.contents.map((name) => ({ name }))
        : [{ name: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "contents" });

  const mutation = useMutation({
    mutationFn: (values: FormOutput) => {
      const request = {
        name: values.name,
        rentalRate: values.rentalRate,
        contents: values.contents.map((entry) => entry.name),
      };
      return existing ? updateBundle(existing.id, request) : createBundle(request);
    },
    onSuccess: (bundle) => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.bundles });
      toast.success(existing ? `${bundle.name} updated` : `${bundle.name} added`, {
        description: `${bundle.contents.length} ${
          bundle.contents.length === 1 ? "product" : "products"
        }`,
      });
      onClose();
    },
    onError: (error) =>
      setFormError(error instanceof ApiError ? error.message : "Could not save the bundle."),
  });

  const contentsError = errors.contents?.root?.message ?? errors.contents?.message;

  return (
    <Dialog
      open
      onClose={onClose}
      title={existing ? "Edit bundle" : "New bundle"}
      description="A pre-priced group of products, quoted as a single line."
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
          <Field label="Name" required error={errors.name?.message} hint="Unique per company.">
            {(props) => (
              <Input
                {...props}
                {...register("name")}
                placeholder="Wedding Mandap Set"
                autoFocus
              />
            )}
          </Field>

          <Field
            label="Rental rate"
            required
            error={errors.rentalRate?.message}
            hint="In INR. Not derived from the products it contains."
          >
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
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium">Contents</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={mutation.isPending}
              onClick={() => append({ name: "" })}
            >
              <Plus />
              Add product
            </Button>
          </div>

          {fields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <Select
                  {...register(`contents.${index}.name`)}
                  aria-label={`Product ${index + 1}`}
                  aria-invalid={Boolean(errors.contents?.[index]?.name)}
                  disabled={products.isPending || mutation.isPending}
                >
                  <option value="">
                    {products.isPending ? "Loading catalogue" : "Choose a product"}
                  </option>
                  {(products.data ?? []).map((product) => (
                    <option key={product.id} value={product.name}>
                      {product.name}
                    </option>
                  ))}
                  {/* A bundle saved earlier may name a product that has since
                      been renamed or retired; keeping it as an option stops the
                      select silently blanking it on open. */}
                  {field.name && !(products.data ?? []).some((p) => p.name === field.name) ? (
                    <option value={field.name}>{field.name}</option>
                  ) : null}
                </Select>
                {errors.contents?.[index]?.name ? (
                  <p className="mt-1 text-xs text-destructive">
                    {errors.contents[index]?.name?.message}
                  </p>
                ) : null}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={fields.length === 1 || mutation.isPending}
                onClick={() => remove(index)}
                aria-label={`Remove product ${index + 1}`}
                title={fields.length === 1 ? "A bundle needs at least one product" : "Remove"}
              >
                <Trash2 />
              </Button>
            </div>
          ))}

          {contentsError ? <p className="text-xs text-destructive">{contentsError}</p> : null}
        </div>
      </form>
    </Dialog>
  );
}

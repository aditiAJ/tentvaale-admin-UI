"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  createProduct,
  listCategories,
  masterDataKeys,
  updateProduct,
} from "@/features/master-data/api";
import type { CategoryView, ProductMedia, ProductView } from "@/features/master-data/types";
import { ProductMediaField } from "@/features/master-data/components/ProductMediaField";
import { ApiError } from "@/services/api-client";
import { amountField } from "@/lib/forms";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

const FORM_ID = "product-form";

const schema = z.object({
  sku: z.string().trim().min(1, "SKU is required").max(60, "Maximum 60 characters"),
  skuOwner: z
    .string()
    .trim()
    .min(1, "SKU owner is required")
    .max(150, "Maximum 150 characters"),
  name: z.string().trim().min(1, "Name is required").max(200, "Maximum 200 characters"),
  genericName: z
    .string()
    .trim()
    .min(1, "Generic name is required")
    .max(100, "Maximum 100 characters"),
  description: z.string().trim().max(2000, "Maximum 2000 characters").optional(),
  wholesaleRate: amountField("Wholesale rate"),
  retailRate: amountField("Retail rate"),
  // The message is given for a missing value too: a disabled select can
  // submit nothing at all rather than "".
  categoryId: z.string({ error: "Choose a category" }).min(1, "Choose a category"),
  subCategoryId: z.string({ error: "Choose a sub-category" }).min(1, "Choose a sub-category"),
  tag: z.string().trim().min(1, "Tag is required").max(60, "Maximum 60 characters"),
  // A select's value is a string, so Yes/No travel as text and become the
  // boolean the product stores only once they leave the form.
  hasVariants: z.enum(["yes", "no"]).transform((value) => value === "yes"),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

/** Money comes back as a number or a numeric string; the form wants "1500". */
const amountText = (amount: number | string) => String(Number(amount));

/**
 * One dialog for both adding and editing, keyed on whether `existing` is given,
 * for the same reason WarehouseDialog is.
 *
 * Mounted only while it is open, so opening it is what resets it. An always
 * mounted dialog would need an effect to clear the previous attempt's fields
 * and error, which is a cascading render for something a fresh mount does for
 * free.
 */
export function ProductDialog({
  existing,
  onClose,
}: {
  existing?: ProductView;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [media, setMedia] = useState<ProductMedia[]>(existing?.media ?? []);
  const [mediaBusy, setMediaBusy] = useState(false);

  const categories = useQuery({
    queryKey: masterDataKeys.categories,
    queryFn: ({ signal }) => listCategories(signal),
  });

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      sku: existing?.sku ?? "",
      skuOwner: existing?.skuOwner ?? "",
      name: existing?.name ?? "",
      genericName: existing?.genericName ?? "",
      description: existing?.description ?? "",
      wholesaleRate: existing ? amountText(existing.wholesaleRate.amount) : "",
      retailRate: existing ? amountText(existing.retailRate.amount) : "",
      categoryId: existing?.categoryId ?? "",
      subCategoryId: existing?.subCategoryId ?? "",
      tag: existing?.tag ?? "",
      // No, unless the product already says otherwise: most catalogue items
      // come in one version, so that is the answer that saves a click.
      hasVariants: existing?.hasVariants ? "yes" : "no",
    },
  });

  // The list returns active categories only. A product already filed under a
  // category that has since been deactivated keeps it as an option — the mock
  // accepts it unchanged — rather than having the picker silently reset it.
  const categoryOptions = useMemo(() => {
    const list: CategoryView[] = [...(categories.data ?? [])];
    if (
      existing?.categoryId &&
      categories.data &&
      !list.some((category) => category.id === existing.categoryId)
    ) {
      list.push({
        id: existing.categoryId,
        companyId: existing.companyId,
        name: existing.categoryName ?? existing.categoryId,
        active: false,
        subCategories: existing.subCategoryId
          ? [
              {
                id: existing.subCategoryId,
                companyId: existing.companyId,
                categoryId: existing.categoryId,
                name: existing.subCategoryName ?? existing.subCategoryId,
              },
            ]
          : [],
      });
    }
    return list;
  }, [categories.data, existing]);

  const selectedCategoryId = useWatch({ control, name: "categoryId" });
  const subCategoryOptions =
    categoryOptions.find((category) => category.id === selectedCategoryId)?.subCategories ?? [];

  const mutation = useMutation({
    mutationFn: (values: FormOutput) => {
      const request = { ...values, media };
      return existing ? updateProduct(existing.id, request) : createProduct(request);
    },
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.products });
      // Collections and bundles show each product's name (and collections its image).
      queryClient.invalidateQueries({ queryKey: masterDataKeys.featuredCollections });
      queryClient.invalidateQueries({ queryKey: masterDataKeys.bundles });
      toast.success(existing ? `${product.name} updated` : `${product.name} added`, {
        description: `SKU ${product.sku}`,
      });
      onClose();
    },
    onError: (error) => {
      // A 422 here is almost always the duplicate-SKU rule, and the backend's
      // message names the offending SKU, so it is shown verbatim.
      setFormError(error instanceof ApiError ? error.message : "Could not save the product.");
    },
  });

  const onSubmit = handleSubmit((values) => {
    // Enter in a text field submits even while the button is disabled, and a
    // save now would drop the files still being prepared.
    if (mediaBusy) return;
    setFormError(null);
    mutation.mutate(values);
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={existing ? "Edit product" : "New product"}
      description={
        existing
          ? `SKU ${existing.sku}`
          : "Added to this company's catalogue and immediately active."
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button form={FORM_ID} type="submit" disabled={mutation.isPending || mediaBusy}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            {existing ? "Save changes" : "Create product"}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError ? <Alert tone="error" title={formError} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SKU" required error={errors.sku?.message}>
            {(props) => <Input {...props} {...register("sku")} placeholder="TENT-20X40" />}
          </Field>

          <Field label="SKU owner" required error={errors.skuOwner?.message}>
            {(props) => <Input {...props} {...register("skuOwner")} placeholder="Tentvaale" />}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required error={errors.name?.message}>
            {(props) => <Input {...props} {...register("name")} placeholder="20x40 Frame Tent" />}
          </Field>

          <Field label="Generic name" required error={errors.genericName?.message}>
            {(props) => <Input {...props} {...register("genericName")} placeholder="Frame Tent" />}
          </Field>
        </div>

        <Field label="Description" error={errors.description?.message}>
          {(props) => (
            <Textarea {...props} {...register("description")} placeholder="Optional details" />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Wholesale rate"
            required
            error={errors.wholesaleRate?.message}
            hint="Per day, in INR."
          >
            {(props) => (
              <Input
                {...props}
                {...register("wholesaleRate")}
                inputMode="decimal"
                placeholder="1200.00"
              />
            )}
          </Field>

          <Field
            label="Retail rate"
            required
            error={errors.retailRate?.message}
            hint="Per day, in INR."
          >
            {(props) => (
              <Input
                {...props}
                {...register("retailRate")}
                inputMode="decimal"
                placeholder="1500.00"
              />
            )}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tag" required error={errors.tag?.message}>
            {(props) => <Input {...props} {...register("tag")} placeholder="Furniture" />}
          </Field>

          <Field label="Has variants?" required error={errors.hasVariants?.message}>
            {(props) => (
              <Select {...props} {...register("hasVariants")}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </Select>
            )}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" required error={errors.categoryId?.message}>
            {(props) => (
              <Select
                {...props}
                {...register("categoryId", {
                  // A sub-category belongs to one category, so a new category
                  // means choosing its sub-category afresh.
                  onChange: () => setValue("subCategoryId", ""),
                })}
                disabled={categories.isPending}
              >
                <option value="">
                  {categories.isPending ? "Loading categories" : "Choose a category"}
                </option>
                {categoryOptions.map((category) => (
                  // A category with no sub-categories cannot take a product
                  // yet; it stays visible so it is clear why.
                  <option
                    key={category.id}
                    value={category.id}
                    disabled={!category.subCategories.length}
                  >
                    {category.name}
                    {category.subCategories.length ? "" : " (no sub-categories)"}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Sub-category" required error={errors.subCategoryId?.message}>
            {(props) => (
              <Select
                {...props}
                {...register("subCategoryId")}
                disabled={!subCategoryOptions.length}
              >
                <option value="">
                  {selectedCategoryId ? "Choose a sub-category" : "Choose a category first"}
                </option>
                {subCategoryOptions.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <ProductMediaField
          media={media}
          onChange={setMedia}
          onBusyChange={setMediaBusy}
          disabled={mutation.isPending}
        />
      </form>
    </Dialog>
  );
}

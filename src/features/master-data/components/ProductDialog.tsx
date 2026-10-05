"use client";

import { useMemo, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createProduct,
  listCategories,
  listProducts,
  masterDataKeys,
  updateProduct,
} from "@/features/master-data/api";
import {
  ATTRIBUTE_SUGGESTIONS,
  COLOUR_SUGGESTIONS,
  FABRIC_SUGGESTIONS,
  MATERIAL_SUGGESTIONS,
  MOODS,
  PRODUCT_SETTINGS,
  RATE_TYPE_LABEL,
  RATE_TYPES,
  THEMES,
} from "@/features/master-data/storefront";
import {
  PRODUCT_MEDIA_LIMITS,
  type CategoryView,
  type MediaAsset,
  type ProductView,
} from "@/features/master-data/types";
import { MediaField } from "@/features/master-data/components/MediaField";
import { ApiError } from "@/services/api-client";
import { amountField } from "@/lib/forms";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { TagInput, ToggleChips } from "@/components/ui/tag-input";

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

  // Storefront details. Lists are edited as chips and arrive already trimmed.
  rateType: z.enum(RATE_TYPES),
  size: z.string().trim().max(80, "Maximum 80 characters"),
  // "" is "not said"; the product stores null for it.
  setting: z.enum(["", ...PRODUCT_SETTINGS]),
  colours: z.array(z.string()).max(12, "At most 12 colours"),
  materials: z.array(z.string()).max(12, "At most 12 materials"),
  fabrics: z.array(z.string()).max(12, "At most 12 fabrics"),
  moods: z.array(z.string()),
  themes: z.array(z.string()),
  attributes: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Name the specification").max(60, "Maximum 60 characters"),
        value: z.string().trim().min(1, "Give it a value").max(120, "Maximum 120 characters"),
      }),
    )
    .max(12, "At most 12 specifications")
    // Flagged on the later duplicate, so the first reads as the original.
    .superRefine((rows, ctx) => {
      const seen = new Set<string>();
      rows.forEach((row, index) => {
        const key = row.name.trim().toLowerCase();
        if (key && seen.has(key)) {
          ctx.addIssue({ code: "custom", path: [index, "name"], message: "Already listed" });
        }
        seen.add(key);
      });
    }),
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
  const [media, setMedia] = useState<MediaAsset[]>(existing?.media ?? []);
  const [mediaBusy, setMediaBusy] = useState(false);

  const categories = useQuery({
    queryKey: masterDataKeys.categories,
    queryFn: ({ signal }) => listCategories(signal),
  });
  // Only for suggesting specification names other products already use.
  const products = useQuery({
    queryKey: masterDataKeys.products,
    queryFn: ({ signal }) => listProducts(signal),
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
      // Every storefront detail may be absent — always so in api mode, where
      // the backend does not know them — so each falls back to empty.
      rateType: existing?.rateType ?? "Qty",
      size: existing?.size ?? "",
      setting: existing?.setting ?? "",
      colours: existing?.colours ?? [],
      materials: existing?.materials ?? [],
      fabrics: existing?.fabrics ?? [],
      moods: existing?.moods ?? [],
      themes: existing?.themes ?? [],
      attributes: Object.entries(existing?.attributes ?? {}).map(([name, value]) => ({
        name,
        value,
      })),
    },
  });

  const attributeRows = useFieldArray({ control, name: "attributes" });

  // Only active categories can take a product. One already filed under a
  // category that has since been deactivated keeps it as an option, rather
  // than having the picker silently reset it.
  const categoryOptions = useMemo(() => {
    const list: CategoryView[] = (categories.data ?? []).filter(
      (category) => category.active || category.id === existing?.categoryId,
    );
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
        media: [],
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

  // Names other products in the same category use come first, since those are
  // what this kind of product most likely needs; then the storefront's own.
  const attributeNames = useMemo(() => {
    const inCategory = (products.data ?? [])
      .filter((product) => product.categoryId === selectedCategoryId && product.id !== existing?.id)
      .flatMap((product) => Object.keys(product.attributes ?? {}));
    return [...new Set([...inCategory, ...ATTRIBUTE_SUGGESTIONS])];
  }, [products.data, selectedCategoryId, existing?.id]);

  const mutation = useMutation({
    mutationFn: (values: FormOutput) => {
      const request = {
        ...values,
        size: values.size || null,
        setting: values.setting || null,
        attributes: Object.fromEntries(values.attributes.map((row) => [row.name, row.value])),
        media,
      };
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
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" required error={errors.categoryId?.message}>
            {(props) => (
              <Select
                // Remounted once the categories arrive: a select given its
                // value before its options exist shows the placeholder, and a
                // fresh mount is what makes react-hook-form set it again. Kept
                // ahead of the spread, which React requires of a key.
                key={categories.isPending ? "loading" : "ready"}
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
                key={categories.isPending ? "loading" : "ready"}
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

        <div className="space-y-4 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Storefront details</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rate counted" required error={errors.rateType?.message}>
              {(props) => (
                <Select {...props} {...register("rateType")}>
                  {RATE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {RATE_TYPE_LABEL[type]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Indoor / outdoor" error={errors.setting?.message}>
              {(props) => (
                <Select {...props} {...register("setting")}>
                  <option value="">Not specified</option>
                  {PRODUCT_SETTINGS.map((setting) => (
                    <option key={setting} value={setting}>
                      {setting}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <Field label="Size" error={errors.size?.message}>
            {(props) => <Input {...props} {...register("size")} placeholder="40 × 45 × 92 cm" />}
          </Field>

          {(
            [
              ["colours", "Colours", COLOUR_SUGGESTIONS, "Gold, Ivory"],
              ["materials", "Materials", MATERIAL_SUGGESTIONS, "Teak, Brass"],
              ["fabrics", "Upholstery fabrics", FABRIC_SUGGESTIONS, "Velvet, Satin"],
            ] as const
          ).map(([name, label, suggestions, placeholder]) => (
            <Field key={name} label={label} error={errors[name]?.message}>
              {(props) => (
                <Controller
                  control={control}
                  name={name}
                  render={({ field }) => (
                    <TagInput
                      {...props}
                      value={field.value}
                      onChange={field.onChange}
                      suggestions={suggestions}
                      placeholder={placeholder}
                      disabled={mutation.isPending}
                    />
                  )}
                />
              )}
            </Field>
          ))}

          {(
            [
              ["moods", "Mood", MOODS],
              ["themes", "Theme fit", THEMES],
            ] as const
          ).map(([name, label, options]) => (
            <Field key={name} label={label} error={errors[name]?.message}>
              {(props) => (
                <Controller
                  control={control}
                  name={name}
                  render={({ field }) => (
                    <ToggleChips
                      id={props.id}
                      aria-label={label}
                      options={options}
                      value={field.value}
                      onChange={field.onChange}
                      disabled={mutation.isPending}
                    />
                  )}
                />
              )}
            </Field>
          ))}

          <div className="space-y-2">
            <p className="text-xs font-medium">Specifications</p>
            <datalist id="product-attribute-names">
              {attributeNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {attributeRows.fields.map((row, index) => {
              const rowErrors = errors.attributes?.[index];
              const rowError = rowErrors?.name?.message ?? rowErrors?.value?.message;
              return (
                <div key={row.id}>
                  <div className="flex items-center gap-2">
                    <Input
                      {...register(`attributes.${index}.name`)}
                      list="product-attribute-names"
                      aria-label={`Specification ${index + 1} name`}
                      aria-invalid={Boolean(rowErrors?.name)}
                      placeholder="Seating capacity"
                      disabled={mutation.isPending}
                    />
                    <Input
                      {...register(`attributes.${index}.value`)}
                      aria-label={`Specification ${index + 1} value`}
                      aria-invalid={Boolean(rowErrors?.value)}
                      placeholder="2"
                      disabled={mutation.isPending}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => attributeRows.remove(index)}
                      disabled={mutation.isPending}
                      aria-label={`Remove specification ${index + 1}`}
                      title="Remove"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  {rowError ? <p className="mt-1 text-xs text-destructive">{rowError}</p> : null}
                </div>
              );
            })}
            {errors.attributes?.root?.message ? (
              <p className="text-xs text-destructive">{errors.attributes.root.message}</p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => attributeRows.append({ name: "", value: "" })}
              disabled={mutation.isPending || attributeRows.fields.length >= 12}
            >
              <Plus />
              Add specification
            </Button>
          </div>
        </div>

        <MediaField
          media={media}
          limits={PRODUCT_MEDIA_LIMITS}
          onChange={setMedia}
          onBusyChange={setMediaBusy}
          disabled={mutation.isPending}
        />
      </form>
    </Dialog>
  );
}

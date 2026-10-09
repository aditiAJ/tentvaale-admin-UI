"use client";

import { useMemo, useState } from "react";
import { Controller, FormProvider, useFieldArray, useForm, useWatch, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createProduct,
  getStockGrid,
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
  DIMENSION_UNITS,
  PRODUCT_MEDIA_LIMITS,
  type CategoryView,
  type DimensionUnit,
  type MediaAsset,
  type ProductView,
  type StockGrid,
} from "@/features/master-data/types";
import { getCompany, settingsKeys } from "@/features/settings/api";
import { MediaField } from "@/features/master-data/components/MediaField";
import {
  ProductVariantsStep,
  StockFields,
  blankStockLine,
  blankVariant,
  checkVariantStep,
  stockLineUsed,
  variantFilled,
  variantStepShape,
} from "@/features/master-data/components/ProductVariantsStep";
import { ApiError } from "@/services/api-client";
import { amountField } from "@/lib/forms";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { TagInput, ToggleChips } from "@/components/ui/tag-input";

const FORM_ID = "product-form";
const DEFAULT_SKU_OWNER = "Tentvaale";

/** A side of the product: empty (does not apply) or a number above zero. */
const dimensionField = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || (Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 100000),
    "Enter a number above 0",
  );

const schema = z.object({
  // Who owns the stock behind the SKU. Left empty it is Tentvaale; the SKU itself is numbered by the system.
  skuOwner: z
    .string()
    .trim()
    .max(150, "Maximum 150 characters")
    .transform((value) => value || DEFAULT_SKU_OWNER),
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
  // The product's stock (step 1) and its variants with their own stock (step 2).
  ...variantStepShape,

  // Storefront details. Lists are edited as chips and arrive already trimmed.
  rateType: z.enum(RATE_TYPES),
  // The product's real size: three sides and one unit, kept as text while typed.
  length: dimensionField,
  width: dimensionField,
  height: dimensionField,
  dimensionUnit: z.enum(DIMENSION_UNITS),
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
}).superRefine(checkVariantStep);

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;
type FieldName = keyof FormInput;

/**
 * The three steps, and the fields each one owns. Next validates only its own
 * step's fields; a failed save jumps to the first step that has an error.
 */
const STEPS: {
  label: string;
  fields: FieldName[];
}[] = [
  {
    label: "Product details",
    fields: [
      "stock",
      "name",
      "genericName",
      "categoryId",
      "subCategoryId",
      "description",
      "retailRate",
      "wholesaleRate",
      "rateType",
      "skuOwner",
    ],
  },
  {
    label: "Variants & stock",
    fields: ["variants"],
  },
  {
    label: "Storefront details",
    fields: [
      "setting",
      "length",
      "width",
      "height",
      "dimensionUnit",
      "colours",
      "materials",
      "fabrics",
      "moods",
      "themes",
      "attributes",
    ],
  },
  {
    label: "Media",
    fields: [],
  },
];
const LAST_STEP = STEPS.length - 1;

const UNIT_LABEL: Record<DimensionUnit, string> = {
  ft: "Feet",
  in: "Inches",
};

/** Money comes back as a number or a numeric string; the form wants "1500". */
const amountText = (amount: number | string) => String(Number(amount));
const dimensionText = (value: number | null | undefined) => (value == null ? "" : String(Number(value)));

/** Read units, with what to multiply by to get feet or inches (centimetres and metres are converted). */
const LEGACY_UNITS: Record<string, { unit: DimensionUnit; factor: number }> = {
  ft: { unit: "ft", factor: 1 },
  feet: { unit: "ft", factor: 1 },
  foot: { unit: "ft", factor: 1 },
  in: { unit: "in", factor: 1 },
  inch: { unit: "in", factor: 1 },
  inches: { unit: "in", factor: 1 },
  cm: { unit: "in", factor: 1 / 2.54 },
  m: { unit: "ft", factor: 3.28084 },
};

/**
 * Products saved before the size became three fields carry text such as
 * "40 × 45 × 92 cm". Where that reads cleanly it fills the new fields; where
 * it does not, the field stays empty and the text is shown beside them.
 */
function parseLegacySize(text: string | null | undefined) {
  const match = text?.match(
    /^\s*(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)(?:\s*[x×*]\s*(\d+(?:\.\d+)?))?\s*([a-z]+)?\s*$/i,
  );
  if (!match) return null;
  const { unit, factor } = LEGACY_UNITS[(match[4] ?? "").toLowerCase()] ?? { unit: "ft" as DimensionUnit, factor: 1 };
  const convert = (text: string | undefined) => (text ? String(Math.round(Number(text) * factor * 100) / 100) : "");
  return { length: convert(match[1]), width: convert(match[2]), height: convert(match[3]), unit };
}

/** The next system SKU as a preview ("TENT-PRO-021"): the company's code and one past the highest number in use. */
function previewSku(companyCode: string | null | undefined, skus: string[]) {
  const code = companyCode?.trim().toUpperCase();
  if (!code) return null;
  const stem = `${code}-PRO`;
  const pattern = new RegExp(`^${stem}-(\\d{1,9})$`, "i");
  const highest = skus.reduce((max, sku) => Math.max(max, Number(pattern.exec(sku)?.[1] ?? 0)), 0);
  return `${stem}-${String(highest + 1).padStart(3, "0")}`;
}

/** Retail against wholesale: how far below retail the planner rate sits. */
function planRateNote(retail: string, wholesale: string) {
  const r = Number(retail);
  const w = Number(wholesale);
  if (!retail.trim() || !wholesale.trim() || !Number.isFinite(r) || !Number.isFinite(w) || r <= 0) return null;
  if (w > r) return { warn: true, text: "Wholesale is higher than retail. Check the two rates." };
  if (w === r) return { warn: false, text: "Planners pay the same as customers." };
  const off = Math.round(((r - w) / r) * 100);
  return { warn: false, text: `Planners pay ${off}% less than customers.` };
}

/** An input with a fixed symbol inside it: the rupee sign in front of an amount, a unit behind a measurement. */
function AffixInput({
  prefix,
  suffix,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { prefix?: string; suffix?: string }) {
  return (
    <div className="relative">
      {prefix ? (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
          {prefix}
        </span>
      ) : null}
      <Input {...props} className={cn(prefix && "pl-7", suffix && "pr-24", className)} />
      {suffix ? (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

/**
 * One dialog for both adding and editing, keyed on whether `existing` is given,
 * for the same reason WarehouseDialog is.
 *
 * Three steps (product details, storefront details, media) in one form, so a
 * save is still a single request and a failure leaves nothing half-created.
 * Every step stays mounted and the inactive ones are hidden, which keeps what
 * was typed without having to copy it anywhere.
 *
 * Mounted only while it is open, so opening it is what resets it. An always
 * mounted dialog would need an effect to clear the previous attempt's fields
 * and error, which is a cascading render for something a fresh mount does for
 * free.
 */
function ProductForm({
  existing,
  grid,
  onClose,
}: {
  existing?: ProductView;
  /** An existing product's stock per variant and warehouse; absent when it could not be loaded. */
  grid?: StockGrid;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaAsset[]>(existing?.media ?? []);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [step, setStep] = useState(0);

  const categories = useQuery({
    queryKey: masterDataKeys.categories,
    queryFn: ({ signal }) => listCategories(signal),
  });
  // The company code the next SKU starts with (TENT-PRO-001).
  const company = useQuery({ queryKey: settingsKeys.company, queryFn: ({ signal }) => getCompany(signal) });
  // Only for suggesting specification names other products already use.
  const products = useQuery({
    queryKey: masterDataKeys.products,
    queryFn: ({ signal }) => listProducts(signal),
  });

  // Real sides if the product has them, else whatever an older size note says.
  const legacySize = existing && !existing.dimensions ? parseLegacySize(existing.size) : null;
  const unreadableSize = existing && !existing.dimensions && !legacySize ? existing.size : null;

  // An existing product's variants and stock fill the form, so they can be changed there.
  const setupLoaded = Boolean(existing && grid);
  const defaultVariant = existing?.variants.find((variant) => variant.isDefault && !variant.hasAttributes);
  const plain = Boolean(defaultVariant) && (existing?.variants.length ?? 0) <= 1;
  const stockOf = (variantId: string) => {
    const lines = (grid?.cells ?? [])
      .filter((cell) => cell.variantId === variantId && cell.quantity > 0)
      .map((cell) => ({ warehouseId: cell.warehouseId, quantity: String(cell.quantity) }));
    return lines.length ? lines : [blankStockLine()];
  };
  const typeOf = (attributeFacetIds: string[] | undefined) =>
    (attributeFacetIds ?? [])
      .map((id) => existing?.axes?.find((axis) => axis.facetId === id)?.label)
      .filter(Boolean)
      .join(" / ");

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    // Next validates a step with trigger(), which leaves its errors up; this is what takes
    // each one down as soon as the field is put right.
    mode: "onTouched",
    defaultValues: {
      skuOwner: existing?.skuOwner || DEFAULT_SKU_OWNER,
      name: existing?.name ?? "",
      genericName: existing?.genericName ?? "",
      description: existing?.description ?? "",
      wholesaleRate: existing ? amountText(existing.wholesaleRate.amount) : "",
      retailRate: existing ? amountText(existing.retailRate.amount) : "",
      categoryId: existing?.categoryId ?? "",
      subCategoryId: existing?.subCategoryId ?? "",
      // The variants the product has, then one empty row for the next: filled it is added, empty it is skipped.
      variants: [
        ...(setupLoaded && !plain
          ? (existing?.variants ?? []).filter((variant) => variant !== defaultVariant).map((variant) => ({
              id: variant.id,
              active: variant.active !== false,
              type: typeOf(variant.attributeFacetIds),
              name: variant.name,
              wholesaleRate: amountText(variant.wholesaleRate.amount),
              retailRate: amountText(variant.retailRate.amount),
              stock: stockOf(variant.id),
            }))
          : []),
        blankVariant(),
      ],
      // The product's own stock: the plain pieces, kept on its default variant beside the variants.
      stock: setupLoaded && defaultVariant ? stockOf(defaultVariant.id) : [blankStockLine()],
      // Every storefront detail may be absent — always so in api mode, where
      // the backend does not know them — so each falls back to empty.
      rateType: existing?.rateType ?? "Qty",
      length: existing?.dimensions ? dimensionText(existing.dimensions.length) : (legacySize?.length ?? ""),
      width: existing?.dimensions ? dimensionText(existing.dimensions.width) : (legacySize?.width ?? ""),
      height: existing?.dimensions ? dimensionText(existing.dimensions.height) : (legacySize?.height ?? ""),
      dimensionUnit: existing?.dimensions?.unit ?? legacySize?.unit ?? "ft",
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

  const {
    control,
    register,
    handleSubmit,
    setValue,
    trigger,
    formState: { errors },
  } = form;

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
      const { length, width, height, dimensionUnit, variants, stock, ...rest } = values;
      // A warehouse that held some of a variant and is no longer listed is emptied.
      const emptied = (variantId: string | undefined, kept: { warehouseId: string }[]) =>
        variantId
          ? (grid?.cells ?? [])
              .filter(
                (cell) =>
                  cell.variantId === variantId &&
                  cell.quantity > 0 &&
                  !kept.some((line) => line.warehouseId === cell.warehouseId),
              )
              .map((cell) => ({ warehouseId: cell.warehouseId, quantity: 0 }))
          : [];
      const linesOf = (rows: { warehouseId: string; quantity: string }[], variantId?: string) => {
        const kept = rows.filter(stockLineUsed).map((row) => ({ warehouseId: row.warehouseId, quantity: Number(row.quantity) }));
        return [...kept, ...emptied(variantId, kept)];
      };
      const filled = variants.filter(variantFilled);
      // Empty rows are skipped; a rate left empty is the product's own.
      const setupOf = () => {
        if (filled.length > 0 || (existing && !plain)) {
          return {
            variants: filled.map((variant) => ({
              id: variant.id,
              active: variant.id ? variant.active : undefined,
              type: variant.type,
              name: variant.name,
              wholesaleRate: variant.wholesaleRate === "" ? rest.wholesaleRate : Number(variant.wholesaleRate),
              retailRate: variant.retailRate === "" ? rest.retailRate : Number(variant.retailRate),
              stock: linesOf(variant.stock, variant.id),
            })),
            stock: linesOf(stock, defaultVariant?.id),
          };
        }
        const lines = linesOf(stock, defaultVariant?.id);
        return lines.length ? { stock: lines } : undefined;
      };
      const sides = [length, width, height];
      const toNumber = (text: string) => (text === "" ? null : Number(text));
      const request = {
        ...rest,
        // No SKU is sent: a new product is numbered by the system and an existing one keeps its own.
        // The older size note is no longer edited here; it goes back as it came so a save never drops it.
        size: existing?.size ?? null,
        dimensions: sides.some((side) => side !== "")
          ? {
              length: toNumber(length),
              width: toNumber(width),
              height: toNumber(height),
              unit: dimensionUnit,
            }
          : null,
        // Not on the form, but the backend replaces it on every save.
        maxCoverageSqft: existing?.maxCoverageSqft ?? null,
        setting: values.setting || null,
        attributes: Object.fromEntries(values.attributes.map((row) => [row.name, row.value])),
        media,
        hasVariants: existing && !grid ? existing.hasVariants : filled.length > 0 || Boolean(existing && !plain),
        setup: existing && !grid ? undefined : setupOf(),
      };
      return existing ? updateProduct(existing.id, request) : createProduct(request);
    },
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.products });
      queryClient.invalidateQueries({ queryKey: ["master-data", "stock-grid"] });
      // Stock entered with the product shows on the Warehouses page.
      queryClient.invalidateQueries({ queryKey: masterDataKeys.warehouses });
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

  /** Checks the fields of steps `from` to `to` (inclusive); true when all are fine. */
  const stepsValid = async (from: number, to: number) => {
    for (let index = from; index <= to; index++) {
      if (!(await trigger(STEPS[index].fields))) {
        setStep(index);
        return false;
      }
    }
    return true;
  };

  const goTo = async (target: number) => {
    if (target === step) return;
    // Going back is always allowed; going forward needs every step on the way to be sound.
    if (target < step || (await stepsValid(step, target - 1))) setStep(target);
  };

  const submit = handleSubmit(
    (values) => {
      // Enter in a text field submits even while the button is disabled, and a
      // save now would drop the files still being prepared.
      if (mediaBusy) return;
      setFormError(null);
      mutation.mutate(values);
    },
    (invalid: FieldErrors<FormInput>) => {
      // A rule broken on a step that is not showing: take the admin to it.
      const broken = STEPS.findIndex((candidate) => candidate.fields.some((name) => name in invalid));
      if (broken >= 0) setStep(broken);
    },
  );

  const retailRate = useWatch({ control, name: "retailRate" });
  const wholesaleRate = useWatch({ control, name: "wholesaleRate" });
  const rateType = useWatch({ control, name: "rateType" });
  const unit = useWatch({ control, name: "dimensionUnit" });
  const rateNote = planRateNote(retailRate ?? "", wholesaleRate ?? "");
  const rateSuffix = rateType === "SqFt" ? "/ sq ft / day" : rateType === "RFt" ? "/ ft / day" : "/ day";
  const skuPreview = existing
    ? existing.sku
    : previewSku(
        company.data?.skuPrefix,
        (products.data ?? []).map((product) => product.sku),
      );

  const watchedVariants = useWatch({ control, name: "variants" });
  const hasFilledVariants = (watchedVariants ?? []).some(variantFilled);

  const busy = mutation.isPending;

  return (
    <Dialog
      open
      onClose={onClose}
      title={existing ? "Edit product" : "New product"}
      className="max-w-2xl"
      description={
        existing
          ? `SKU ${existing.sku}`
          : "Added to this company's catalogue and immediately active."
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy} className="mr-auto">
            Cancel
          </Button>
          {step > 0 ? (
            <Button key="previous" type="button" variant="outline" onClick={() => setStep(step - 1)} disabled={busy}>
              <ArrowLeft />
              Previous
            </Button>
          ) : null}
          {step < LAST_STEP ? (
            <Button key="next" type="button" onClick={() => void goTo(step + 1)} disabled={busy}>
              Next
              <ArrowRight />
            </Button>
          ) : (
            <Button key="create" form={FORM_ID} type="submit" disabled={busy || mediaBusy}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              {existing ? "Save changes" : "Create product"}
            </Button>
          )}
        </>
      }
    >
      <nav aria-label="Steps" className="mb-5">
        <ol className="flex items-start">
          {STEPS.map((item, index) => {
            const done = index < step;
            const active = index === step;
            return (
              <li key={item.label} className={cn("flex flex-1 flex-col items-center", index > 0 && "relative")}>
                {index > 0 ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute top-4 right-1/2 h-0.5 w-full -translate-y-1/2 transition-colors",
                      index <= step ? "bg-primary" : "bg-border",
                    )}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => void goTo(index)}
                  disabled={busy}
                  aria-current={active ? "step" : undefined}
                  className="group relative z-10 flex flex-col items-center gap-1.5 focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all group-focus-visible:ring-2 group-focus-visible:ring-ring",
                      done && "border-primary bg-primary text-primary-foreground",
                      active && "border-primary bg-card text-primary shadow-md ring-4 ring-primary/15",
                      !done && !active && "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="size-4" /> : index + 1}
                  </span>
                  <span
                    className={cn(
                      "text-[0.7rem] font-medium",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {item.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <FormProvider {...form}>
      <form
        id={FORM_ID}
        onSubmit={(event) => {
          // Enter on a step that is not the last means "next", not "save".
          if (step < LAST_STEP) {
            event.preventDefault();
            void goTo(step + 1);
            return;
          }
          void submit(event);
        }}
        onKeyDown={(event) => {
          // With no submit button on the first two steps the browser would ignore Enter; make it mean "next".
          const target = event.target as HTMLElement;
          if (
            event.key === "Enter" &&
            !event.defaultPrevented &&
            step < LAST_STEP &&
            target.tagName === "INPUT" &&
            (target as HTMLInputElement).type !== "button" &&
            !target.hasAttribute("list")
          ) {
            event.preventDefault();
            void goTo(step + 1);
          }
        }}
        className="space-y-4"
        noValidate
      >
        {formError ? <Alert tone="error" title={formError} /> : null}

        {/* Step 1 — product details */}
        <div className={cn("space-y-5", step !== 0 && "hidden")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required error={errors.name?.message}>
              {(props) => <Input {...props} {...register("name")} placeholder="Gold Chiavari Chair" autoComplete="off" />}
            </Field>

            <Field
              label="Generic name"
              required
              error={errors.genericName?.message}
              hint="The plain name, without size or colour."
            >
              {(props) => <Input {...props} {...register("genericName")} placeholder="Chair" autoComplete="off" />}
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

          <fieldset className="space-y-3 rounded-lg border border-border bg-muted/30 p-3.5">
            <legend className="px-1 text-xs font-semibold">Pricing</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Retail rate" required error={errors.retailRate?.message} hint="What customers pay.">
                {(props) => (
                  <AffixInput
                    {...props}
                    {...register("retailRate")}
                    prefix="₹"
                    suffix={rateSuffix}
                    inputMode="decimal"
                    placeholder="1500"
                  />
                )}
              </Field>

              <Field label="Wholesale rate" required error={errors.wholesaleRate?.message} hint="What planners pay.">
                {(props) => (
                  <AffixInput
                    {...props}
                    {...register("wholesaleRate")}
                    prefix="₹"
                    suffix={rateSuffix}
                    inputMode="decimal"
                    placeholder="1200"
                  />
                )}
              </Field>

              <Field label="Charged" required error={errors.rateType?.message} hint="How the rate is counted.">
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
            </div>
            {rateNote ? (
              <p className={cn("text-xs", rateNote.warn ? "text-warning" : "text-muted-foreground")}>{rateNote.text}</p>
            ) : null}
          </fieldset>

          <Field label="Description" error={errors.description?.message}>
            {(props) => (
              <Textarea {...props} {...register("description")} placeholder="Optional details customers will read" />
            )}
          </Field>

          <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <Field
              label="SKU owner"
              error={errors.skuOwner?.message}
              hint="Whose stock this is. Tentvaale unless it is sub-hired from a partner."
            >
              {(props) => <Input {...props} {...register("skuOwner")} placeholder={DEFAULT_SKU_OWNER} autoComplete="off" />}
            </Field>

            <Field
              label="SKU"
              hint={existing ? "Never changes once given." : "Numbered automatically when you save."}
            >
              {(props) => (
                <Input
                  {...props}
                  readOnly
                  tabIndex={-1}
                  value={skuPreview ?? ""}
                  placeholder="Numbered when you save"
                  className="bg-muted font-mono text-muted-foreground"
                />
              )}
            </Field>
          </div>

          {/* The product's own stock: plain pieces, counted in addition to its variants (100 plain + 20 Gold + 20 Silver = 140). */}
          {!existing || (setupLoaded && defaultVariant) ? (
            <fieldset className="space-y-2 rounded-lg border border-border p-3.5">
              <legend className="px-1 text-xs font-semibold">Stock of the product itself</legend>
              <StockFields name="stock" warehouseLabel="Add to warehouse" />
              {hasFilledVariants ? (
                <p className="text-xs text-muted-foreground">
                  Counted in addition to the variants you add in the next step, which each carry their own stock.
                </p>
              ) : null}
            </fieldset>
          ) : null}
        </div>

        {/* Step 2 — variants and stock */}
        <div className={cn("space-y-5", step !== 1 && "hidden")}>
          {existing && !grid ? (
            <Alert tone="info" title="The variants and stock of this product could not be loaded, so they cannot be changed here." />
          ) : (
            <ProductVariantsStep />
          )}
        </div>

        {/* Step 3 — storefront details */}
        <div className={cn("space-y-5", step !== 2 && "hidden")}>
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

          <fieldset className="space-y-3 rounded-lg border border-border p-3.5">
            <legend className="sr-only">Dimensions</legend>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold">Dimensions</p>
              <Controller
                control={control}
                name="dimensionUnit"
                render={({ field }) => (
                  <div role="radiogroup" aria-label="Unit" className="inline-flex rounded-md border border-border bg-muted/40 p-0.5">
                    {DIMENSION_UNITS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={field.value === option}
                        onClick={() => field.onChange(option)}
                        className={cn(
                          "rounded px-3 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                          field.value === option
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {UNIT_LABEL[option]}
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Length" error={errors.length?.message}>
                {(props) => (
                  <AffixInput {...props} {...register("length")} suffix={unit} inputMode="decimal" placeholder="40" />
                )}
              </Field>
              <Field label="Width" error={errors.width?.message}>
                {(props) => (
                  <AffixInput {...props} {...register("width")} suffix={unit} inputMode="decimal" placeholder="45" />
                )}
              </Field>
              <Field label="Height" error={errors.height?.message}>
                {(props) => (
                  <AffixInput {...props} {...register("height")} suffix={unit} inputMode="decimal" placeholder="92" />
                )}
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Leave a side empty if it does not apply, such as the height of a rug.
            </p>
            {unreadableSize ? (
              <p className="text-xs text-muted-foreground">
                Earlier size note, kept as it is: <span className="font-medium">{unreadableSize}</span>
              </p>
            ) : null}
          </fieldset>

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
                      disabled={busy}
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
                      disabled={busy}
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
                      disabled={busy}
                    />
                    <Input
                      {...register(`attributes.${index}.value`)}
                      aria-label={`Specification ${index + 1} value`}
                      aria-invalid={Boolean(rowErrors?.value)}
                      placeholder="2"
                      disabled={busy}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => attributeRows.remove(index)}
                      disabled={busy}
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
              disabled={busy || attributeRows.fields.length >= 12}
            >
              <Plus />
              Add specification
            </Button>
          </div>
        </div>

        {/* Step 4 — media */}
        <div className={cn(step !== 3 && "hidden")}>
          <MediaField
            media={media}
            limits={PRODUCT_MEDIA_LIMITS}
            onChange={setMedia}
            onBusyChange={setMediaBusy}
            disabled={busy}
            allowUrl={false}
            expressive
          />
        </div>
      </form>
      </FormProvider>
    </Dialog>
  );
}

/**
 * The product form. For an existing product the stock per variant and warehouse is loaded first, since it is
 * the starting point of the "Variants & stock" step.
 */
export function ProductDialog({ existing, onClose }: { existing?: ProductView; onClose: () => void }) {
  const grid = useQuery({
    queryKey: ["master-data", "stock-grid", existing?.id],
    queryFn: ({ signal }) => getStockGrid(existing!.id, signal),
    enabled: Boolean(existing),
    gcTime: 0,
  });
  if (existing && grid.isPending) {
    return (
      <Dialog open onClose={onClose} title="Edit product" description={`SKU ${existing.sku}`} className="max-w-2xl">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Dialog>
    );
  }
  return <ProductForm existing={existing} grid={grid.data} onClose={onClose} />;
}

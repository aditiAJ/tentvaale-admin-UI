"use client";

import { useMemo, useState } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  createBundle,
  createBundleOccasion,
  listBundleOccasions,
  listProducts,
  masterDataKeys,
  updateBundle,
} from "@/features/master-data/api";
import { addBundleComponent } from "@/features/master-data/bundles";
import {
  BUNDLE_HIGHLIGHT_LIMIT,
  BUNDLE_OCCASION_LIMIT,
  CATALOGUE_MEDIA_LIMITS,
  type BundleOccasionView,
  type BundleView,
  type MediaAsset,
  type ProductView,
} from "@/features/master-data/types";
import { MediaField } from "@/features/master-data/components/MediaField";
import { ApiError } from "@/services/api-client";
import { formatMoney } from "@/lib/money";
import { positiveIntegerField } from "@/lib/forms";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ToggleChips } from "@/components/ui/tag-input";

const FORM_ID = "bundle-form";

/** Blank is "not given"; otherwise a whole number, as the backend keeps guest counts. */
const optionalWholeNumber = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d*$/, `${label}: whole numbers only`)
    .transform((value) => (value === "" ? undefined : Number(value)));

const swapSchema = z.object({ productId: z.string(), variantId: z.string() });

const schema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(200, "Maximum 200 characters"),
    components: z
      .array(
        z.object({
          productId: z.string(),
          // "" for a product without variants.
          variantId: z.string(),
          quantity: positiveIntegerField("Quantity"),
          swaps: z.array(swapSchema),
        }),
      )
      .min(1, "A bundle needs at least one product"),
    tagline: z.string().trim().max(300, "Maximum 300 characters"),
    occasionIds: z
      .array(z.string())
      .max(BUNDLE_OCCASION_LIMIT, `At most ${BUNDLE_OCCASION_LIMIT} occasions`),
    description: z.string().trim().max(4000, "Maximum 4000 characters"),
    guestMin: optionalWholeNumber("Guests from"),
    guestMax: optionalWholeNumber("Guests to"),
    // One decimal place, hours: "3.5".
    setupHours: z
      .string()
      .trim()
      .regex(/^(\d+(\.\d)?)?$/, "Hours, with at most one decimal")
      .transform((value) => (value === "" ? undefined : Number(value))),
    highlights: z
      .array(
        z.object({
          text: z.string().trim().min(1, "Write the highlight").max(300, "Maximum 300 characters"),
        }),
      )
      .max(BUNDLE_HIGHLIGHT_LIMIT, `At most ${BUNDLE_HIGHLIGHT_LIMIT} highlights`),
  })
  .superRefine((value, context) => {
    if (
      value.guestMin !== undefined &&
      value.guestMax !== undefined &&
      value.guestMax < value.guestMin
    ) {
      context.addIssue({
        code: "custom",
        path: ["guestMax"],
        message: "Cannot be below the minimum",
      });
    }
  });

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

/** The add row's quantity, checked the same way as a line's. */
const addQuantity = positiveIntegerField("Quantity");

/**
 * Add or edit one bundle: its products with a quantity each (and a variant where a product has
 * them), the alternatives a customer may swap each product for, the occasions it suits, and the
 * storefront page details.
 *
 * There is no price field. A bundle's price is worked out from its products: the sum of each
 * product's day rate times its quantity, shown to customers as "From ₹X per event" (ADR-005).
 *
 * Picking a product (and variant) the bundle already holds adds to that line's quantity instead of
 * creating a second line — the rule lives in addBundleComponent.
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
  const [pickVariantId, setPickVariantId] = useState("");
  const [pickQuantity, setPickQuantity] = useState("1");
  const [pickError, setPickError] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaAsset[]>(existing?.media ?? []);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [newOccasion, setNewOccasion] = useState("");
  const [occasionError, setOccasionError] = useState<string | null>(null);

  const products = useQuery({
    queryKey: masterDataKeys.products,
    queryFn: ({ signal }) => listProducts(signal),
  });

  const occasions = useQuery({
    queryKey: masterDataKeys.bundleOccasions,
    queryFn: ({ signal }) => listBundleOccasions(signal),
  });

  const {
    control,
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: existing?.name ?? "",
      components: (existing?.components ?? []).map((component) => ({
        productId: component.productId,
        variantId: component.variantId ?? "",
        quantity: String(component.quantity),
        swaps: (component.swapOptions ?? []).map((swap) => ({
          productId: swap.productId,
          variantId: swap.variantId ?? "",
        })),
      })),
      tagline: existing?.tagline ?? "",
      occasionIds: (existing?.occasions ?? []).map((occasion) => occasion.id),
      description: existing?.description ?? "",
      guestMin: existing?.guestMin != null ? String(existing.guestMin) : "",
      guestMax: existing?.guestMax != null ? String(existing.guestMax) : "",
      setupHours: existing?.setupHours != null ? String(existing.setupHours) : "",
      highlights: (existing?.highlights ?? []).map((text) => ({ text })),
    },
  });

  const highlightRows = useFieldArray({ control, name: "highlights" });
  const { fields, remove, replace } = useFieldArray({ control, name: "components" });
  const pickedOccasions = useWatch({ control, name: "occasionIds" });
  const watched = useWatch({ control, name: "components" });

  // Shown occasions can be picked; a hidden one is offered only while this bundle already has it,
  // so it can be taken off but not newly added.
  const occasionOptions = (occasions.data ?? []).filter(
    (occasion) => occasion.active || pickedOccasions.includes(occasion.id),
  );
  const occasionLabel = (occasionId: string) => {
    const occasion = occasions.data?.find((candidate) => candidate.id === occasionId);
    if (!occasion) return occasionId;
    return occasion.active ? occasion.name : `${occasion.name} (hidden)`;
  };

  const addOccasion = useMutation({
    mutationFn: (name: string) => createBundleOccasion({ name }),
    onSuccess: (occasion) => {
      // Into the list at once, so it is a chip before the refetch lands; a picked id missing from
      // the chips would be dropped by the next toggle.
      queryClient.setQueryData<BundleOccasionView[]>(masterDataKeys.bundleOccasions, (list) =>
        list ? [...list, occasion] : list,
      );
      queryClient.invalidateQueries({ queryKey: masterDataKeys.bundleOccasions });
      setValue("occasionIds", [...getValues("occasionIds"), occasion.id], { shouldValidate: true });
      setNewOccasion("");
      setOccasionError(null);
    },
    onError: (error) =>
      setOccasionError(error instanceof ApiError ? error.message : "Could not add the occasion."),
  });

  const submitNewOccasion = () => {
    const name = newOccasion.trim();
    if (!name) {
      setOccasionError("Name the occasion");
      return;
    }
    addOccasion.mutate(name);
  };

  // The catalogue lists active products only; one deactivated after it joined the bundle is
  // labelled from the bundle's own copy instead.
  const catalogue = useMemo(() => products.data ?? [], [products.data]);
  const byId = useMemo(() => new Map(catalogue.map((product) => [product.id, product])), [catalogue]);
  const fallback = useMemo(() => {
    const map = new Map<string, string>();
    for (const component of existing?.components ?? []) {
      map.set(component.productId, component.productName);
      for (const swap of component.swapOptions ?? []) map.set(swap.productId, swap.productName);
    }
    return map;
  }, [existing]);

  /** "Gold Chair (Velvet)" for a line or swap option; the id if neither list knows it. */
  const labelOf = (productId: string, variantId: string) => {
    const product = byId.get(productId);
    const name = product?.name ?? fallback.get(productId) ?? productId;
    const variant = product?.variants.find((candidate) => candidate.id === variantId);
    return variant ? `${name} (${variant.name})` : name;
  };
  const isInactive = (productId: string) => Boolean(byId.size) && !byId.has(productId);

  const pickedProduct = byId.get(pickProductId);

  const addPicked = () => {
    if (!pickProductId) {
      setPickError("Choose a product");
      return;
    }
    if (pickedProduct?.hasVariants && !pickVariantId) {
      setPickError("Choose a variant");
      return;
    }
    const parsed = addQuantity.safeParse(pickQuantity);
    if (!parsed.success) {
      setPickError(parsed.error.issues[0]?.message ?? "Enter a quantity");
      return;
    }
    // Merged on the current form values, so a quantity already typed into an existing line is
    // what gets added to. The swap options typed so far are kept with their line.
    const current = getValues("components");
    const merged = addBundleComponent(
      current.map((component) => ({
        productId: component.productId,
        variantId: component.variantId || undefined,
        quantity: /^\d+$/.test(component.quantity.trim()) ? Number(component.quantity) : 0,
      })),
      pickProductId,
      parsed.data,
      pickVariantId || undefined,
    );
    replace(
      merged.map((line) => {
        const before = current.find(
          (component) =>
            component.productId === line.productId && component.variantId === (line.variantId ?? ""),
        );
        return {
          productId: line.productId,
          variantId: line.variantId ?? "",
          quantity: String(line.quantity),
          swaps: before?.swaps ?? [],
        };
      }),
    );
    setPickError(null);
    setPickProductId("");
    setPickVariantId("");
    setPickQuantity("1");
  };

  const mutation = useMutation({
    mutationFn: (values: FormOutput) => {
      const request = {
        name: values.name,
        components: values.components.map((component) => ({
          productId: component.productId,
          variantId: component.variantId || undefined,
          quantity: component.quantity,
          swapOptions: component.swaps.map((swap) => ({
            productId: swap.productId,
            variantId: swap.variantId || undefined,
          })),
        })),
        media,
        tagline: values.tagline || null,
        occasionIds: values.occasionIds,
        description: values.description || null,
        guests: null,
        setupTime: null,
        guestMin: values.guestMin ?? null,
        guestMax: values.guestMax ?? null,
        setupHours: values.setupHours ?? null,
        highlights: values.highlights.map((row) => row.text),
      };
      return existing ? updateBundle(existing.id, request) : createBundle(request);
    },
    onSuccess: (bundle) => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.bundles });
      toast.success(existing ? `${bundle.name} updated` : `${bundle.name} added`, {
        description: `From ${formatMoney(bundle.rentalRate)} per event`,
      });
      onClose();
    },
    onError: (error) =>
      setFormError(error instanceof ApiError ? error.message : "Could not save the bundle."),
  });

  const componentsError = errors.components?.root?.message ?? errors.components?.message;

  return (
    <Dialog
      open
      onClose={onClose}
      title={existing ? "Edit bundle" : "New bundle"}
      description="A group of products offered together. Its price is worked out from the products."
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button form={FORM_ID} type="submit" disabled={mutation.isPending || mediaBusy}>
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
          if (mediaBusy) return;
          setFormError(null);
          mutation.mutate(values);
        })}
      >
        {formError ? <Alert tone="error" title={formError} /> : null}

        <Field label="Name" required error={errors.name?.message}>
          {(props) => (
            <Input {...props} {...register("name")} placeholder="Wedding Mandap Set" autoFocus />
          )}
        </Field>

        <Field label="Tagline" error={errors.tagline?.message}>
          {(props) => (
            <Input
              {...props}
              {...register("tagline")}
              placeholder="The ceremony stage, styled end to end"
            />
          )}
        </Field>

        <Field label="Occasions" error={errors.occasionIds?.message ?? occasionError ?? undefined}>
          {(props) => (
            <div className="space-y-2">
              <Controller
                control={control}
                name="occasionIds"
                render={({ field }) => (
                  <ToggleChips
                    id={props.id}
                    aria-label="Occasions"
                    options={occasionOptions.map((occasion) => occasion.id)}
                    labelFor={occasionLabel}
                    value={field.value}
                    onChange={field.onChange}
                    disabled={mutation.isPending}
                  />
                )}
              />
              <div className="flex items-center gap-2">
                <Input
                  value={newOccasion}
                  onChange={(event) => {
                    setNewOccasion(event.target.value);
                    setOccasionError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      submitNewOccasion();
                    }
                  }}
                  aria-label="New occasion"
                  placeholder="New occasion"
                  className="h-8 max-w-48"
                  disabled={mutation.isPending || addOccasion.isPending}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={submitNewOccasion}
                  disabled={mutation.isPending || addOccasion.isPending}
                >
                  {addOccasion.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                  Add occasion
                </Button>
              </div>
            </div>
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Guests from" error={errors.guestMin?.message}>
            {(props) => (
              <Input {...props} {...register("guestMin")} inputMode="numeric" placeholder="200" />
            )}
          </Field>
          <Field label="Guests to" error={errors.guestMax?.message}>
            {(props) => (
              <Input {...props} {...register("guestMax")} inputMode="numeric" placeholder="500" />
            )}
          </Field>
          <Field label="Setup time (hours)" error={errors.setupHours?.message}>
            {(props) => (
              <Input {...props} {...register("setupHours")} inputMode="decimal" placeholder="10" />
            )}
          </Field>
        </div>

        <Field label="Description" error={errors.description?.message}>
          {(props) => (
            <Textarea
              {...props}
              {...register("description")}
              placeholder="A complete styled stage for the main ceremony"
            />
          )}
        </Field>

        <div className="space-y-2">
          <p className="text-xs font-medium">Highlights</p>
          {highlightRows.fields.map((row, index) => {
            const rowError = errors.highlights?.[index]?.text?.message;
            return (
              <div key={row.id}>
                <div className="flex items-center gap-2">
                  <Input
                    {...register(`highlights.${index}.text`)}
                    aria-label={`Highlight ${index + 1}`}
                    aria-invalid={Boolean(rowError)}
                    placeholder="Floral mandap with gold throne chairs"
                    disabled={mutation.isPending}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => highlightRows.remove(index)}
                    disabled={mutation.isPending}
                    aria-label={`Remove highlight ${index + 1}`}
                    title="Remove"
                  >
                    <Trash2 />
                  </Button>
                </div>
                {rowError ? <p className="mt-1 text-xs text-destructive">{rowError}</p> : null}
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => highlightRows.append({ text: "" })}
            disabled={mutation.isPending || highlightRows.fields.length >= BUNDLE_HIGHLIGHT_LIMIT}
          >
            <Plus />
            Add highlight
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium">
            Products
            <span className="ml-0.5 text-destructive">*</span>
          </p>

          <div className="flex flex-wrap items-start gap-2">
            <Select
              value={pickProductId}
              onChange={(event) => {
                setPickProductId(event.target.value);
                setPickVariantId("");
                setPickError(null);
              }}
              disabled={products.isPending || mutation.isPending}
              aria-label="Product to add"
              className="min-w-0 flex-1"
            >
              <option value="">{products.isPending ? "Loading catalogue" : "Choose a product"}</option>
              {catalogue.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </Select>
            {pickedProduct?.hasVariants ? (
              <Select
                value={pickVariantId}
                onChange={(event) => {
                  setPickVariantId(event.target.value);
                  setPickError(null);
                }}
                disabled={mutation.isPending}
                aria-label="Variant to add"
                className="w-40"
              >
                <option value="">Choose a variant</option>
                {pickedProduct.variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.name}
                  </option>
                ))}
              </Select>
            ) : null}
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
            <Button type="button" variant="outline" onClick={addPicked} disabled={mutation.isPending}>
              <Plus />
              Add
            </Button>
          </div>
          {pickError ? <p className="text-xs text-destructive">{pickError}</p> : null}

          {fields.length ? (
            <ul className="divide-y divide-border rounded-md border border-border">
              {fields.map((field, index) => {
                const line = watched?.[index];
                const rowError = errors.components?.[index]?.quantity?.message;
                const label = labelOf(field.productId, line?.variantId ?? field.variantId);
                return (
                  <li key={field.id} className="space-y-2 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-sm">{label}</span>
                        {isInactive(field.productId) ? (
                          <Badge className="ml-2 align-middle">Inactive</Badge>
                        ) : null}
                      </div>
                      <span className="text-xs text-muted-foreground">×</span>
                      <Input
                        {...register(`components.${index}.quantity`)}
                        inputMode="numeric"
                        aria-label={`Quantity of ${label}`}
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
                        aria-label={`Remove ${label} from this bundle`}
                        title="Remove from bundle"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    {rowError ? (
                      <p className="text-right text-xs text-destructive">{rowError}</p>
                    ) : null}
                    <SwapEditor
                      index={index}
                      control={control}
                      catalogue={catalogue}
                      itemProductId={field.productId}
                      itemVariantId={line?.variantId ?? field.variantId}
                      labelOf={labelOf}
                      disabled={mutation.isPending}
                    />
                  </li>
                );
              })}
            </ul>
          ) : null}

          {componentsError ? <p className="text-xs text-destructive">{componentsError}</p> : null}
        </div>

        {existing ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm">
            Price: <span className="font-medium">From {formatMoney(existing.rentalRate)} per event</span>
            <span className="block text-xs text-muted-foreground">
              Worked out from the products above for one day. Saving recalculates it.
            </span>
          </p>
        ) : (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            The price is worked out from the products: the sum of each day rate times its quantity.
          </p>
        )}

        <MediaField
          media={media}
          limits={CATALOGUE_MEDIA_LIMITS}
          onChange={setMedia}
          onBusyChange={setMediaBusy}
          disabled={mutation.isPending}
        />
      </form>
    </Dialog>
  );
}

/**
 * The alternatives a customer may swap one bundle line for. Only the products listed here are
 * offered (curated, not "anything in the same category"). A product with variants is listed as one
 * of its variants.
 */
function SwapEditor({
  index,
  control,
  catalogue,
  itemProductId,
  itemVariantId,
  labelOf,
  disabled,
}: {
  index: number;
  control: Control<FormInput, unknown, FormOutput>;
  catalogue: ProductView[];
  itemProductId: string;
  itemVariantId: string;
  labelOf: (productId: string, variantId: string) => string;
  disabled: boolean;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: `components.${index}.swaps` });
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const picked = catalogue.find((product) => product.id === productId);

  const add = () => {
    if (!productId) {
      setError("Choose a product");
      return;
    }
    if (picked?.hasVariants && !variantId) {
      setError("Choose a variant");
      return;
    }
    if (productId === itemProductId && variantId === itemVariantId) {
      setError("A line cannot be its own alternative");
      return;
    }
    if (fields.some((swap) => swap.productId === productId && swap.variantId === variantId)) {
      setError("Already listed");
      return;
    }
    append({ productId, variantId });
    setProductId("");
    setVariantId("");
    setError(null);
  };

  return (
    <div className="text-xs">
      <button
        type="button"
        className="text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        Swap options ({fields.length})
      </button>
      {open || fields.length ? (
        <div className="mt-1.5 space-y-1.5">
          {fields.length ? (
            <div className="flex flex-wrap gap-1.5">
              {fields.map((swap, swapIndex) => (
                <Badge key={swap.id} variant="outline" className="gap-1">
                  {labelOf(swap.productId, swap.variantId)}
                  <button
                    type="button"
                    onClick={() => remove(swapIndex)}
                    disabled={disabled}
                    aria-label={`Remove swap option ${labelOf(swap.productId, swap.variantId)}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : null}
          {open ? (
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={productId}
                onChange={(event) => {
                  setProductId(event.target.value);
                  setVariantId("");
                  setError(null);
                }}
                disabled={disabled}
                aria-label={`Alternative product for ${labelOf(itemProductId, itemVariantId)}`}
                className="h-8 w-48"
              >
                <option value="">Alternative product…</option>
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
                    setError(null);
                  }}
                  disabled={disabled}
                  aria-label="Alternative variant"
                  className="h-8 w-36"
                >
                  <option value="">Variant…</option>
                  {picked.variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.name}
                    </option>
                  ))}
                </Select>
              ) : null}
              <Button type="button" variant="outline" size="sm" onClick={add} disabled={disabled}>
                <Plus />
                Add alternative
              </Button>
            </div>
          ) : null}
          {error ? <p className="text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

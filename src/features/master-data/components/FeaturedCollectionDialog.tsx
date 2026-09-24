"use client";

import { useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  createFeaturedCollection,
  listProducts,
  masterDataKeys,
  updateFeaturedCollection,
} from "@/features/master-data/api";
import type { FeaturedCollectionView } from "@/features/master-data/types";
import { ApiError } from "@/services/api-client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

const FORM_ID = "featured-collection-form";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150, "Maximum 150 characters"),
  description: z.string().trim().max(500, "Maximum 500 characters"),
  products: z
    .array(z.object({ productId: z.string() }))
    .min(1, "Add at least one product"),
});

type FormValues = z.output<typeof schema>;

/**
 * Add or edit one featured collection.
 *
 * Products are chosen from the live catalogue by id and kept in the order they
 * were added, which is the order the collection shows them in. Removing one
 * here only takes it out of this collection; the product and any other
 * collection holding it are untouched.
 */
export function FeaturedCollectionDialog({
  existing,
  onClose,
}: {
  existing?: FeaturedCollectionView;
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
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: existing?.name ?? "",
      description: existing?.description ?? "",
      products: (existing?.products ?? []).map((product) => ({ productId: product.productId })),
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "products" });

  // The catalogue lists active products only, so a product that was deactivated
  // after joining the collection is labelled from the collection's own copy.
  const labels = useMemo(() => {
    const map = new Map<string, { name: string; sku: string; active: boolean }>();
    for (const product of existing?.products ?? []) {
      map.set(product.productId, product);
    }
    for (const product of products.data ?? []) {
      map.set(product.id, { name: product.name, sku: product.sku, active: true });
    }
    return map;
  }, [existing, products.data]);

  const chosen = new Set(fields.map((field) => field.productId));
  const addable = (products.data ?? []).filter((product) => !chosen.has(product.id));

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const request = {
        name: values.name,
        description: values.description,
        productIds: values.products.map((entry) => entry.productId),
      };
      return existing
        ? updateFeaturedCollection(existing.id, request)
        : createFeaturedCollection(request);
    },
    onSuccess: (collection) => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.featuredCollections });
      toast.success(existing ? `${collection.name} updated` : `${collection.name} added`, {
        description: `${collection.products.length} ${
          collection.products.length === 1 ? "product" : "products"
        }`,
      });
      onClose();
    },
    onError: (error) =>
      setFormError(
        error instanceof ApiError ? error.message : "Could not save the featured collection.",
      ),
  });

  const productsError = errors.products?.root?.message ?? errors.products?.message;

  return (
    <Dialog
      open
      onClose={onClose}
      title={existing ? "Edit featured collection" : "New featured collection"}
      description="A curated selection of products, showcased on the storefront."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button form={FORM_ID} type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            {existing ? "Save changes" : "Create collection"}
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

        <Field label="Name" required error={errors.name?.message}>
          {(props) => (
            <Input
              {...props}
              {...register("name")}
              placeholder="Royal Wedding Collection"
              autoFocus
            />
          )}
        </Field>

        <Field label="Description" error={errors.description?.message}>
          {(props) => (
            <Textarea
              {...props}
              {...register("description")}
              placeholder="Gilded seating and grand tenting for a palace-style wedding"
            />
          )}
        </Field>

        <div className="space-y-2">
          <p className="text-xs font-medium">
            Products
            <span className="ml-0.5 text-destructive">*</span>
          </p>

          {/* Always showing the placeholder: picking a product adds it to the
              list below and the picker is ready for the next one. */}
          <Select
            value=""
            onChange={(event) => {
              if (event.target.value) append({ productId: event.target.value });
            }}
            disabled={products.isPending || mutation.isPending}
            aria-label="Add a product"
            aria-invalid={Boolean(productsError)}
          >
            <option value="">
              {products.isPending
                ? "Loading catalogue"
                : addable.length
                  ? "Add a product…"
                  : "Every product is already in this collection"}
            </option>
            {addable.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} · {product.sku}
              </option>
            ))}
          </Select>

          {fields.length ? (
            <ul className="divide-y divide-border rounded-md border border-border">
              {fields.map((field, index) => {
                const label = labels.get(field.productId);
                return (
                  <li key={field.id} className="flex items-center gap-2 px-3 py-1.5">
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => remove(index)}
                      disabled={mutation.isPending}
                      aria-label={`Remove ${label?.name ?? "product"} from this collection`}
                      title="Remove from collection"
                    >
                      <X />
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {productsError ? <p className="text-xs text-destructive">{productsError}</p> : null}
        </div>
      </form>
    </Dialog>
  );
}

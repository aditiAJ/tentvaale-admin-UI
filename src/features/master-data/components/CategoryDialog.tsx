"use client";

import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createCategory, masterDataKeys, updateCategory } from "@/features/master-data/api";
import type { CategoryView } from "@/features/master-data/types";
import { ApiError } from "@/services/api-client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

const FORM_ID = "category-form";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150, "Maximum 150 characters"),
  subCategories: z
    .array(
      z.object({
        // "" for a row added in this dialog. Not called `id`, because
        // useFieldArray keeps its own `id` on every row for React keys.
        subCategoryId: z.string(),
        // A blank row is an error, not silently dropped: it is more likely a
        // name the admin meant to type than one they meant to leave out.
        name: z
          .string()
          .trim()
          .min(1, "Sub-category name is required")
          .max(150, "Maximum 150 characters"),
      }),
    )
    // Unique within the category, case-insensitively — the same rule category
    // names follow across the company. Flagged on the later duplicate, so the
    // first one reads as the original.
    .superRefine((rows, ctx) => {
      const seen = new Set<string>();
      rows.forEach((row, index) => {
        const key = row.name.trim().toLowerCase();
        if (!key) return;
        if (seen.has(key)) {
          ctx.addIssue({ code: "custom", path: [index, "name"], message: "Already listed" });
        }
        seen.add(key);
      });
    }),
});

type FormValues = z.output<typeof schema>;

/**
 * Add or edit one category, together with its sub-categories.
 *
 * Renaming one is safe in a way it would not normally be: a product stores a
 * category *id* and ProductView resolves the name on read, so every product in
 * the category follows the rename on its next load. Nothing has to be
 * backfilled, and nothing goes stale.
 *
 * Sub-categories are edited as one list and saved with the category in a
 * single request, so a rename, an addition and a removal land together or not
 * at all. Removing a sub-category that products are filed under is refused by
 * the mock, and that refusal is shown as the form error.
 */
export function CategoryDialog({
  existing,
  onClose,
}: {
  existing?: CategoryView;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: existing?.name ?? "",
      subCategories: (existing?.subCategories ?? []).map((sub) => ({
        subCategoryId: sub.id,
        name: sub.name,
      })),
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "subCategories" });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      existing
        ? updateCategory(existing.id, {
            name: values.name,
            subCategories: values.subCategories.map((row) => ({
              id: row.subCategoryId || undefined,
              name: row.name,
            })),
          })
        : createCategory({
            name: values.name,
            subCategories: values.subCategories.map((row) => row.name),
          }),
    onSuccess: (category) => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.categories });
      // A rename changes what every product in it displays.
      queryClient.invalidateQueries({ queryKey: masterDataKeys.products });
      const count = category.subCategories.length;
      toast.success(existing ? `${category.name} updated` : `${category.name} added`, {
        description: count
          ? `${count} ${count === 1 ? "sub-category" : "sub-categories"}`
          : undefined,
      });
      onClose();
    },
    onError: (error) =>
      setFormError(error instanceof ApiError ? error.message : "Could not save the category."),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={existing ? "Edit category" : "New category"}
      description="Groupings used to organise the product catalogue."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button form={FORM_ID} type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            {existing ? "Save changes" : "Create category"}
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

        <Field label="Category name" required error={errors.name?.message}>
          {(props) => <Input {...props} {...register("name")} placeholder="Lighting" autoFocus />}
        </Field>

        <div className="space-y-2">
          <p className="text-xs font-medium">Sub-categories</p>

          {fields.map((field, index) => {
            const rowError = errors.subCategories?.[index]?.name?.message;
            return (
              <div key={field.id}>
                <div className="flex items-center gap-2">
                  <Input
                    {...register(`subCategories.${index}.name`)}
                    aria-label={`Sub-category ${index + 1}`}
                    aria-invalid={Boolean(rowError)}
                    placeholder="Chandeliers"
                    disabled={mutation.isPending}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={mutation.isPending}
                    aria-label={`Remove sub-category ${index + 1}`}
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
            onClick={() => append({ subCategoryId: "", name: "" })}
            disabled={mutation.isPending}
          >
            <Plus />
            Add sub-category
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

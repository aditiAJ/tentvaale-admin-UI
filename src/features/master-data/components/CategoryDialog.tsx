"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
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
});

type FormValues = z.output<typeof schema>;

/**
 * Add or edit one category.
 *
 * Renaming one is safe in a way it would not normally be: a product stores a
 * category *id* and ProductView resolves the name on read, so every product in
 * the category follows the rename on its next load. Nothing has to be
 * backfilled, and nothing goes stale.
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
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: existing?.name ?? "" },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      existing ? updateCategory(existing.id, values) : createCategory(values),
    onSuccess: (category) => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.categories });
      // A rename changes what every product in it displays.
      queryClient.invalidateQueries({ queryKey: masterDataKeys.products });
      toast.success(existing ? `${category.name} updated` : `${category.name} added`);
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

        <Field label="Name" required error={errors.name?.message} hint="Unique per company.">
          {(props) => <Input {...props} {...register("name")} placeholder="Lighting" autoFocus />}
        </Field>
      </form>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createCategory, masterDataKeys } from "@/features/master-data/api";
import { ApiError } from "@/services/api-client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150, "Maximum 150 characters"),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const EMPTY: FormInput = { name: "" };

/**
 * Mounted only while it is open, so opening it is what resets it — same
 * reasoning as CreateProductDialog.
 */
export function CreateCategoryDialog({ onClose }: { onClose: () => void }) {
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
    mutationFn: createCategory,
    onSuccess: (category) => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.categories });
      toast.success(`${category.name} added`);
      onClose();
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Could not save the category.");
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
      title="New category"
      description="Added to this company's catalogue and immediately active."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button form="create-category" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            Create category
          </Button>
        </>
      }
    >
      <form id="create-category" onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError ? <Alert tone="error" title={formError} /> : null}

        <Field label="Name" required error={errors.name?.message}>
          {(props) => <Input {...props} {...register("name")} placeholder="Lighting" />}
        </Field>
      </form>
    </Dialog>
  );
}

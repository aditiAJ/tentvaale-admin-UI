"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createWarehouse, masterDataKeys, updateWarehouse } from "@/features/master-data/api";
import type { WarehouseView } from "@/features/master-data/types";
import { ApiError } from "@/services/api-client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

const FORM_ID = "warehouse-form";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150, "Maximum 150 characters"),
  city: z.string().trim().min(1, "City is required").max(100, "Maximum 100 characters"),
});

type FormValues = z.output<typeof schema>;

/**
 * One dialog for both adding and editing, keyed on whether `existing` is given.
 *
 * Two dialogs would be two copies of the same four lines of validation, and the
 * pair would drift the first time a field was added to one of them. It is
 * mounted only while open, so opening it is what loads the record's values —
 * the same reason CreateProductDialog is mounted on demand.
 */
export function WarehouseDialog({
  existing,
  onClose,
}: {
  existing?: WarehouseView;
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
    defaultValues: { name: existing?.name ?? "", city: existing?.city ?? "" },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      existing ? updateWarehouse(existing.id, values) : createWarehouse(values),
    onSuccess: (warehouse) => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.warehouses });
      toast.success(existing ? `${warehouse.name} updated` : `${warehouse.name} added`, {
        description: warehouse.city,
      });
      onClose();
    },
    onError: (error) =>
      setFormError(error instanceof ApiError ? error.message : "Could not save the warehouse."),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={existing ? "Edit warehouse" : "New warehouse"}
      description="Where stock is held between events."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button form={FORM_ID} type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            {existing ? "Save changes" : "Create warehouse"}
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
          {(props) => (
            <Input {...props} {...register("name")} placeholder="Andheri Main Store" autoFocus />
          )}
        </Field>

        <Field label="City" required error={errors.city?.message}>
          {(props) => <Input {...props} {...register("city")} placeholder="Mumbai" />}
        </Field>
      </form>
    </Dialog>
  );
}

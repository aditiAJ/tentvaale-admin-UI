"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createTruck, masterDataKeys, updateTruck } from "@/features/master-data/api";
import type { TruckView } from "@/features/master-data/types";
import { ApiError } from "@/services/api-client";
import { positiveIntegerField } from "@/lib/forms";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

const FORM_ID = "truck-form";

const schema = z.object({
  registration: z
    .string()
    .trim()
    .min(1, "Registration is required")
    .max(20, "Maximum 20 characters"),
  capacityKg: positiveIntegerField("Capacity"),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

/** Add or edit one truck — see WarehouseDialog for why it is one dialog. */
export function TruckDialog({ existing, onClose }: { existing?: TruckView; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      registration: existing?.registration ?? "",
      capacityKg: existing ? String(existing.capacityKg) : "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormOutput) =>
      existing ? updateTruck(existing.id, values) : createTruck(values),
    onSuccess: (truck) => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.trucks });
      toast.success(existing ? `${truck.registration} updated` : `${truck.registration} added`);
      onClose();
    },
    onError: (error) =>
      setFormError(error instanceof ApiError ? error.message : "Could not save the truck."),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={existing ? "Edit truck" : "New truck"}
      description="The fleet that moves stock to and from events."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button form={FORM_ID} type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            {existing ? "Save changes" : "Create truck"}
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

        <Field label="Registration" required error={errors.registration?.message}>
          {(props) => (
            <Input
              {...props}
              {...register("registration")}
              placeholder="MH 01 AB 4471"
              autoFocus
              className="font-mono"
            />
          )}
        </Field>

        <Field
          label="Capacity"
          required
          error={errors.capacityKg?.message}
          hint="In kilograms."
        >
          {(props) => (
            <Input {...props} {...register("capacityKg")} inputMode="numeric" placeholder="3500" />
          )}
        </Field>
      </form>
    </Dialog>
  );
}

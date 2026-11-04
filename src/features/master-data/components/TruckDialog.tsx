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
import { VEHICLE_TYPES } from "@/features/master-data/trucks";
import { ApiError } from "@/services/api-client";
import { positiveIntegerField } from "@/lib/forms";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { ActiveToggle } from "@/features/master-data/components/ActiveToggle";

const FORM_ID = "truck-form";

const schema = z.object({
  registration: z
    .string()
    .trim()
    .min(1, "Registration is required")
    .max(20, "Maximum 20 characters"),
  vehicleType: z.string(),
  make: z.string().trim().max(60, "Maximum 60 characters"),
  model: z.string().trim().max(60, "Maximum 60 characters"),
  capacityKg: positiveIntegerField("Capacity"),
  // Typed as text so an empty box stays "not given" instead of becoming 0.
  volumeCapacityM3: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{1,6}(\.\d{1,2})?$/.test(value), "Enter a number like 12 or 12.5")
    .refine((value) => value === "" || Number(value) > 0, "Volume must be more than 0"),
  notes: z.string().trim().max(500, "Maximum 500 characters"),
  inMaintenance: z.boolean(),
  active: z.boolean(),
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
      vehicleType: existing?.vehicleType ?? "",
      make: existing?.make ?? "",
      model: existing?.model ?? "",
      capacityKg: existing ? String(existing.capacityKg) : "",
      volumeCapacityM3: existing?.volumeCapacityM3 == null ? "" : String(existing.volumeCapacityM3),
      notes: existing?.notes ?? "",
      inMaintenance: existing?.inMaintenance ?? false,
      active: existing?.active ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormOutput) => {
      // An edit replaces every field on the server, so all of them are sent; a new truck is always active.
      const request = {
        registration: values.registration,
        capacityKg: values.capacityKg,
        vehicleType: values.vehicleType,
        make: values.make,
        model: values.model,
        volumeCapacityM3: values.volumeCapacityM3 === "" ? undefined : Number(values.volumeCapacityM3),
        notes: values.notes,
        inMaintenance: values.inMaintenance,
      };
      return existing ? updateTruck(existing.id, { ...request, active: values.active }) : createTruck(request);
    },
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
      className="max-w-xl"
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

        <div className="grid gap-4 sm:grid-cols-2">
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
          <Field label="Vehicle type" error={errors.vehicleType?.message}>
            {(props) => (
              <Select {...props} {...register("vehicleType")}>
                <option value="">Not recorded</option>
                {VEHICLE_TYPES.map((type) => (
                  <option key={type.code} value={type.code}>
                    {type.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Make" error={errors.make?.message}>
            {(props) => <Input {...props} {...register("make")} placeholder="Tata" />}
          </Field>
          <Field label="Model" error={errors.model?.message}>
            {(props) => <Input {...props} {...register("model")} placeholder="Ace" />}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Load capacity"
            required
            error={errors.capacityKg?.message}
            hint="In kilograms."
          >
            {(props) => (
              <Input {...props} {...register("capacityKg")} inputMode="numeric" placeholder="3500" className="tabular" />
            )}
          </Field>
          <Field
            label="Cargo space"
            error={errors.volumeCapacityM3?.message}
            hint="In cubic metres. Optional."
          >
            {(props) => (
              <Input {...props} {...register("volumeCapacityM3")} inputMode="decimal" placeholder="12.5" className="tabular" />
            )}
          </Field>
        </div>

        <Field label="Notes" error={errors.notes?.message} hint="Tail lift, side-loading, anything the loaders should know.">
          {(props) => <Textarea {...props} {...register("notes")} rows={2} />}
        </Field>

        <div className="space-y-3">
          <ActiveToggle
            {...register("inMaintenance")}
            label="In maintenance"
            hint="Stays on the fleet but is shown as not available to send out."
          />
          {existing ? (
            <ActiveToggle
              {...register("active")}
              label="Active"
              hint="An inactive truck is kept on record but not offered."
            />
          ) : null}
        </div>
      </form>
    </Dialog>
  );
}

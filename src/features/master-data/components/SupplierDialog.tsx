"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createSupplier, masterDataKeys, updateSupplier } from "@/features/master-data/api";
import type { SupplierView } from "@/features/master-data/types";
import { ActiveToggle } from "@/features/master-data/components/ActiveToggle";
import { GSTIN_PATTERN } from "@/features/master-data/supplierUtils";
import { ApiError } from "@/services/api-client";
import { isValidPhone } from "@/lib/forms";
import { INDIAN_STATES } from "@/lib/indian-states";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { StateSelect, initialState } from "@/components/ui/state-select";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

const FORM_ID = "supplier-form";

/** A count typed as text so an empty box stays "not given" instead of becoming 0. */
const optionalWhole = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d+$/.test(value), `${label}: whole numbers only`)
    .refine((value) => value === "" || (Number(value) >= min && Number(value) <= max), `${label} must be ${min} to ${max}`);

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Maximum 200 characters"),
  contactPerson: z.string().trim().max(150, "Maximum 150 characters"),
  phone: z
    .string()
    .trim()
    .max(30, "Maximum 30 characters")
    .refine((value) => value === "" || isValidPhone(value), "Enter a valid phone number"),
  email: z
    .string()
    .trim()
    .max(255, "Maximum 255 characters")
    .refine((value) => value === "" || z.email().safeParse(value).success, "Enter a valid email address"),
  addressLine: z.string().trim().max(500, "Maximum 500 characters"),
  city: z.string().trim().max(100, "Maximum 100 characters"),
  state: z.string(),
  gstin: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => value === "" || GSTIN_PATTERN.test(value), "A GSTIN has 15 characters, like 27AAAAA0000A1Z5"),
  notes: z.string().trim().max(1000, "Maximum 1000 characters"),
  leadTimeDays: optionalWhole("Lead time", 0, 365),
  minimumOrderQuantity: optionalWhole("Minimum order", 1, 100000),
  active: z.boolean(),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

/** Add or edit one rental supplier. Suppliers are internal: they never appear on the storefront. */
export function SupplierDialog({
  existing,
  onClose,
}: {
  existing?: SupplierView;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  // Switching a supplier off asks first; the values wait here until the answer is yes.
  const [confirming, setConfirming] = useState<FormValues | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: existing?.name ?? "",
      contactPerson: existing?.contactPerson ?? "",
      phone: existing?.phone ?? "",
      email: existing?.email ?? "",
      addressLine: existing?.addressLine ?? "",
      city: existing?.city ?? "",
      state: initialState(existing?.state),
      gstin: existing?.gstin ?? "",
      notes: existing?.notes ?? "",
      leadTimeDays: existing?.leadTimeDays == null ? "" : String(existing.leadTimeDays),
      minimumOrderQuantity: existing?.minimumOrderQuantity == null ? "" : String(existing.minimumOrderQuantity),
      active: existing?.active ?? true,
    },
  });

  const gstin = (useWatch({ control, name: "gstin" }) ?? "").trim().toUpperCase();
  // The first two digits of a GSTIN are the state: say which, so a typo in either shows up.
  const gstinState = GSTIN_PATTERN.test(gstin)
    ? INDIAN_STATES.find((state) => state.gstCode === gstin.slice(0, 2))?.name
    : undefined;

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const request = {
        name: values.name,
        contactPerson: values.contactPerson,
        phone: values.phone,
        email: values.email,
        addressLine: values.addressLine,
        city: values.city,
        state: values.state,
        gstin: values.gstin,
        notes: values.notes,
        leadTimeDays: values.leadTimeDays === "" ? undefined : Number(values.leadTimeDays),
        minimumOrderQuantity: values.minimumOrderQuantity === "" ? undefined : Number(values.minimumOrderQuantity),
      };
      return existing
        ? updateSupplier(existing.id, { ...request, active: values.active })
        : createSupplier(request);
    },
    onSuccess: (supplier) => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.suppliers });
      toast.success(existing ? `${supplier.name} updated` : `${supplier.name} added`);
      onClose();
    },
    onError: (error) =>
      setFormError(error instanceof ApiError ? error.message : "Could not save the supplier."),
  });

  return (
    <>
    <Dialog
      open
      onClose={onClose}
      title={existing ? "Edit supplier" : "New supplier"}
      description="Where extra stock is rented from when your own runs out."
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button form={FORM_ID} type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            {existing ? "Save changes" : "Create supplier"}
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
          if (existing?.active && !values.active) {
            setConfirming(values);
            return;
          }
          mutation.mutate(values);
        })}
      >
        {formError ? <Alert tone="error" title={formError} /> : null}

        <Field label="Name" required error={errors.name?.message}>
          {(props) => <Input {...props} {...register("name")} placeholder="Rental Hub" autoFocus />}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact person" error={errors.contactPerson?.message}>
            {(props) => <Input {...props} {...register("contactPerson")} placeholder="Raj Mehta" />}
          </Field>
          <Field label="Phone" error={errors.phone?.message}>
            {(props) => <Input {...props} {...register("phone")} placeholder="+91 98200 11223" />}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" error={errors.email?.message}>
            {(props) => <Input {...props} {...register("email")} type="email" autoComplete="off" />}
          </Field>
          <Field
            label="GSTIN"
            error={errors.gstin?.message}
            hint={gstinState ? `State code ${gstin.slice(0, 2)}: ${gstinState}` : "Optional. 15 characters."}
          >
            {(props) => (
              <Input {...props} {...register("gstin")} placeholder="27AAAAA0000A1Z5" className="uppercase" />
            )}
          </Field>
        </div>

        <Field label="Address" error={errors.addressLine?.message}>
          {(props) => <Textarea {...props} {...register("addressLine")} rows={2} />}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City" error={errors.city?.message}>
            {(props) => <Input {...props} {...register("city")} placeholder="Pune" />}
          </Field>
          <Field label="State" error={errors.state?.message}>
            {(props) => (
              <Controller
                control={control}
                name="state"
                render={({ field }) => (
                  <StateSelect
                    id={props.id}
                    aria-invalid={props["aria-invalid"]}
                    value={field.value}
                    onChange={field.onChange}
                    clearable
                  />
                )}
              />
            )}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Lead time (days)"
            error={errors.leadTimeDays?.message}
            hint="How long from asking to the stock arriving."
          >
            {(props) => <Input {...props} {...register("leadTimeDays")} inputMode="numeric" placeholder="3" className="tabular" />}
          </Field>
          <Field
            label="Minimum order (units)"
            error={errors.minimumOrderQuantity?.message}
            hint="The smallest quantity they rent out at once."
          >
            {(props) => (
              <Input {...props} {...register("minimumOrderQuantity")} inputMode="numeric" placeholder="10" className="tabular" />
            )}
          </Field>
        </div>

        <Field label="Notes" error={errors.notes?.message} hint="Payment terms, pickup details, who to ask for. Internal only.">
          {(props) => <Textarea {...props} {...register("notes")} rows={3} />}
        </Field>

        {existing ? (
          <ActiveToggle
            {...register("active")}
            label="Active"
            hint="An inactive supplier is kept on record but not offered."
          />
        ) : null}
      </form>
    </Dialog>

    {confirming ? (
      <ConfirmDialog
        title={`Deactivate ${existing?.name}?`}
        description="It stays on record with its stock and history, but is no longer offered. You can switch it back on from Edit."
        confirmLabel="Deactivate"
        fallbackError="Could not save the supplier."
        action={() => mutation.mutateAsync(confirming)}
        onDone={() => setConfirming(null)}
        onClose={() => setConfirming(null)}
      />
    ) : null}
    </>
  );
}

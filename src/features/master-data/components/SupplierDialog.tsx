"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createSupplier, masterDataKeys, updateSupplier } from "@/features/master-data/api";
import type { SupplierView } from "@/features/master-data/types";
import { ActiveToggle } from "@/features/master-data/components/ActiveToggle";
import { ApiError } from "@/services/api-client";
import { isValidPhone } from "@/lib/forms";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

const FORM_ID = "supplier-form";

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
  gstin: z.string().trim().max(20, "Maximum 20 characters"),
  active: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: existing?.name ?? "",
      contactPerson: existing?.contactPerson ?? "",
      phone: existing?.phone ?? "",
      email: existing?.email ?? "",
      addressLine: existing?.addressLine ?? "",
      gstin: existing?.gstin ?? "",
      active: existing?.active ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      existing ? updateSupplier(existing.id, values) : createSupplier({ ...values, active: undefined }),
    onSuccess: (supplier) => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.suppliers });
      toast.success(existing ? `${supplier.name} updated` : `${supplier.name} added`);
      onClose();
    },
    onError: (error) =>
      setFormError(error instanceof ApiError ? error.message : "Could not save the supplier."),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={existing ? "Edit supplier" : "New supplier"}
      description="Where extra stock is rented from when your own runs out."
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
          <Field label="GSTIN" error={errors.gstin?.message}>
            {(props) => <Input {...props} {...register("gstin")} placeholder="Optional" />}
          </Field>
        </div>

        <Field label="Address" error={errors.addressLine?.message}>
          {(props) => <Textarea {...props} {...register("addressLine")} rows={2} />}
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
  );
}

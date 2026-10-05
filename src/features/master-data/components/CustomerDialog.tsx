"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createCustomer, masterDataKeys, updateCustomer } from "@/features/master-data/api";
import type { CustomerView } from "@/features/master-data/types";
import { ApiError } from "@/services/api-client";
import { isValidPhone } from "@/lib/forms";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

const FORM_ID = "customer-form";

const ACCOUNT_TYPES: { value: CustomerView["accountType"]; label: string }[] = [
  { value: "CUSTOMER", label: "Customer" },
  { value: "EVENT_PLANNER", label: "Event planner" },
];

const schema = z.object({
  fullName: z.string().trim().min(1, "Name is required").max(200, "Maximum 200 characters"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .refine((value) => z.email().safeParse(value).success, "Enter a valid email address"),
  phone: z
    .string()
    .trim()
    .max(30, "Maximum 30 characters")
    .refine((value) => value === "" || isValidPhone(value), "Enter a valid phone number")
    .transform((value) => (value === "" ? undefined : value)),
  accountType: z.enum(["CUSTOMER", "EVENT_PLANNER"]),
  gstin: z
    .string()
    .trim()
    .max(20, "Maximum 20 characters")
    .transform((value) => (value === "" ? undefined : value)),
  state: z
    .string()
    .trim()
    .max(100, "Maximum 100 characters")
    .transform((value) => (value === "" ? undefined : value)),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

/**
 * Add or edit one customer account.
 *
 * A back-office customer record: no password and no login. A storefront account is a separate
 * record linked to it later, so this asks only for what staff know about someone who books by phone.
 */
export function CustomerDialog({
  existing,
  onClose,
}: {
  existing?: CustomerView;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: existing?.fullName ?? "",
      email: existing?.email ?? "",
      phone: existing?.phone ?? "",
      accountType: existing?.accountType ?? "CUSTOMER",
      gstin: existing?.gstin ?? "",
      state: existing?.state ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormOutput) =>
      existing ? updateCustomer(existing.id, values) : createCustomer(values),
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.customers });
      toast.success(existing ? `${customer.fullName} updated` : `${customer.fullName} added`, {
        description: customer.email,
      });
      onClose();
    },
    onError: (error) =>
      setFormError(error instanceof ApiError ? error.message : "Could not save the customer."),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={existing ? "Edit customer" : "New customer"}
      description={
        existing ? `ID ${existing.id}` : "An account that can be quoted and ordered against."
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button form={FORM_ID} type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            {existing ? "Save changes" : "Create customer"}
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

        <Field label="Full name" required error={errors.fullName?.message}>
          {(props) => (
            <Input {...props} {...register("fullName")} placeholder="Amit Shah" autoFocus />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" required error={errors.email?.message}>
            {(props) => (
              <Input
                {...props}
                {...register("email")}
                type="email"
                autoComplete="off"
                placeholder="amit.shah@example.com"
              />
            )}
          </Field>

          <Field label="Phone" error={errors.phone?.message}>
            {(props) => <Input {...props} {...register("phone")} placeholder="+91 98200 11223" />}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Account type" required error={errors.accountType?.message}>
            {(props) => (
              <Select {...props} {...register("accountType")}>
                {ACCOUNT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="GSTIN" error={errors.gstin?.message}>
            {(props) => <Input {...props} {...register("gstin")} placeholder="Optional" />}
          </Field>

          <Field label="State" error={errors.state?.message} hint="Decides CGST + SGST or IGST. Needed before a quotation is sent.">
            {(props) => <Input {...props} {...register("state")} placeholder="Gujarat" />}
          </Field>
        </div>
      </form>
    </Dialog>
  );
}

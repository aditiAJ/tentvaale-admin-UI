"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import { StateSelect, initialState } from "@/components/ui/state-select";
import { isStateName } from "@/lib/indian-states";

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
  // Optional, but never free text: a state from the list, or empty. An old saved value nobody can read blocks the save
  // until it is corrected or cleared, so nothing is dropped unseen (and the server would refuse it anyway).
  state: z
    .string()
    .trim()
    .refine((value) => value === "" || isStateName(value), "Choose a state from the list, or clear it")
    .transform((value) => (value === "" ? undefined : value)),
  addressLine: z
    .string()
    .trim()
    .max(500, "Maximum 500 characters")
    .transform((value) => (value === "" ? undefined : value)),
  postalCode: z
    .string()
    .trim()
    .max(20, "Maximum 20 characters")
    .transform((value) => (value === "" ? undefined : value)),
  // An event planner's percentage off retail. Blank is left out, so the backend keeps what is set (20 for a new planner).
  plannerDiscountPercent: z
    .string()
    .trim()
    .refine((value) => value === "" || (/^\d{1,3}(\.\d{1,2})?$/.test(value) && Number(value) <= 100), "Enter a percentage from 0 to 100")
    .transform((value) => (value === "" ? undefined : Number(value))),
  // A regular customer's percentage off retail. Blank is left out, so the backend keeps what is set (0 for a new customer).
  customerDiscountPercent: z
    .string()
    .trim()
    .refine((value) => value === "" || (/^\d{1,3}(\.\d{1,2})?$/.test(value) && Number(value) <= 100), "Enter a percentage from 0 to 100")
    .transform((value) => (value === "" ? undefined : Number(value))),
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
    control,
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
      state: initialState(existing?.state),
      addressLine: existing?.addressLine ?? "",
      postalCode: existing?.postalCode ?? "",
      plannerDiscountPercent: String(existing?.plannerDiscountPercent ?? 20),
      customerDiscountPercent: String(existing?.customerDiscountPercent ?? 0),
    },
  });
  const accountType = useWatch({ control, name: "accountType" });

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
          // A planner and a regular customer each have their own discount; only the one that applies is sent.
          const isPlanner = values.accountType === "EVENT_PLANNER";
          mutation.mutate({
            ...values,
            plannerDiscountPercent: isPlanner ? values.plannerDiscountPercent : undefined,
            customerDiscountPercent: isPlanner ? undefined : values.customerDiscountPercent,
          });
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

          {accountType === "EVENT_PLANNER" ? (
            <Field
              label="Planner discount (%)"
              error={errors.plannerDiscountPercent?.message}
              hint="20 is the wholesale rate (the default). A higher number gives this planner a further discount, a lower one gives less, and 0 gives none: they pay retail."
            >
              {(props) => (
                <Input {...props} {...register("plannerDiscountPercent")} inputMode="decimal" placeholder="20" />
              )}
            </Field>
          ) : (
            <Field
              label="Customer discount (%)"
              error={errors.customerDiscountPercent?.message}
              hint="Percentage off the retail rate for this customer. 0 (the default) means they pay retail."
            >
              {(props) => (
                <Input {...props} {...register("customerDiscountPercent")} inputMode="decimal" placeholder="0" />
              )}
            </Field>
          )}

          <Field label="GSTIN" error={errors.gstin?.message}>
            {(props) => <Input {...props} {...register("gstin")} placeholder="Optional" />}
          </Field>

          <Field label="State" error={errors.state?.message} hint="Decides CGST + SGST or IGST. Needed before a quotation is sent.">
            {(props) => (
              <Controller
                control={control}
                name="state"
                render={({ field }) => (
                  <StateSelect id={props.id} aria-invalid={props["aria-invalid"]} value={field.value ?? ""} onChange={field.onChange} clearable />
                )}
              />
            )}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <Field label="Address" error={errors.addressLine?.message}>
            {(props) => (
              <Input {...props} {...register("addressLine")} placeholder="12, Alkapuri Society, Vadodara" />
            )}
          </Field>

          <Field label="PIN code" error={errors.postalCode?.message}>
            {(props) => <Input {...props} {...register("postalCode")} placeholder="390007" inputMode="numeric" />}
          </Field>
        </div>
      </form>
    </Dialog>
  );
}

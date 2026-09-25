"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { creditNoteKeys, issueCreditNote } from "@/features/credit-notes/api";
import type { OrderView } from "@/features/orders/types";
import type { CustomerView } from "@/features/master-data/types";
import { ApiError } from "@/services/api-client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

/**
 * Kept as a string through validation for the same reason the product form
 * does it: a number input bound to a coercing schema turns an empty field into
 * a legitimate zero, and the backend refuses a non-positive amount with a 422.
 * Making "blank" and "zero" different answers catches that here instead.
 */
export const creditAmountField = z
  .string()
  .trim()
  .min(1, "Amount is required")
  .regex(/^\d+(\.\d{1,2})?$/, "Enter an amount like 1500 or 1500.50")
  .transform(Number)
  .refine((value) => value > 0, "Amount must be more than zero");

const schema = z.object({
  amount: creditAmountField,
  againstOrderId: z.string().transform((value) => (value === "" ? undefined : value)),
  reason: z.string().trim().max(1000, "Maximum 1000 characters").optional(),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const EMPTY: FormInput = { amount: "", againstOrderId: "", reason: "" };

export function IssueCreditNoteDialog({
  customer,
  orders,
  onClose,
}: {
  customer: CustomerView;
  /** The customer's orders; a note may name one of them. */
  orders: OrderView[];
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
    defaultValues: EMPTY,
  });

  const mutation = useMutation({
    mutationFn: (values: FormOutput) => issueCreditNote({ ...values, customerId: customer.id }),
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: creditNoteKeys.byCustomer(customer.id) });
      queryClient.invalidateQueries({ queryKey: creditNoteKeys.balance(customer.id) });
      toast.success(`${note.creditNoteNumber} issued`);
      onClose();
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Could not issue the credit note.");
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
      title="Issue credit note"
      description={customer.fullName}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button form="issue-credit-note" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            Issue credit note
          </Button>
        </>
      }
    >
      <form id="issue-credit-note" onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError ? <Alert tone="error" title={formError} /> : null}

        <Field label="Amount" required error={errors.amount?.message}>
          {(props) => (
            <Input {...props} {...register("amount")} inputMode="decimal" placeholder="2500.00" />
          )}
        </Field>

        <Field label="Against order" error={errors.againstOrderId?.message}>
          {(props) => (
            <Select {...props} {...register("againstOrderId")}>
              <option value="">Not against an order</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.orderNumber} · {order.status.toLowerCase()}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Reason" error={errors.reason?.message}>
          {(props) => (
            <Textarea {...props} {...register("reason")} placeholder="Why this credit was given" />
          )}
        </Field>
      </form>
    </Dialog>
  );
}

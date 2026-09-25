"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { applyCreditNote, creditNoteKeys } from "@/features/credit-notes/api";
import { remainingCredit, type CreditNoteView } from "@/features/credit-notes/types";
import { creditAmountField } from "@/features/credit-notes/components/IssueCreditNoteDialog";
import type { OrderView } from "@/features/orders/types";
import { ApiError } from "@/services/api-client";
import { formatMoney } from "@/lib/money";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

const FORM_ID = "apply-credit-note";

/**
 * Applies part or all of what remains on a note to one of the customer's
 * orders. The order list is the customer's own, less cancelled ones — the same
 * orders the store accepts.
 */
export function ApplyCreditNoteDialog({
  note,
  orders,
  onClose,
}: {
  note: CreditNoteView;
  orders: OrderView[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const remaining = remainingCredit(note);
  const currency = note.amount.currency;
  const eligible = orders.filter((order) => order.status !== "CANCELLED");

  const schema = z.object({
    orderId: z.string().min(1, "Choose an order"),
    amount: creditAmountField.refine(
      (value) => Math.round(value * 100) <= Math.round(remaining * 100),
      `No more than ${formatMoney({ amount: remaining, currency })} remains`,
    ),
  });
  type FormInput = z.input<typeof schema>;
  type FormOutput = z.output<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      // The note's own order is the likeliest target, when it names one.
      orderId: eligible.some((order) => order.id === note.againstOrderId)
        ? (note.againstOrderId ?? "")
        : "",
      amount: remaining.toFixed(2),
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormOutput) => applyCreditNote(note.id, values),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: creditNoteKeys.byCustomer(note.customerId) });
      queryClient.invalidateQueries({ queryKey: creditNoteKeys.balance(note.customerId) });
      toast.success(`Credit applied from ${updated.creditNoteNumber}`, {
        description: `${formatMoney({ amount: remainingCredit(updated), currency })} remains`,
      });
      onClose();
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Could not apply the credit.");
    },
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Apply ${note.creditNoteNumber}`}
      description={`${formatMoney({ amount: remaining, currency })} available`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            form={FORM_ID}
            type="submit"
            disabled={mutation.isPending || eligible.length === 0}
          >
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            Apply credit
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
        {eligible.length === 0 ? (
          <Alert tone="warning" title="This customer has no order the credit can be applied to." />
        ) : null}

        <Field label="Order" required error={errors.orderId?.message}>
          {(props) => (
            <Select {...props} {...register("orderId")} disabled={mutation.isPending}>
              <option value="">Choose an order</option>
              {eligible.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.orderNumber} · {order.status.toLowerCase()} ·{" "}
                  {formatMoney(order.totalAmount)}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Amount" required error={errors.amount?.message}>
          {(props) => (
            <Input
              {...props}
              {...register("amount")}
              inputMode="decimal"
              disabled={mutation.isPending}
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createPaymentMode, masterDataKeys, updatePaymentMode } from "@/features/master-data/api";
import type { PaymentModeView } from "@/features/master-data/types";
import { ActiveToggle } from "@/features/master-data/components/ActiveToggle";
import { ApiError } from "@/services/api-client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

const FORM_ID = "payment-mode-form";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Maximum 100 characters"),
  active: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

/** Add or rename a way of paying (Cash, UPI, Bank transfer). Modes are switched off, not deleted. */
export function PaymentModeDialog({
  existing,
  onClose,
}: {
  existing?: PaymentModeView;
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
    defaultValues: { name: existing?.name ?? "", active: existing?.active ?? true },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      existing
        ? updatePaymentMode(existing.id, values)
        : createPaymentMode({ name: values.name }),
    onSuccess: (mode) => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.paymentModes });
      toast.success(existing ? `${mode.name} updated` : `${mode.name} added`);
      onClose();
    },
    onError: (error) =>
      setFormError(error instanceof ApiError ? error.message : "Could not save the payment mode."),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={existing ? "Edit payment mode" : "New payment mode"}
      description="A way a customer can pay."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button form={FORM_ID} type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            {existing ? "Save changes" : "Create payment mode"}
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
          {(props) => <Input {...props} {...register("name")} placeholder="UPI" autoFocus />}
        </Field>
        {existing ? (
          <ActiveToggle
            {...register("active")}
            label="Active"
            hint="An inactive mode is kept on record but not offered."
          />
        ) : null}
      </form>
    </Dialog>
  );
}

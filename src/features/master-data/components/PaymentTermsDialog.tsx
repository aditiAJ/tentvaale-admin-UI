"use client";

import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createPaymentTerms, masterDataKeys, updatePaymentTerms } from "@/features/master-data/api";
import type { PaymentTermsView } from "@/features/master-data/types";
import { ActiveToggle } from "@/features/master-data/components/ActiveToggle";
import { ApiError } from "@/services/api-client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

const FORM_ID = "payment-terms-form";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150, "Maximum 150 characters"),
  description: z.string().trim().max(1000, "Maximum 1000 characters"),
  active: z.boolean(),
  details: z
    .array(
      z.object({
        description: z.string().trim().min(1, "Describe the payment").max(300, "Maximum 300 characters"),
        // More than 0, at most 100, up to two decimals.
        percentage: z
          .string()
          .trim()
          .regex(/^\d{1,3}(\.\d{1,2})?$/, "A percentage like 50 or 33.33")
          .transform(Number)
          .refine((value) => value > 0 && value <= 100, "Between 0 and 100"),
      }),
    )
    .min(1, "Add at least one payment"),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

/** Rounds away floating point noise: 33.34 + 33.33 + 33.33 must show as 100, not 99.99999999999999. */
const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Add or edit a reusable payment schedule: a list of payments, each a share of the total, that must
 * add up to exactly 100%. The running total is shown as you type, because the server refuses
 * anything else.
 */
export function PaymentTermsDialog({
  existing,
  onClose,
}: {
  existing?: PaymentTermsView;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: existing?.name ?? "",
      description: existing?.description ?? "",
      active: existing?.active ?? true,
      details: (existing?.details ?? [{ description: "", percentage: 0 }]).map((line) => ({
        description: line.description,
        percentage: line.percentage ? String(line.percentage) : "",
      })),
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "details" });
  const watched = useWatch({ control, name: "details" });

  const total = round2(
    (watched ?? []).reduce((sum, line) => {
      const value = Number(line?.percentage);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0),
  );
  const balanced = total === 100;

  const mutation = useMutation({
    mutationFn: (values: FormOutput) => {
      const request = {
        name: values.name,
        description: values.description,
        active: values.active,
        details: values.details,
      };
      return existing ? updatePaymentTerms(existing.id, request) : createPaymentTerms(request);
    },
    onSuccess: (terms) => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.paymentTerms });
      toast.success(existing ? `${terms.name} updated` : `${terms.name} added`);
      onClose();
    },
    onError: (error) =>
      setFormError(error instanceof ApiError ? error.message : "Could not save the payment terms."),
  });

  const linesError = errors.details?.root?.message ?? errors.details?.message;

  return (
    <Dialog
      open
      onClose={onClose}
      title={existing ? "Edit payment terms" : "New payment terms"}
      description="A reusable payment schedule for quotations and orders."
      className="max-w-xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button form={FORM_ID} type="submit" disabled={mutation.isPending || !balanced}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            {existing ? "Save changes" : "Create payment terms"}
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
          {(props) => <Input {...props} {...register("name")} placeholder="50% advance, 50% before event" autoFocus />}
        </Field>
        <Field label="Description" error={errors.description?.message}>
          {(props) => <Input {...props} {...register("description")} placeholder="Optional" />}
        </Field>
        {existing ? (
          <ActiveToggle
            {...register("active")}
            label="Active"
            hint="Inactive terms are kept on record but not offered."
          />
        ) : null}

        <div className="space-y-2">
          <p className="text-xs font-medium">
            Payments
            <span className="ml-0.5 text-destructive">*</span>
          </p>
          <ul className="space-y-2">
            {fields.map((field, index) => {
              const lineErrors = errors.details?.[index];
              return (
                <li key={field.id}>
                  <div className="flex items-start gap-2">
                    <Input
                      {...register(`details.${index}.description`)}
                      aria-label={`Payment ${index + 1} description`}
                      aria-invalid={Boolean(lineErrors?.description)}
                      placeholder="On booking"
                      disabled={mutation.isPending}
                    />
                    <Input
                      {...register(`details.${index}.percentage`)}
                      inputMode="decimal"
                      aria-label={`Payment ${index + 1} percentage`}
                      aria-invalid={Boolean(lineErrors?.percentage)}
                      placeholder="50"
                      className="tabular w-24 text-right"
                      disabled={mutation.isPending}
                    />
                    <span className="mt-2 text-xs text-muted-foreground">%</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => remove(index)}
                      disabled={mutation.isPending || fields.length === 1}
                      aria-label={`Remove payment ${index + 1}`}
                      title="Remove"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  {lineErrors?.description || lineErrors?.percentage ? (
                    <p className="mt-1 text-xs text-destructive">
                      {lineErrors.description?.message ?? lineErrors.percentage?.message}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ description: "", percentage: "" })}
              disabled={mutation.isPending}
            >
              <Plus />
              Add payment
            </Button>
            <p
              className={balanced ? "text-sm text-[var(--success)]" : "text-sm text-destructive"}
              aria-live="polite"
              data-testid="terms-total"
            >
              Total {total}% {balanced ? "✓" : "— must be 100%"}
            </p>
          </div>
          {linesError ? <p className="text-xs text-destructive">{linesError}</p> : null}
        </div>
      </form>
    </Dialog>
  );
}

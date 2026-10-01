"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { applyAsPlanner, masterDataKeys } from "@/features/master-data/api";
import type { CustomerView } from "@/features/master-data/types";
import { ApiError } from "@/services/api-client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

const FORM_ID = "planner-application-form";

const schema = z.object({
  businessName: z.string().trim().min(1, "Business name is required").max(200, "Maximum 200 characters"),
  yearsInBusiness: z.string().trim().max(30, "Maximum 30 characters"),
  about: z.string().trim().max(2000, "Maximum 2000 characters"),
});

type FormValues = z.infer<typeof schema>;

/**
 * Staff submitting a trade-pricing application on an event planner's behalf. It starts Pending and
 * waits in the queue for a decision; after a rejection, submitting again puts it back.
 */
export function PlannerApplicationDialog({
  customer,
  onClose,
}: {
  customer: CustomerView;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const previous = customer.plannerProfile;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      businessName: previous?.businessName ?? "",
      yearsInBusiness: previous?.yearsInBusiness ?? "",
      about: previous?.about ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => applyAsPlanner(customer.id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.customers });
      queryClient.invalidateQueries({ queryKey: masterDataKeys.plannerApplications });
      toast.success(`Application submitted for ${customer.fullName}`, {
        description: "It is in the queue for review.",
      });
      onClose();
    },
    onError: (error) =>
      setFormError(error instanceof ApiError ? error.message : "Could not submit the application."),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={previous ? "Resubmit planner application" : "Planner application"}
      description={`Trade pricing for ${customer.fullName}.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button form={FORM_ID} type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            Submit application
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
        {previous?.status === "REJECTED" && previous.rejectionReason ? (
          <Alert tone="warning" title={`Rejected: ${previous.rejectionReason}`} />
        ) : null}

        <Field label="Business name" required error={errors.businessName?.message}>
          {(props) => (
            <Input {...props} {...register("businessName")} placeholder="Priya Events LLP" autoFocus />
          )}
        </Field>
        <Field label="Years in business" error={errors.yearsInBusiness?.message}>
          {(props) => <Input {...props} {...register("yearsInBusiness")} placeholder="5" />}
        </Field>
        <Field label="About the business" error={errors.about?.message}>
          {(props) => <Textarea {...props} {...register("about")} rows={3} placeholder="Weddings and corporate events" />}
        </Field>
      </form>
    </Dialog>
  );
}

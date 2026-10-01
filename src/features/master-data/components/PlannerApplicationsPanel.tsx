"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  approvePlannerApplication,
  listPlannerApplications,
  masterDataKeys,
  rejectPlannerApplication,
} from "@/features/master-data/api";
import type { PlannerProfileView } from "@/features/master-data/types";
import { ApiError } from "@/services/api-client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const REJECT_FORM_ID = "reject-application-form";

/**
 * The event-planner verification queue, oldest first. It renders nothing while the queue is empty,
 * so the customer list is not pushed down by an empty box.
 */
export function PlannerApplicationsPanel({ canWrite }: { canWrite: boolean }) {
  const queryClient = useQueryClient();
  const [approving, setApproving] = useState<PlannerProfileView | null>(null);
  const [rejecting, setRejecting] = useState<PlannerProfileView | null>(null);

  const { data } = useQuery({
    queryKey: masterDataKeys.plannerApplications,
    queryFn: ({ signal }) => listPlannerApplications(signal),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: masterDataKeys.plannerApplications });
    queryClient.invalidateQueries({ queryKey: masterDataKeys.customers });
  }

  if (!data?.length) return null;

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">Planner applications</h2>
        <Badge variant="warning">{data.length} waiting</Badge>
      </div>

      <ul className="divide-y divide-border">
        {data.map((application) => (
          <li key={application.customerId} className="flex flex-wrap items-center gap-3 py-2.5">
            <div className="min-w-48 flex-1">
              <p className="text-sm font-medium">{application.businessName}</p>
              <p className="text-xs text-muted-foreground">
                {application.customerName ?? `Customer ${application.customerId}`}
                {application.yearsInBusiness ? ` · ${application.yearsInBusiness} years` : ""}
                {` · submitted ${new Date(application.submittedAt).toLocaleDateString()}`}
              </p>
              {application.about ? <p className="mt-1 text-xs">{application.about}</p> : null}
            </div>
            {canWrite ? (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setApproving(application)}>
                  <Check />
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRejecting(application)}>
                  <X />
                  Reject
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {approving ? (
        <ConfirmDialog
          title="Approve planner application"
          description={`${approving.businessName} becomes a verified planner and can be put on a price list.`}
          confirmLabel="Approve"
          destructive={false}
          fallbackError="Could not approve the application."
          action={() => approvePlannerApplication(approving.customerId)}
          onDone={() => {
            toast.success(`${approving.businessName} approved`);
            setApproving(null);
            refresh();
          }}
          onClose={() => setApproving(null)}
        />
      ) : null}

      {rejecting ? (
        <RejectDialog
          application={rejecting}
          onDone={() => {
            setRejecting(null);
            refresh();
          }}
          onClose={() => setRejecting(null)}
        />
      ) : null}
    </Card>
  );
}

function RejectDialog({
  application,
  onDone,
  onClose,
}: {
  application: PlannerProfileView;
  onDone: () => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => rejectPlannerApplication(application.customerId, reason.trim()),
    onSuccess: () => {
      toast.success(`${application.businessName} rejected`);
      onDone();
    },
    onError: (failure) =>
      setError(failure instanceof ApiError ? failure.message : "Could not reject the application."),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Reject planner application"
      description={`${application.businessName} will see this reason and can apply again.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            form={REJECT_FORM_ID}
            type="submit"
            variant="destructive"
            disabled={mutation.isPending || reason.trim() === ""}
          >
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            Reject
          </Button>
        </>
      }
    >
      <form
        id={REJECT_FORM_ID}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          mutation.mutate();
        }}
      >
        {error ? <Alert tone="error" title={error} /> : null}
        <Field label="Reason" required>
          {(props) => (
            <Textarea
              {...props}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={1000}
              rows={3}
              autoFocus
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
}

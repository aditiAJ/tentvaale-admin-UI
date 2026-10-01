"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { assignPriceList, listPriceLists, masterDataKeys } from "@/features/master-data/api";
import type { CustomerView } from "@/features/master-data/types";
import { ApiError } from "@/services/api-client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

const FORM_ID = "assign-price-list-form";

/**
 * Puts one event planner on a price list, or takes them off. The list gives trade rates only once
 * the planner's application is approved; this says so rather than leaving it a surprise.
 */
export function AssignPriceListDialog({
  customer,
  onClose,
}: {
  customer: CustomerView;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [choice, setChoice] = useState(customer.priceListId ?? "");
  const [error, setError] = useState<string | null>(null);

  const lists = useQuery({
    queryKey: masterDataKeys.priceLists,
    queryFn: ({ signal }) => listPriceLists(signal),
  });

  const mutation = useMutation({
    mutationFn: () => assignPriceList(customer.id, choice === "" ? null : choice),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: masterDataKeys.customers });
      toast.success(
        choice === "" ? `${customer.fullName} is off every price list` : `${customer.fullName} is on a price list`,
      );
      onClose();
    },
    onError: (failure) =>
      setError(failure instanceof ApiError ? failure.message : "Could not change the price list."),
  });

  const approved = customer.plannerProfile?.status === "APPROVED";
  // Active lists can be chosen; the planner's current list stays visible even if switched off.
  const options = (lists.data ?? []).filter((list) => list.active || list.id === customer.priceListId);

  return (
    <Dialog
      open
      onClose={onClose}
      title="Price list"
      description={`Trade rates for ${customer.fullName}.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button form={FORM_ID} type="submit" disabled={mutation.isPending || lists.isPending}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            Save
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          mutation.mutate();
        }}
      >
        {error ? <Alert tone="error" title={error} /> : null}
        {!approved ? (
          <Alert
            tone="warning"
            title="Not verified yet"
            >
            The list is saved now but gives no trade rates until the planner&apos;s application is approved.
          </Alert>
        ) : null}

        <Field label="Price list">
          {(props) => (
            <Select {...props} value={choice} onChange={(event) => setChoice(event.target.value)} disabled={lists.isPending}>
              <option value="">None (standard rates)</option>
              {options.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                  {list.active ? "" : " (inactive)"}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </form>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { changeQuotationVenue, quotationKeys } from "@/features/quotations/api";
import { orderKeys } from "@/features/orders/api";
import type { QuotationView } from "@/features/quotations/types";
import { ApiError } from "@/services/api-client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * Adds or corrects the venue of a quotation after it was sent or confirmed. Nothing is repriced; the customer
 * is told. The server refuses once the order has been dispatched, and that sentence is shown as it is.
 */
export function VenueDialog({ quotation, onClose }: { quotation: QuotationView; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState(quotation.venue?.text ?? "");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => changeQuotationVenue(quotation.id, { text: text.trim() }),
    onSuccess: (updated) => {
      queryClient.setQueryData(quotationKeys.byId(quotation.id), updated);
      queryClient.invalidateQueries({ queryKey: quotationKeys.list });
      queryClient.invalidateQueries({ queryKey: orderKeys.list });
      toast.success(`Venue saved on ${updated.quotationNumber}. The customer has been told.`);
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not save the venue."),
  });

  const unchanged = text.trim() === (quotation.venue?.text ?? "");

  return (
    <Dialog
      open
      onClose={onClose}
      title={quotation.venue ? "Change venue" : "Add venue"}
      description="Prices and status stay as they are. The customer is told by email and in their inbox. Possible until the order is dispatched."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending || text.trim() === "" || unchanged}
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
          >
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            Save venue
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <Alert tone="error" title={error} /> : null}
        <Field label="Venue" hint="Hall or place name and address, as it should appear on the order and the dispatch list.">
          {(props) => (
            <Input
              {...props}
              value={text}
              maxLength={300}
              autoFocus
              onChange={(event) => setText(event.target.value)}
              disabled={mutation.isPending}
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}

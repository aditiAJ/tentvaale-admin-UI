"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { changeQuotationEventDate, quotationKeys } from "@/features/quotations/api";
import { useDateStock } from "@/features/quotations/useDateStock";
import { formatEventDate } from "@/features/quotations/components/QuotationParts";
import type { QuotationView } from "@/features/quotations/types";
import { isIsoDate } from "@/lib/forms";
import { ApiError } from "@/services/api-client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const DAY_MS = 86_400_000;
const utc = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
const addDays = (iso: string, days: number) => new Date(utc(iso) + days * DAY_MS).toISOString().slice(0, 10);

function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Moves the event date of a quotation, in any status except closed, and of its order while the order is still only
 * confirmed. Nothing is repriced. The days of the functions, the stock the order holds and the customer's plan move with
 * it, and the customer is told. The stock on the new day is shown first; short stock is a warning, not a stop. The server
 * refuses once the order has been dispatched, and that sentence is shown as it is.
 */
export function EventDateDialog({ quotation, onClose }: { quotation: QuotationView; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(quotation.eventDate ?? "");
  const [error, setError] = useState<string | null>(null);

  const today = todayIso();
  const valid = isIsoDate(date) && date >= today;
  const changed = valid && date !== quotation.eventDate;

  // The functions move by as many days as the event does, counted from the event date (or the first function).
  const firstFunction = quotation.lines.map((line) => line.functionDate).filter((d): d is string => Boolean(d)).sort()[0];
  const anchor = quotation.eventDate ?? firstFunction ?? null;
  const shift = anchor && changed ? Math.round((utc(date) - utc(anchor)) / DAY_MS) : 0;

  const lines = quotation.lines
    .filter((line) => !line.oneTime && line.productId)
    .map((line) => ({
      key: line.id,
      productId: line.productId,
      variantId: line.variantId ?? undefined,
      quantity: line.quantity,
      rentalDays: line.rentalDays,
      functionDate: line.functionDate ? addDays(line.functionDate, shift) : undefined,
    }));
  const stock = useDateStock({ eventDate: changed ? date : undefined, excludeQuotationId: quotation.id, lines, enabled: changed });
  const short = quotation.lines.flatMap((line) => {
    const result = stock.results.get(line.id);
    return result && (result.status === "UNAVAILABLE" || result.status === "PARTIAL")
      ? [`${line.productName} (needs ${result.needed}, ${result.free} free)`]
      : [];
  });

  const mutation = useMutation({
    mutationFn: () => changeQuotationEventDate(quotation.id, date),
    onSuccess: (updated) => {
      queryClient.setQueryData(quotationKeys.byId(quotation.id), updated);
      // Everything that shows the date or the stock it holds: the lists, the order, its dispatch list, the plan.
      for (const queryKey of [quotationKeys.list, quotationKeys.plan(quotation.id), ["orders"], ["inventory"]]) {
        queryClient.invalidateQueries({ queryKey });
      }
      toast.success(`Event date saved on ${updated.quotationNumber}. The customer has been told.`);
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not save the event date."),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Change event date"
      description="Prices and status stay as they are. The order, the days its goods are held and the customer's plan move with it, and the customer is told. Possible until the order is dispatched."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending || !changed}
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
          >
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            Save date
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <Alert tone="error" title={error} /> : null}
        <p className="text-sm text-muted-foreground">
          Now: <span className="font-medium text-foreground">{formatEventDate(quotation.eventDate, true)}</span>
        </p>
        <Field
          label="New event date"
          hint={firstFunction ? "The functions on this quotation move by the same number of days." : undefined}
          error={date !== "" && !valid ? "Choose today or a later day." : undefined}
        >
          {(props) => (
            <Input
              {...props}
              type="date"
              min={today}
              value={date}
              autoFocus
              onChange={(event) => setDate(event.target.value)}
              disabled={mutation.isPending}
            />
          )}
        </Field>
        {changed && stock.pending && short.length === 0 ? <p className="text-xs text-muted-foreground">Checking stock on that day…</p> : null}
        {changed && short.length > 0 ? (
          <Alert tone="warning" title={`Stock is short on that day: ${short.join("; ")}. You can still save the date.`} />
        ) : null}
      </div>
    </Dialog>
  );
}

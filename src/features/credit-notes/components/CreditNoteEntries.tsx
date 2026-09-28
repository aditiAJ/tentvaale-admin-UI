"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { CreditNoteView } from "@/features/credit-notes/types";
import { IssueCreditNoteDialog } from "@/features/credit-notes/components/IssueCreditNoteDialog";
import { ApplyCreditNoteDialog } from "@/features/credit-notes/components/ApplyCreditNoteDialog";
import type { CustomerView } from "@/features/master-data/types";
import { listOrdersByCustomer, orderKeys } from "@/features/orders/api";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

/**
 * The issue and apply dialogs each need one customer's orders, which the page
 * used to have loaded because a customer had to be chosen first. With the
 * workspace listing every note, these load them at the point of use and then
 * hand over to the dialogs unchanged.
 */

/** One customer's orders, fresh: an order converted or cancelled a moment ago changes which apply. */
function useCustomerOrders(customerId: string) {
  return useQuery({
    queryKey: orderKeys.byCustomer(customerId),
    queryFn: ({ signal }) => listOrdersByCustomer(customerId, signal),
    enabled: customerId !== "",
    staleTime: 0,
    retry: false,
  });
}

/** Shown while a customer's orders load, or if they cannot. */
function OrdersPending({
  title,
  error,
  onClose,
}: {
  title: string;
  error: Error | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      {error ? (
        <Alert tone="error" title={error.message || "The customer's orders could not be loaded."} />
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading the customer&apos;s orders…
        </p>
      )}
    </Dialog>
  );
}

/** Apply, from a list row or the open note: the note's own customer's orders, then the apply dialog. */
export function ApplyCreditNoteEntry({
  note,
  onClose,
}: {
  note: CreditNoteView;
  onClose: () => void;
}) {
  const orders = useCustomerOrders(note.customerId);
  if (!orders.data) {
    return <OrdersPending title="Apply credit" error={orders.error} onClose={onClose} />;
  }
  return <ApplyCreditNoteDialog note={note} orders={orders.data} onClose={onClose} />;
}

/**
 * Issue: a note is always issued to one customer, so the customer is chosen
 * here — defaulting to the one whose note is open — and the issue dialog takes
 * over once their orders are in.
 */
export function IssueCreditNoteEntry({
  customers,
  defaultCustomerId,
  onClose,
}: {
  customers: CustomerView[];
  defaultCustomerId?: string;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState(defaultCustomerId ?? "");
  const [chosen, setChosen] = useState<CustomerView | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const orders = useCustomerOrders(chosen?.id ?? "");

  if (chosen) {
    if (!orders.data) {
      return <OrdersPending title="Issue credit note" error={orders.error} onClose={onClose} />;
    }
    return <IssueCreditNoteDialog customer={chosen} orders={orders.data} onClose={onClose} />;
  }

  const next = () => {
    const customer = customers.find((candidate) => candidate.id === picked);
    if (!customer) {
      setPickError("Choose a customer");
      return;
    }
    setChosen(customer);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Issue credit note"
      description="Credit is issued to one customer."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="issue-credit-customer">
            Continue
          </Button>
        </>
      }
    >
      <form
        id="issue-credit-customer"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          next();
        }}
      >
        <Field label="Customer" required error={pickError ?? undefined}>
          {(props) => (
            <Select
              {...props}
              value={picked}
              onChange={(event) => {
                setPicked(event.target.value);
                setPickError(null);
              }}
            >
              <option value="">Choose a customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.fullName} · {customer.email}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </form>
    </Dialog>
  );
}

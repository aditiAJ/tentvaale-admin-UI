"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, Receipt } from "lucide-react";
import {
  creditNoteKeys,
  getCustomerCreditBalance,
  listCreditNotesByCustomer,
} from "@/features/credit-notes/api";
import {
  remainingCredit,
  reversedCredit,
  type CreditNoteStatus,
  type CreditNoteView,
} from "@/features/credit-notes/types";
import { IssueCreditNoteDialog } from "@/features/credit-notes/components/IssueCreditNoteDialog";
import { ApplyCreditNoteDialog } from "@/features/credit-notes/components/ApplyCreditNoteDialog";
import {
  CreditNoteActionDialog,
  type CreditNoteAction,
} from "@/features/credit-notes/components/CreditNoteActionDialog";
import { listCustomers, masterDataKeys } from "@/features/master-data/api";
import { listOrdersByCustomer, orderKeys } from "@/features/orders/api";
import { useCan } from "@/features/auth";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const STATUS_VARIANT: Record<CreditNoteStatus, "default" | "success" | "warning" | "destructive"> = {
  ISSUED: "success",
  APPLIED: "default",
  REVERSED: "warning",
  CANCELLED: "destructive",
};

export function CreditNotesPage() {
  const canWrite = useCan("CREDIT_NOTE_WRITE");
  const [customerId, setCustomerId] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [applying, setApplying] = useState<CreditNoteView | null>(null);
  const [acting, setActing] = useState<{ action: CreditNoteAction; note: CreditNoteView } | null>(
    null,
  );

  const customers = useQuery({
    queryKey: masterDataKeys.customers,
    queryFn: ({ signal }) => listCustomers(signal),
  });
  const customer = customers.data?.find((candidate) => candidate.id === customerId);

  const notes = useQuery({
    queryKey: creditNoteKeys.byCustomer(customerId),
    queryFn: ({ signal }) => listCreditNotesByCustomer(customerId, signal),
    enabled: customerId !== "",
    retry: false,
  });

  const balance = useQuery({
    queryKey: creditNoteKeys.balance(customerId),
    queryFn: ({ signal }) => getCustomerCreditBalance(customerId, signal),
    enabled: customerId !== "",
    retry: false,
  });

  // Fresh on every visit: an order converted or cancelled a moment ago
  // changes which orders credit can go to.
  const orders = useQuery({
    queryKey: orderKeys.byCustomer(customerId),
    queryFn: ({ signal }) => listOrdersByCustomer(customerId, signal),
    enabled: customerId !== "",
    staleTime: 0,
    retry: false,
  });

  const orderNumbers = useMemo(
    () => new Map((orders.data ?? []).map((order) => [order.id, order.orderNumber])),
    [orders.data],
  );

  const orderLink = (orderId: string) => (
    <Link href={`/orders?id=${orderId}`} className="hover:text-foreground hover:underline">
      {orderNumbers.get(orderId) ?? orderId}
    </Link>
  );

  const loadError = notes.error ?? balance.error ?? orders.error;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Credit notes"
        description="Credit issued to a customer, and what is left of it."
        actions={
          canWrite && customer && orders.data ? (
            <Button onClick={() => setIssuing(true)}>
              <Plus />
              Issue credit note
            </Button>
          ) : null
        }
      />

      <div className="max-w-md">
        <label htmlFor="credit-customer" className="mb-1.5 block text-xs font-medium">
          Customer
        </label>
        <Select
          id="credit-customer"
          value={customerId}
          onChange={(event) => setCustomerId(event.target.value)}
          disabled={customers.isPending}
        >
          <option value="">{customers.isPending ? "Loading customers" : "Choose a customer"}</option>
          {(customers.data ?? []).map((option) => (
            <option key={option.id} value={option.id}>
              {option.fullName} · {option.email}
            </option>
          ))}
        </Select>
      </div>

      {customers.isError ? (
        <Alert
          tone="error"
          title={customers.error instanceof Error ? customers.error.message : "Customers failed to load"}
        />
      ) : null}

      {loadError ? (
        <Alert tone="error" title={loadError instanceof Error ? loadError.message : "Lookup failed"} />
      ) : null}

      {customerId && (notes.isPending || balance.isPending) ? <Skeleton className="h-48" /> : null}

      {balance.data ? (
        <Card>
          <CardHeader>
            <CardTitle>Available credit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="tabular text-2xl font-semibold">
              {formatMoney(balance.data.availableCredit)}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {notes.data ? (
        notes.data.length === 0 ? (
          <Card>
            <EmptyState icon={<Receipt />} title="No credit notes for this customer" />
          </Card>
        ) : (
          <Card>
            <TableWrapper>
              <Table>
                <THead>
                  <tr>
                    <TH>Number</TH>
                    <TH>Issued</TH>
                    <TH>Reason</TH>
                    <TH className="text-right">Amount</TH>
                    <TH className="text-right">Applied</TH>
                    <TH className="text-right">Remaining</TH>
                    <TH>Status</TH>
                    {canWrite ? <TH className="text-right">Actions</TH> : null}
                  </tr>
                </THead>
                <TBody>
                  {notes.data.map((note) => {
                    const remaining = remainingCredit(note);
                    const reversed = reversedCredit(note);
                    const currency = note.amount.currency;
                    const unused = Number(note.appliedAmount.amount) === 0;
                    return (
                      <TR key={note.id}>
                        <TD className="font-mono text-xs font-medium">{note.creditNoteNumber}</TD>
                        <TD className="tabular text-xs">{note.issuedOn}</TD>
                        <TD>
                          <span className="block max-w-xs truncate text-xs">
                            {note.reason ?? "—"}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {note.againstOrderId ? (
                              <>Against {orderLink(note.againstOrderId)}</>
                            ) : (
                              "Goodwill"
                            )}
                          </span>
                        </TD>
                        <TD className="text-right tabular">{formatMoney(note.amount)}</TD>
                        <TD className="text-right tabular">
                          {formatMoney(note.appliedAmount)}
                          {note.applications.map((application) => (
                            <span
                              key={application.id}
                              className="block text-xs text-muted-foreground"
                            >
                              {formatMoney(application.amount)} → {orderLink(application.orderId)}
                            </span>
                          ))}
                        </TD>
                        <TD className="text-right tabular">
                          {formatMoney({ amount: remaining, currency })}
                          {reversed > 0 ? (
                            <span className="block text-xs text-muted-foreground">
                              {formatMoney({ amount: reversed, currency })} reversed
                            </span>
                          ) : null}
                        </TD>
                        <TD>
                          <Badge variant={STATUS_VARIANT[note.status]}>{note.status}</Badge>
                        </TD>
                        {canWrite ? (
                          <TD>
                            {note.status === "ISSUED" ? (
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!orders.data}
                                  onClick={() => setApplying(note)}
                                >
                                  Apply
                                </Button>
                                {unused ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setActing({ action: "cancel", note })}
                                  >
                                    Cancel
                                  </Button>
                                ) : null}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setActing({ action: "reverse", note })}
                                >
                                  Reverse
                                </Button>
                              </div>
                            ) : null}
                          </TD>
                        ) : null}
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableWrapper>
          </Card>
        )
      ) : null}

      {issuing && customer && orders.data ? (
        <IssueCreditNoteDialog
          customer={customer}
          orders={orders.data}
          onClose={() => setIssuing(false)}
        />
      ) : null}

      {applying && orders.data ? (
        <ApplyCreditNoteDialog
          note={applying}
          orders={orders.data}
          onClose={() => setApplying(null)}
        />
      ) : null}

      {acting ? (
        <CreditNoteActionDialog
          action={acting.action}
          note={acting.note}
          onClose={() => setActing(null)}
        />
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Receipt } from "lucide-react";
import {
  creditNoteKeys,
  getCustomerCreditBalance,
  listCreditNotesByCustomer,
} from "@/features/credit-notes/api";
import { IssueCreditNoteDialog } from "@/features/credit-notes/components/IssueCreditNoteDialog";
import { useCan } from "@/features/auth";
import { DEMO_CREDIT_CUSTOMER_EXAMPLES } from "@/mock-data/seed";
import { formatMoney } from "@/lib/money";
import { IdLookup } from "@/components/id-lookup";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export function CreditNotesPage() {
  const canWrite = useCan("CREDIT_NOTE_WRITE");
  const [customerId, setCustomerId] = useState("");
  const [issuing, setIssuing] = useState(false);

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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Credit notes"
        description="Credit issued to a customer, and what is left of it."
        actions={
          canWrite && customerId ? (
            <Button onClick={() => setIssuing(true)}>
              <Plus />
              Issue credit note
            </Button>
          ) : null
        }
      />

      <IdLookup
        label="Customer ID"
        value={customerId}
        onChange={setCustomerId}
        submitLabel="Find credit notes"
        busy={notes.isFetching}
        examples={DEMO_CREDIT_CUSTOMER_EXAMPLES}
      />

      {notes.isFetching ? <Skeleton className="h-48" /> : null}

      {notes.isError ? (
        <Alert
          tone="error"
          title={notes.error instanceof Error ? notes.error.message : "Lookup failed"}
        />
      ) : null}

      {balance.data && !notes.isFetching ? (
        <Card>
          <CardHeader>
            <CardTitle>Available credit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatMoney(balance.data.availableCredit)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Summed across issued and reversed notes only — applied and cancelled ones do not
              count toward the balance.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {notes.data && !notes.isFetching ? (
        notes.data.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Receipt />}
              title="No credit notes for that customer"
              description="Either the customer id is wrong, or nothing has been credited to them."
              action={
                canWrite ? (
                  <Button onClick={() => setIssuing(true)}>
                    <Plus />
                    Issue credit note
                  </Button>
                ) : null
              }
            />
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
                    <TH>Status</TH>
                  </tr>
                </THead>
                <TBody>
                  {notes.data.map((note) => (
                    <TR key={note.id}>
                      <TD className="font-mono text-xs font-medium">{note.creditNoteNumber}</TD>
                      <TD className="tabular text-xs">{note.issuedOn}</TD>
                      <TD>
                        <span className="block max-w-xs truncate text-xs">
                          {note.reason ?? "—"}
                        </span>
                        {note.againstOrderId ? (
                          <span className="block text-xs text-muted-foreground">
                            Against an order
                          </span>
                        ) : (
                          <span className="block text-xs text-muted-foreground">
                            Standalone goodwill credit
                          </span>
                        )}
                      </TD>
                      <TD className="text-right tabular">{formatMoney(note.amount)}</TD>
                      <TD className="text-right tabular">{formatMoney(note.appliedAmount)}</TD>
                      <TD>
                        <Badge variant={note.status === "ISSUED" ? "success" : "default"}>
                          {note.status}
                        </Badge>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrapper>
          </Card>
        )
      ) : null}

      {issuing ? (
        <IssueCreditNoteDialog customerId={customerId} onClose={() => setIssuing(false)} />
      ) : null}
    </div>
  );
}

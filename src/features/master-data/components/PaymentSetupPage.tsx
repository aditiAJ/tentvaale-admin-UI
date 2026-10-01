"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Wallet } from "lucide-react";
import { listPaymentModes, listPaymentTerms, masterDataKeys } from "@/features/master-data/api";
import type { PaymentModeView, PaymentTermsView } from "@/features/master-data/types";
import { PaymentModeDialog } from "@/features/master-data/components/PaymentModeDialog";
import { PaymentTermsDialog } from "@/features/master-data/components/PaymentTermsDialog";
import { useCan } from "@/features/auth";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

/** "50% On booking · 50% Before the event" */
function schedule(terms: PaymentTermsView): string {
  return terms.details.map((line) => `${line.percentage}% ${line.description}`).join(" · ");
}

/** Payment modes and payment-terms templates: the setup quotations and orders choose from. */
export function PaymentSetupPage() {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const [newMode, setNewMode] = useState(false);
  const [editingMode, setEditingMode] = useState<PaymentModeView | null>(null);
  const [newTerms, setNewTerms] = useState(false);
  const [editingTerms, setEditingTerms] = useState<PaymentTermsView | null>(null);

  const modes = useQuery({
    queryKey: masterDataKeys.paymentModes,
    queryFn: ({ signal }) => listPaymentModes(signal),
  });
  const terms = useQuery({
    queryKey: masterDataKeys.paymentTerms,
    queryFn: ({ signal }) => listPaymentTerms(signal),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment setup"
        description="The ways customers pay, and the payment schedules quotations and orders choose from."
      />

      <section className="space-y-3" aria-labelledby="modes-heading">
        <div className="flex items-center justify-between gap-2">
          <h2 id="modes-heading" className="text-sm font-semibold">
            Payment modes
          </h2>
          {canWrite ? (
            <Button size="sm" onClick={() => setNewMode(true)}>
              <Plus />
              New payment mode
            </Button>
          ) : null}
        </div>
        <Card>
          <TableWrapper>
            <Table>
              <THead>
                <tr>
                  <TH>Name</TH>
                  {canWrite ? <TH className="text-right">Actions</TH> : null}
                </tr>
              </THead>
              <TBody>
                {modes.isPending ? <TableSkeleton columns={canWrite ? 2 : 1} /> : null}
                {modes.data?.map((mode) => (
                  <TR key={mode.id}>
                    <TD className="font-medium">
                      {mode.name}
                      {!mode.active ? <Badge className="ml-2">Inactive</Badge> : null}
                    </TD>
                    {canWrite ? (
                      <TD>
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingMode(mode)}
                            aria-label={`Edit ${mode.name}`}
                            title="Edit"
                          >
                            <Pencil />
                          </Button>
                        </div>
                      </TD>
                    ) : null}
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrapper>
          {modes.isError ? (
            <EmptyState
              title="Could not load payment modes"
              description={modes.error instanceof Error ? modes.error.message : undefined}
              action={
                <Button variant="outline" onClick={() => modes.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : null}
          {!modes.isPending && !modes.isError && !modes.data?.length ? (
            <EmptyState icon={<Wallet />} title="No payment modes yet" />
          ) : null}
        </Card>
      </section>

      <section className="space-y-3" aria-labelledby="terms-heading">
        <div className="flex items-center justify-between gap-2">
          <h2 id="terms-heading" className="text-sm font-semibold">
            Payment terms
          </h2>
          {canWrite ? (
            <Button size="sm" onClick={() => setNewTerms(true)}>
              <Plus />
              New payment terms
            </Button>
          ) : null}
        </div>
        <Card>
          <TableWrapper>
            <Table>
              <THead>
                <tr>
                  <TH>Name</TH>
                  <TH>Schedule</TH>
                  {canWrite ? <TH className="text-right">Actions</TH> : null}
                </tr>
              </THead>
              <TBody>
                {terms.isPending ? <TableSkeleton columns={canWrite ? 3 : 2} /> : null}
                {terms.data?.map((template) => (
                  <TR key={template.id}>
                    <TD className="font-medium">
                      {template.name}
                      {!template.active ? <Badge className="ml-2">Inactive</Badge> : null}
                      {template.description ? (
                        <span className="block text-xs font-normal text-muted-foreground">{template.description}</span>
                      ) : null}
                    </TD>
                    <TD className="text-xs">{schedule(template)}</TD>
                    {canWrite ? (
                      <TD>
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingTerms(template)}
                            aria-label={`Edit ${template.name}`}
                            title="Edit"
                          >
                            <Pencil />
                          </Button>
                        </div>
                      </TD>
                    ) : null}
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrapper>
          {terms.isError ? (
            <EmptyState
              title="Could not load payment terms"
              description={terms.error instanceof Error ? terms.error.message : undefined}
              action={
                <Button variant="outline" onClick={() => terms.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : null}
          {!terms.isPending && !terms.isError && !terms.data?.length ? (
            <EmptyState icon={<Wallet />} title="No payment terms yet" />
          ) : null}
        </Card>
      </section>

      {newMode ? <PaymentModeDialog onClose={() => setNewMode(false)} /> : null}
      {editingMode ? <PaymentModeDialog existing={editingMode} onClose={() => setEditingMode(null)} /> : null}
      {newTerms ? <PaymentTermsDialog onClose={() => setNewTerms(false)} /> : null}
      {editingTerms ? <PaymentTermsDialog existing={editingTerms} onClose={() => setEditingTerms(null)} /> : null}
    </div>
  );
}

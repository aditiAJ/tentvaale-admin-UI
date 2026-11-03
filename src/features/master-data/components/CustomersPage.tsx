"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { deleteCustomer, listCustomers, masterDataKeys } from "@/features/master-data/api";
import type { CustomerView } from "@/features/master-data/types";
import { CustomerDialog } from "@/features/master-data/components/CustomerDialog";
import { PlannerApplicationsPanel } from "@/features/master-data/components/PlannerApplicationsPanel";
import { useCan } from "@/features/auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

/**
 * Name, email and id match as typed, ignoring case. Phone numbers are compared
 * on their digits alone, so "98200 11223" finds "+91 98200 11223" however it
 * was spaced when it was saved.
 */
function matches(customer: CustomerView, term: string): boolean {
  const text = [customer.fullName, customer.email, customer.id].join(" ").toLowerCase();
  if (text.includes(term)) return true;
  const digits = term.replace(/\D/g, "");
  return digits.length >= 3 && (customer.phone ?? "").replace(/\D/g, "").includes(digits);
}

/** The rate a customer is quoted at: retail, or for an event planner the product's wholesale rate moved by their discount. */
function PricingLabel({ customer }: { customer: CustomerView }) {
  if (customer.accountType !== "EVENT_PLANNER") {
    const percent = customer.customerDiscountPercent ?? 0;
    if (percent === 0) return <span className="text-muted-foreground">Retail</span>;
    return (
      <Badge variant="success" title="Quoted the retail rate less this percentage.">
        {percent}% off retail
      </Badge>
    );
  }
  const discount = customer.plannerDiscountPercent ?? 20;
  if (discount === 0) return <span className="text-muted-foreground">Retail</span>;
  return (
    <Badge variant="success" title="Event planners are quoted the wholesale rate. A discount above 20 gives them more off, below 20 less.">
      {discount === 20 ? "Wholesale rate" : `Wholesale, ${discount}% discount`}
    </Badge>
  );
}

export function CustomersPage() {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CustomerView | null>(null);
  const [removing, setRemoving] = useState<CustomerView | null>(null);
  const queryClient = useQueryClient();

  // Filtered in the browser over the full list, like products; deferring the
  // term keeps typing responsive on a long one.
  const deferredSearch = useDeferredValue(search);

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: masterDataKeys.customers,
    queryFn: ({ signal }) => listCustomers(signal),
  });

  const visible = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    if (!term) return data ?? [];
    return (data ?? []).filter((customer) => matches(customer, term));
  }, [data, deferredSearch]);

  const columns = canWrite ? 7 : 6;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customers"
        description="The people and event planners you quote and book orders for."
        actions={
          canWrite ? (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              New customer
            </Button>
          ) : null
        }
      />

      <PlannerApplicationsPanel canWrite={canWrite} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, phone or ID"
            className="pl-8"
            aria-label="Search customers"
          />
        </div>
        <p className="text-xs text-muted-foreground tabular" aria-live="polite">
          {isPending ? "Loading…" : `${visible.length} of ${data?.length ?? 0} customers`}
          {isFetching && !isPending ? " · refreshing" : ""}
        </p>
      </div>

      <Card>
        <TableWrapper>
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>Email</TH>
                <TH>Phone</TH>
                <TH>Type</TH>
                <TH>Pricing</TH>
                <TH>ID</TH>
                {canWrite ? <TH className="text-right">Actions</TH> : null}
              </tr>
            </THead>
            <TBody>
              {isPending ? <TableSkeleton columns={columns} /> : null}

              {!isPending
                ? visible.map((customer) => (
                    <TR key={customer.id}>
                      <TD className="font-medium">{customer.fullName}</TD>
                      <TD className="text-xs">{customer.email}</TD>
                      <TD className="tabular text-xs">
                        {customer.phone ?? (
                          <span className="text-muted-foreground">Not given</span>
                        )}
                      </TD>
                      <TD>
                        <Badge variant={customer.accountType === "EVENT_PLANNER" ? "outline" : "default"}>
                          {customer.accountType === "EVENT_PLANNER" ? "Event planner" : "Customer"}
                        </Badge>
                      </TD>
                      <TD>
                        <PricingLabel customer={customer} />
                      </TD>
                      {/* The id is what quotations, orders, deposits and credit
                          notes store, and the credit-notes screen asks for it,
                          so it is shown rather than kept internal. */}
                      <TD className="max-w-40 truncate font-mono text-xs text-muted-foreground" title={customer.id}>
                        {customer.id}
                      </TD>
                      {canWrite ? (
                        <TD>
                          {/* Delete is offered, but the backend refuses a customer that a
                              quotation, order or credit note was raised against (they store
                              only a copied name, with no foreign key to notice), and says so. */}
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditing(customer)}
                              aria-label={`Edit ${customer.fullName}`}
                              title="Edit"
                            >
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setRemoving(customer)}
                              aria-label={`Delete ${customer.fullName}`}
                              title="Delete"
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </TD>
                      ) : null}
                    </TR>
                  ))
                : null}
            </TBody>
          </Table>
        </TableWrapper>

        {isError ? (
          <EmptyState
            title="Could not load customers"
            description={error instanceof Error ? error.message : undefined}
            action={
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        ) : null}

        {!isPending && !isError && visible.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title={data?.length ? "No customers match that search" : "No customers yet"}
            action={
              !data?.length && canWrite ? (
                <Button onClick={() => setCreating(true)}>
                  <Plus />
                  New customer
                </Button>
              ) : null
            }
          />
        ) : null}
      </Card>

      {creating ? <CustomerDialog onClose={() => setCreating(false)} /> : null}
      {editing ? <CustomerDialog existing={editing} onClose={() => setEditing(null)} /> : null}
      {removing ? (
        <ConfirmDialog
          title={`Delete ${removing.fullName}?`}
          description="Removes the customer, with their planner application. It is refused if they have quotations, orders or credit notes. Their storefront login is not touched."
          confirmLabel="Delete customer"
          fallbackError="Could not delete the customer."
          action={() => deleteCustomer(removing.id)}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: masterDataKeys.customers });
            setRemoving(null);
          }}
          onClose={() => setRemoving(null)}
        />
      ) : null}
    </div>
  );
}

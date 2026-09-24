"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Search, Users } from "lucide-react";
import { listCustomers, masterDataKeys } from "@/features/master-data/api";
import type { CustomerView } from "@/features/master-data/types";
import { CustomerDialog } from "@/features/master-data/components/CustomerDialog";
import { useCan } from "@/features/auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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

export function CustomersPage() {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CustomerView | null>(null);

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

  const columns = canWrite ? 6 : 5;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customers"
        description="The accounts that place orders through the storefront."
        actions={
          canWrite ? (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              New customer
            </Button>
          ) : null
        }
      />

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
                      {/* The id is what quotations, orders, deposits and credit
                          notes store, and the credit-notes screen asks for it,
                          so it is shown rather than kept internal. */}
                      <TD className="max-w-40 truncate font-mono text-xs text-muted-foreground" title={customer.id}>
                        {customer.id}
                      </TD>
                      {canWrite ? (
                        <TD>
                          {/* Edit only. An account is what a quotation and an
                              order were raised against, and neither stores
                              anything but a copied name — deleting one would
                              leave those records pointing at nothing, with no
                              foreign key to notice. */}
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
    </div>
  );
}

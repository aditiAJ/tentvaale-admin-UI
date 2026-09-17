"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Users } from "lucide-react";
import { listCustomers, masterDataKeys } from "@/features/master-data/api";
import type { CustomerView } from "@/features/master-data/types";
import { CustomerDialog } from "@/features/master-data/components/CustomerDialog";
import { useCan } from "@/features/auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export function CustomersPage() {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CustomerView | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: masterDataKeys.customers,
    queryFn: ({ signal }) => listCustomers(signal),
  });

  const columns = canWrite ? 5 : 4;

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

      <Card>
        <TableWrapper>
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>Email</TH>
                <TH>Phone</TH>
                <TH>Type</TH>
                {canWrite ? <TH className="text-right">Actions</TH> : null}
              </tr>
            </THead>
            <TBody>
              {isPending ? <TableSkeleton columns={columns} /> : null}

              {!isPending && data
                ? data.map((customer) => (
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

        {!isPending && !isError && !data?.length ? (
          <EmptyState
            icon={<Users />}
            title="No customers yet"
            action={
              canWrite ? (
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

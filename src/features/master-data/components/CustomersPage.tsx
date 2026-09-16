"use client";

import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { listCustomers, masterDataKeys } from "@/features/master-data/api";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const COLUMNS = 4;

export function CustomersPage() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: masterDataKeys.customers,
    queryFn: ({ signal }) => listCustomers(signal),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customers"
        description="The accounts that place orders through the storefront."
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
              </tr>
            </THead>
            <TBody>
              {isPending ? <TableSkeleton columns={COLUMNS} /> : null}

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
          <EmptyState icon={<Users />} title="No customers yet" />
        ) : null}
      </Card>
    </div>
  );
}

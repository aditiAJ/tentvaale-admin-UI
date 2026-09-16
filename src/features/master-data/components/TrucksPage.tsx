"use client";

import { useQuery } from "@tanstack/react-query";
import { Truck } from "lucide-react";
import { listTrucks, masterDataKeys } from "@/features/master-data/api";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const COLUMNS = 2;

const capacity = new Intl.NumberFormat("en-IN");

export function TrucksPage() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: masterDataKeys.trucks,
    queryFn: ({ signal }) => listTrucks(signal),
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Trucks" description="The fleet that moves stock to and from events." />

      <Card>
        <TableWrapper>
          <Table>
            <THead>
              <tr>
                <TH>Registration</TH>
                <TH className="text-right">Capacity</TH>
              </tr>
            </THead>
            <TBody>
              {isPending ? <TableSkeleton columns={COLUMNS} /> : null}

              {!isPending && data
                ? data.map((truck) => (
                    <TR key={truck.id}>
                      <TD className="font-mono text-xs font-medium">{truck.registration}</TD>
                      <TD className="text-right tabular">{capacity.format(truck.capacityKg)} kg</TD>
                    </TR>
                  ))
                : null}
            </TBody>
          </Table>
        </TableWrapper>

        {isError ? (
          <EmptyState
            title="Could not load trucks"
            description={error instanceof Error ? error.message : undefined}
            action={
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        ) : null}

        {!isPending && !isError && !data?.length ? (
          <EmptyState icon={<Truck />} title="No trucks yet" />
        ) : null}
      </Card>
    </div>
  );
}

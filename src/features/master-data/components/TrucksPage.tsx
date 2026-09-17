"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Truck } from "lucide-react";
import { deleteTruck, listTrucks, masterDataKeys } from "@/features/master-data/api";
import type { TruckView } from "@/features/master-data/types";
import { TruckDialog } from "@/features/master-data/components/TruckDialog";
import { RowActions } from "@/features/master-data/components/RowActions";
import { useCan } from "@/features/auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const capacity = new Intl.NumberFormat("en-IN");

export function TrucksPage() {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TruckView | null>(null);
  const [removing, setRemoving] = useState<TruckView | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: masterDataKeys.trucks,
    queryFn: ({ signal }) => listTrucks(signal),
  });

  const columns = canWrite ? 3 : 2;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Trucks"
        description="The fleet that moves stock to and from events."
        actions={
          canWrite ? (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              New truck
            </Button>
          ) : null
        }
      />

      <Card>
        <TableWrapper>
          <Table>
            <THead>
              <tr>
                <TH>Registration</TH>
                <TH className="text-right">Capacity</TH>
                {canWrite ? <TH className="text-right">Actions</TH> : null}
              </tr>
            </THead>
            <TBody>
              {isPending ? <TableSkeleton columns={columns} /> : null}

              {!isPending && data
                ? data.map((truck) => (
                    <TR key={truck.id}>
                      <TD className="font-mono text-xs font-medium">{truck.registration}</TD>
                      <TD className="text-right tabular">{capacity.format(truck.capacityKg)} kg</TD>
                      {canWrite ? (
                        <TD>
                          <RowActions
                            label={truck.registration}
                            onEdit={() => setEditing(truck)}
                            onRemove={() => setRemoving(truck)}
                          />
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
          <EmptyState
            icon={<Truck />}
            title="No trucks yet"
            action={
              canWrite ? (
                <Button onClick={() => setCreating(true)}>
                  <Plus />
                  New truck
                </Button>
              ) : null
            }
          />
        ) : null}
      </Card>

      {creating ? <TruckDialog onClose={() => setCreating(false)} /> : null}
      {editing ? <TruckDialog existing={editing} onClose={() => setEditing(null)} /> : null}
      {removing ? (
        <ConfirmDialog
          title={`Delete ${removing.registration}?`}
          description="It is removed outright. Nothing else in the back office refers to a truck, so nothing is orphaned."
          confirmLabel="Delete truck"
          fallbackError="Could not delete the truck."
          action={() => deleteTruck(removing.id)}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: masterDataKeys.trucks });
            setRemoving(null);
          }}
          onClose={() => setRemoving(null)}
        />
      ) : null}
    </div>
  );
}

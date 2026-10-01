"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Percent, Plus } from "lucide-react";
import { listPriceLists, masterDataKeys } from "@/features/master-data/api";
import type { PriceListView } from "@/features/master-data/types";
import { PriceListDialog } from "@/features/master-data/components/PriceListDialog";
import { useCan } from "@/features/auth";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

/** Trade pricing for verified event planners: the lists, their discount and explicit rates. */
export function PriceListsPage() {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PriceListView | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: masterDataKeys.priceLists,
    queryFn: ({ signal }) => listPriceLists(signal),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Price lists"
        description="Trade rates for verified event planners. Put a planner on a list from the Customers page."
        actions={
          canWrite ? (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              New price list
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
                <TH className="text-right">Default discount</TH>
                <TH className="text-right">Explicit rates</TH>
                {canWrite ? <TH className="text-right">Actions</TH> : null}
              </tr>
            </THead>
            <TBody>
              {isPending ? <TableSkeleton columns={canWrite ? 4 : 3} /> : null}

              {!isPending && data
                ? data.map((list) => (
                    <TR key={list.id}>
                      <TD className="font-medium">
                        {list.name}
                        {!list.active ? <Badge className="ml-2">Inactive</Badge> : null}
                      </TD>
                      <TD className="text-right tabular">{list.defaultDiscountPercent}%</TD>
                      <TD className="text-right tabular">{list.items.length}</TD>
                      {canWrite ? (
                        <TD>
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditing(list)}
                              aria-label={`Edit ${list.name}`}
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
            title="Could not load price lists"
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
            icon={<Percent />}
            title="No price lists yet"
            action={
              canWrite ? (
                <Button onClick={() => setCreating(true)}>
                  <Plus />
                  New price list
                </Button>
              ) : null
            }
          />
        ) : null}
      </Card>

      {creating ? <PriceListDialog onClose={() => setCreating(false)} /> : null}
      {editing ? <PriceListDialog existing={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

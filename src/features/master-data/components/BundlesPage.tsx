"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Shapes } from "lucide-react";
import { deleteBundle, listBundles, masterDataKeys } from "@/features/master-data/api";
import type { BundleView } from "@/features/master-data/types";
import { BundleDialog } from "@/features/master-data/components/BundleDialog";
import { RowActions } from "@/features/master-data/components/RowActions";
import { useCan } from "@/features/auth";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export function BundlesPage() {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BundleView | null>(null);
  const [removing, setRemoving] = useState<BundleView | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: masterDataKeys.bundles,
    queryFn: ({ signal }) => listBundles(signal),
  });

  const columns = canWrite ? 4 : 3;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bundles"
        description="Pre-priced groups of products quoted as a single line."
        actions={
          canWrite ? (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              New bundle
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
                <TH>Products</TH>
                <TH className="text-right">Rental rate</TH>
                {canWrite ? <TH className="text-right">Actions</TH> : null}
              </tr>
            </THead>
            <TBody>
              {isPending ? <TableSkeleton columns={columns} /> : null}

              {!isPending && data
                ? data.map((bundle) => (
                    <TR key={bundle.id}>
                      <TD className="font-medium">{bundle.name}</TD>
                      <TD>
                        <div className="flex flex-wrap gap-1">
                          {bundle.components.map((component) => (
                            <Badge
                              key={component.productId}
                              variant="outline"
                              className={component.active ? undefined : "opacity-60"}
                              title={
                                component.active
                                  ? component.sku
                                  : `${component.sku} · inactive product`
                              }
                            >
                              {component.productName}
                              <span className="tabular text-muted-foreground">
                                × {component.quantity}
                              </span>
                            </Badge>
                          ))}
                        </div>
                      </TD>
                      <TD className="text-right tabular">{formatMoney(bundle.rentalRate)}</TD>
                      {canWrite ? (
                        <TD>
                          <RowActions
                            label={bundle.name}
                            onEdit={() => setEditing(bundle)}
                            onRemove={() => setRemoving(bundle)}
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
            title="Could not load bundles"
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
            icon={<Shapes />}
            title="No bundles yet"
            action={
              canWrite ? (
                <Button onClick={() => setCreating(true)}>
                  <Plus />
                  New bundle
                </Button>
              ) : null
            }
          />
        ) : null}
      </Card>

      {creating ? <BundleDialog onClose={() => setCreating(false)} /> : null}
      {editing ? <BundleDialog existing={editing} onClose={() => setEditing(null)} /> : null}
      {removing ? (
        <ConfirmDialog
          title={`Delete ${removing.name}?`}
          description="A bundle is a pricing convenience — no quotation or order refers to one, so nothing already sold is affected."
          confirmLabel="Delete bundle"
          fallbackError="Could not delete the bundle."
          action={() => deleteBundle(removing.id)}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: masterDataKeys.bundles });
            setRemoving(null);
          }}
          onClose={() => setRemoving(null)}
        />
      ) : null}
    </div>
  );
}

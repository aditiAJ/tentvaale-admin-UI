"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Plus, Shapes, Tags } from "lucide-react";
import {
  deleteBundle,
  listBundles,
  masterDataKeys,
  setBundleActive,
} from "@/features/master-data/api";
import type { BundleView } from "@/features/master-data/types";
import { BundleDialog } from "@/features/master-data/components/BundleDialog";
import { BundleOccasionsDialog } from "@/features/master-data/components/BundleOccasionsDialog";
import { MediaThumb } from "@/features/master-data/components/MediaThumb";
import { useProductMedia } from "@/features/master-data/useProductMedia";
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

/** The storefront's facts line — "200–500 guests · 10 hours setup" — or null. */
function bundleFacts(bundle: BundleView): string | null {
  const facts = [
    bundle.guests ? `${bundle.guests} guests` : null,
    bundle.setupTime ? `${bundle.setupTime} setup` : null,
  ].filter(Boolean);
  return facts.length ? facts.join(" · ") : null;
}

export function BundlesPage() {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BundleView | null>(null);
  const [removing, setRemoving] = useState<BundleView | null>(null);
  const [switching, setSwitching] = useState<BundleView | null>(null);
  const [managingOccasions, setManagingOccasions] = useState(false);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: masterDataKeys.bundles,
    queryFn: ({ signal }) => listBundles(signal),
  });
  const productMedia = useProductMedia();

  const columns = canWrite ? 4 : 3;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bundles"
        description="Groups of products offered together. The price is worked out from the products."
        actions={
          <>
            <Button variant="outline" onClick={() => setManagingOccasions(true)}>
              <Tags />
              Occasions
            </Button>
            {canWrite ? (
              <Button onClick={() => setCreating(true)}>
                <Plus />
                New bundle
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        <TableWrapper>
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>Products</TH>
                <TH className="text-right">Price (from, per event)</TH>
                {canWrite ? <TH className="text-right">Actions</TH> : null}
              </tr>
            </THead>
            <TBody>
              {isPending ? <TableSkeleton columns={columns} /> : null}

              {!isPending && data
                ? data.map((bundle) => (
                    <TR key={bundle.id}>
                      <TD>
                        <div className="flex items-center gap-2.5">
                          <MediaThumb media={bundle.media} />
                          <div className="min-w-0">
                            <span className="font-medium">{bundle.name}</span>
                            {bundle.active === false ? (
                              <Badge className="ml-2 align-middle">Inactive</Badge>
                            ) : null}
                            {bundleFacts(bundle) ? (
                              <p className="text-xs text-muted-foreground">{bundleFacts(bundle)}</p>
                            ) : null}
                            {bundle.occasions.length ? (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {bundle.occasions.map((occasion) => (
                                  <Badge
                                    key={occasion.id}
                                    className={occasion.active ? undefined : "opacity-60"}
                                    title={occasion.active ? undefined : "Hidden on the storefront"}
                                  >
                                    {occasion.name}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </TD>
                      <TD>
                        <div className="flex flex-wrap gap-1">
                          {bundle.components.map((component) => (
                            <Badge
                              key={`${component.productId}:${component.variantId ?? ""}`}
                              variant="outline"
                              className={component.active ? undefined : "opacity-60"}
                              title={component.active ? undefined : "Inactive product"}
                            >
                              <MediaThumb
                                media={productMedia.get(component.productId)}
                                className="size-4 rounded-full border-0"
                              />
                              {component.productName}
                              {component.variantName ? ` (${component.variantName})` : ""}
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
                          <div className="flex items-center justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSwitching(bundle)}
                              aria-label={`${bundle.active === false ? "Activate" : "Deactivate"} ${bundle.name}`}
                              title={bundle.active === false ? "Activate" : "Deactivate"}
                            >
                              {bundle.active === false ? <Eye /> : <EyeOff />}
                            </Button>
                            <RowActions
                              label={bundle.name}
                              onEdit={() => setEditing(bundle)}
                              onRemove={() => setRemoving(bundle)}
                            />
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

      {managingOccasions ? (
        <BundleOccasionsDialog canWrite={canWrite} onClose={() => setManagingOccasions(false)} />
      ) : null}
      {creating ? <BundleDialog onClose={() => setCreating(false)} /> : null}
      {editing ? <BundleDialog existing={editing} onClose={() => setEditing(null)} /> : null}
      {switching ? (
        <ConfirmDialog
          title={`${switching.active === false ? "Activate" : "Deactivate"} ${switching.name}?`}
          description={
            switching.active === false
              ? "It returns to the storefront."
              : "It stays on record but leaves the storefront. Nothing already quoted or ordered is affected."
          }
          confirmLabel={switching.active === false ? "Activate bundle" : "Deactivate bundle"}
          destructive={switching.active !== false}
          fallbackError="Could not change the bundle."
          action={() => setBundleActive(switching.id, switching.active === false)}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: masterDataKeys.bundles });
            setSwitching(null);
          }}
          onClose={() => setSwitching(null)}
        />
      ) : null}
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

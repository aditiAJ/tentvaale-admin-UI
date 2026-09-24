"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Gem, Pencil, Plus } from "lucide-react";
import {
  listFeaturedCollections,
  masterDataKeys,
  setFeaturedCollectionActive,
} from "@/features/master-data/api";
import type {
  FeaturedCollectionProduct,
  FeaturedCollectionView,
} from "@/features/master-data/types";
import { FeaturedCollectionDialog } from "@/features/master-data/components/FeaturedCollectionDialog";
import { useCan } from "@/features/auth";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

/** One product in a collection, with its first image when it has one. */
function ProductChip({ product }: { product: FeaturedCollectionProduct }) {
  return (
    <li
      className={cn(
        "flex items-center gap-1.5 rounded-full border border-border py-0.5 pr-2.5 text-xs",
        product.imageUrl ? "pl-0.5" : "pl-2.5",
        !product.active && "opacity-60",
      )}
      title={product.active ? product.sku : `${product.sku} · inactive product`}
    >
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local data URL; nothing to optimise
        <img src={product.imageUrl} alt="" className="size-5 rounded-full object-cover" />
      ) : null}
      {product.name}
    </li>
  );
}

/**
 * Curated, storefront-facing collections — shown as cards rather than a table,
 * because what matters about a collection is the set of products it puts
 * together, and chips read as that set better than a column would.
 */
export function FeaturedCollectionsPage() {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<FeaturedCollectionView | null>(null);
  const [toggling, setToggling] = useState<FeaturedCollectionView | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: masterDataKeys.featuredCollections,
    queryFn: ({ signal }) => listFeaturedCollections(signal),
  });

  const newButton = canWrite ? (
    <Button onClick={() => setCreating(true)}>
      <Plus />
      New collection
    </Button>
  ) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Featured collections"
        description="Curated premium selections of products, showcased on the storefront."
        actions={newButton}
      />

      {isPending ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <Card>
          <EmptyState
            title="Could not load featured collections"
            description={error instanceof Error ? error.message : undefined}
            action={
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : null}

      {data && !data.length ? (
        <Card>
          <EmptyState icon={<Gem />} title="No featured collections yet" action={newButton} />
        </Card>
      ) : null}

      {data?.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((collection) => (
            <Card
              key={collection.id}
              className={cn("flex flex-col", !collection.active && "opacity-70")}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <Gem className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {collection.name}
                  </CardTitle>
                  <Badge variant={collection.active ? "success" : "default"}>
                    {collection.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                {collection.description ? (
                  <p className="text-xs text-muted-foreground">{collection.description}</p>
                ) : null}
              </CardHeader>

              <CardContent className="flex-1">
                <p className="mb-2 text-xs text-muted-foreground tabular">
                  {collection.products.length}{" "}
                  {collection.products.length === 1 ? "product" : "products"}
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {collection.products.map((product) => (
                    <ProductChip key={product.productId} product={product} />
                  ))}
                </ul>
              </CardContent>

              {canWrite ? (
                <div className="flex justify-end gap-1 border-t border-border px-4 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setToggling(collection)}
                    aria-label={`${collection.active ? "Deactivate" : "Activate"} ${collection.name}`}
                  >
                    {collection.active ? <EyeOff /> : <Eye />}
                    {collection.active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(collection)}
                    aria-label={`Edit ${collection.name}`}
                  >
                    <Pencil />
                    Edit
                  </Button>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      ) : null}

      {creating ? <FeaturedCollectionDialog onClose={() => setCreating(false)} /> : null}
      {editing ? (
        <FeaturedCollectionDialog existing={editing} onClose={() => setEditing(null)} />
      ) : null}
      {toggling ? (
        <ConfirmDialog
          title={`${toggling.active ? "Deactivate" : "Activate"} ${toggling.name}?`}
          description={
            toggling.active
              ? "It stops being featured on the storefront. Its products are not affected."
              : "It is featured on the storefront again."
          }
          confirmLabel={toggling.active ? "Deactivate collection" : "Activate collection"}
          destructive={toggling.active}
          fallbackError="Could not update the collection."
          action={() => setFeaturedCollectionActive(toggling.id, !toggling.active)}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: masterDataKeys.featuredCollections });
            setToggling(null);
          }}
          onClose={() => setToggling(null)}
        />
      ) : null}
    </div>
  );
}

"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Info, Pencil, Plus, Search, Shapes, Tags, Trash2 } from "lucide-react";
import {
  deleteBundle,
  listBundles,
  masterDataKeys,
  setBundleActive,
} from "@/features/master-data/api";
import type { BundleView } from "@/features/master-data/types";
import { BundleDetailsDialog } from "@/features/master-data/components/BundleDetailsDialog";
import { BundleDialog } from "@/features/master-data/components/BundleDialog";
import { BundleOccasionsDialog } from "@/features/master-data/components/BundleOccasionsDialog";
import { MediaThumb } from "@/features/master-data/components/MediaThumb";
import { ProductImageCarousel } from "@/features/master-data/components/ProductImageCarousel";
import { DEFAULT_SORT, SortSelect, sortItems, type SortKey } from "@/features/master-data/sorting";
import { useProductMedia } from "@/features/master-data/useProductMedia";
import { useCan } from "@/features/auth";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

type StatusFilter = "all" | "active" | "inactive";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

/** How many of a bundle's products the card names before "+N more". */
const PREVIEW_COMPONENTS = 3;

function matches(bundle: BundleView, term: string): boolean {
  return [
    bundle.name,
    bundle.tagline ?? "",
    ...bundle.occasions.map((occasion) => occasion.name),
    ...bundle.components.map((component) => component.productName),
  ]
    .join(" ")
    .toLowerCase()
    .includes(term);
}

export function BundlesPage() {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BundleView | null>(null);
  const [removing, setRemoving] = useState<BundleView | null>(null);
  const [switching, setSwitching] = useState<BundleView | null>(null);
  const [viewing, setViewing] = useState<BundleView | null>(null);
  const [managingOccasions, setManagingOccasions] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>(DEFAULT_SORT);
  const [occasionIds, setOccasionIds] = useState<string[]>([]);
  const deferredSearch = useDeferredValue(search);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: masterDataKeys.bundles,
    queryFn: ({ signal }) => listBundles(signal),
  });
  const productMedia = useProductMedia();

  // The occasion chips offer the occasions bundles are really filed under, each with its bundle count.
  const occasions = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; count: number }>();
    for (const bundle of data ?? []) {
      for (const occasion of bundle.occasions) {
        const entry = byId.get(occasion.id) ?? { id: occasion.id, name: occasion.name, count: 0 };
        entry.count += 1;
        byId.set(occasion.id, entry);
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const visible = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    const filtered = (data ?? []).filter((bundle) => {
      const inactive = bundle.active === false;
      if (status === "active" && inactive) return false;
      if (status === "inactive" && !inactive) return false;
      if (occasionIds.length > 0 && !bundle.occasions.some((occasion) => occasionIds.includes(occasion.id))) {
        return false;
      }
      return !term || matches(bundle, term);
    });
    return sortItems(filtered, sort, {
      id: (bundle) => bundle.id,
      name: (bundle) => bundle.name,
      price: (bundle) => bundle.rentalRate,
    });
  }, [data, deferredSearch, status, occasionIds, sort]);

  const filtering = search.trim() !== "" || status !== "all" || occasionIds.length > 0;

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
                            {bundle.sku ? <span className="ml-2 font-mono text-xs text-muted-foreground">{bundle.sku}</span> : null}
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
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-56 sm:max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, occasion or product"
              aria-label="Search bundles"
              className="h-9 w-full rounded-md border border-border bg-background pr-3 pl-8 text-sm outline-none transition-colors hover:border-primary/40 focus:border-primary focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>

          <div role="group" aria-label="Status" className="inline-flex rounded-md border border-border bg-card p-0.5">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatus(option.value)}
                aria-pressed={status === option.value}
                className={cn(
                  "h-8 rounded px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  status === option.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <SortSelect value={sort} onChange={setSort} />

          <p className="text-xs text-muted-foreground tabular" aria-live="polite">
            {isPending ? "Loading…" : `${visible.length} of ${data?.length ?? 0} bundles`}
          </p>
        </div>

        {occasions.length > 0 ? (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Occasions">
            {occasions.map((occasion) => {
              const on = occasionIds.includes(occasion.id);
              return (
                <button
                  key={occasion.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setOccasionIds((current) =>
                      on ? current.filter((id) => id !== occasion.id) : [...current, occasion.id],
                    )
                  }
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    on
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
                  )}
                >
                  {occasion.name}
                  <span className="text-[0.7rem] tabular opacity-70">{occasion.count}</span>
                </button>
              );
            })}
            {filtering ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                  setOccasionIds([]);
                }}
                className="shrink-0 rounded px-2 text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-96" />
          ))}
        </div>
      ) : null}

      {!isPending && visible.length > 0 ? (
        <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((bundle) => {
            const inactive = bundle.active === false;
            const pieces = bundle.components.reduce((sum, component) => sum + component.quantity, 0);
            const preview = bundle.components.slice(0, PREVIEW_COMPONENTS);
            const more = bundle.components.length - preview.length;
            return (
              <article
                key={bundle.id}
                className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-colors hover:border-primary/50"
              >
                <div className="relative">
                  <ProductImageCarousel
                    media={bundle.media}
                    alt={bundle.name}
                    className={cn("aspect-16/10 border-b border-border", inactive && "opacity-50 grayscale")}
                  />
                  <div className="pointer-events-none absolute top-2 left-2 flex gap-1.5">
                    {inactive ? <Badge className="bg-card/90">Inactive</Badge> : null}
                    {(bundle.discountPercent ?? 0) > 0 ? (
                      <Badge variant="outline" className="bg-card/90 text-primary">
                        {bundle.discountPercent}% off
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div>
                    <h3 className="text-base leading-snug font-semibold">{bundle.name}</h3>
                    {bundle.tagline ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{bundle.tagline}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {bundle.guests ? (
                      <span className="rounded-md bg-muted px-2 py-1">{bundle.guests} guests</span>
                    ) : null}
                    {bundle.setupTime ? (
                      <span className="rounded-md bg-muted px-2 py-1">{bundle.setupTime} setup</span>
                    ) : null}
                    <span className="rounded-md bg-muted px-2 py-1">
                      {pieces} piece{pieces === 1 ? "" : "s"}
                    </span>
                  </div>

                  {bundle.occasions.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
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

                  <div className="rounded-lg border border-border bg-background p-2.5">
                    <p className="mb-1.5 text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">
                      What&apos;s inside
                    </p>
                    {preview.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No products yet.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {preview.map((component) => (
                          <li
                            key={`${component.productId}:${component.variantId ?? ""}`}
                            className={cn("flex items-center gap-2 text-xs", !component.active && "opacity-60")}
                            title={component.active ? undefined : "Inactive product"}
                          >
                            <MediaThumb
                              media={productMedia.get(component.productId)}
                              className="size-6 rounded-full"
                            />
                            <span className="min-w-0 flex-1 truncate">
                              {component.productName}
                              {component.variantName ? ` (${component.variantName})` : ""}
                            </span>
                            <span className="shrink-0 text-muted-foreground tabular">× {component.quantity}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {more > 0 ? (
                      <button
                        type="button"
                        onClick={() => setViewing(bundle)}
                        className="mt-1.5 rounded text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        +{more} more
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-auto">
                    <p className="text-xs text-muted-foreground">Price (from, per event)</p>
                    <p className="text-lg font-semibold text-primary tabular">{formatMoney(bundle.rentalRate)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-1 border-t border-border px-2 py-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewing(bundle)}
                    aria-haspopup="dialog"
                    aria-label={`View details of ${bundle.name}`}
                  >
                    <Info />
                    Details
                  </Button>
                  {canWrite ? (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditing(bundle)}
                        aria-label={`Edit ${bundle.name}`}
                        title="Edit"
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSwitching(bundle)}
                        aria-label={`${inactive ? "Activate" : "Deactivate"} ${bundle.name}`}
                        title={inactive ? "Activate" : "Deactivate"}
                      >
                        {inactive ? <Eye /> : <EyeOff />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setRemoving(bundle)}
                        aria-label={`Delete ${bundle.name}`}
                        title="Delete"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      <Card>
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

        {!isPending && !isError && visible.length === 0 ? (
          <EmptyState
            icon={<Shapes />}
            title={data?.length ? "No bundles match those filters" : "No bundles yet"}
            description={data?.length ? "Try a different search, status or occasion." : undefined}
            action={
              !data?.length && canWrite ? (
                <Button onClick={() => setCreating(true)}>
                  <Plus />
                  New bundle
                </Button>
              ) : null
            }
          />
        ) : null}
      </Card>

      {viewing ? (
        <BundleDetailsDialog
          bundle={viewing}
          productMedia={productMedia}
          onClose={() => setViewing(null)}
          onEdit={
            canWrite
              ? () => {
                  setEditing(viewing);
                  setViewing(null);
                }
              : undefined
          }
        />
      ) : null}
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

"use client";

import { FadeImg } from "@/components/ui/fade-img";
import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ImageOff, Layers, Loader2, RotateCcw, Search, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteArchivedItem, getArchive, masterDataKeys, restoreItem } from "@/features/master-data/api";
import type { ArchiveKind, ArchivedCategory, ArchivedProduct, ArchivedSubCategory } from "@/features/master-data/types";
import { useCan } from "@/features/auth";
import { ApiError } from "@/services/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

/** "12 Nov 2026", or a dash when the backend has no date. */
function dateLabel(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

/** What is about to be deleted for good, named so the confirmation is clear about its reach. */
interface Doomed {
  kind: ArchiveKind;
  id: number;
  name: string;
  /** What else goes with it, in words. */
  alsoRemoves: string | null;
}

function Thumb({ src }: { src: string | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted text-muted-foreground">
      {src && src !== failed ? (
        <FadeImg src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(src)} className="size-full object-cover" />
      ) : (
        <ImageOff className="size-5" aria-hidden="true" />
      )}
    </span>
  );
}

/** A category or sub-category has no photo of its own, so it gets a plain tile with its icon. */
function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
      {children}
    </span>
  );
}

/** One archived thing as a small card: a picture or tile, its name and where it sits, small notes, then its two actions. */
function ArchiveCard({
  visual,
  title,
  subtitle,
  detail,
  notes,
  footer,
}: {
  visual: React.ReactNode;
  title: string;
  subtitle?: string;
  detail?: string;
  notes: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="flex gap-3 p-3">
        {visual}
        <div className="min-w-0 flex-1 space-y-0.5">
          <h3 className="line-clamp-2 text-sm leading-snug font-semibold wrap-break-word" title={title}>
            {title}
          </h3>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
          {detail ? <p className="line-clamp-2 text-xs text-muted-foreground">{detail}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-3">{notes}</div>
      {footer ? (
        <div className="mt-auto flex items-center justify-between gap-1 border-t border-border px-2 py-1.5">{footer}</div>
      ) : null}
    </article>
  );
}

const GRID = "grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";

/**
 * The Archive as a tab of the page it belongs to: the Products page shows the archived products, the Categories page the
 * archived categories and sub-categories. Each can be restored, which brings it back live (a category or sub-category
 * brings back what went with it), or deleted for good, which cannot be undone. A product that is still on a quotation, an
 * order or a customer's plan cannot be deleted; the server says why and it stays here.
 */
export function ArchivePanel({ scope }: { scope: "products" | "categories" }) {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search);
  const [doomed, setDoomed] = useState<Doomed | null>(null);

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: [...masterDataKeys.archive, query.trim()],
    queryFn: ({ signal }) => getArchive(query, signal),
  });

  /** Archive, products, categories and every other master-data list can have changed. */
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["master-data"] });

  const restore = useMutation({
    mutationFn: ({ kind, id }: { kind: ArchiveKind; id: number; name: string }) => restoreItem(kind, id),
    onSuccess: (_done, { name }) => {
      toast.success(`${name} is back`);
      refresh();
    },
    onError: (failure) => toast.error(failure instanceof ApiError ? failure.message : "Could not restore it."),
  });

  const showProducts = scope === "products";
  const total = showProducts
    ? (data?.productTotal ?? 0)
    : (data?.categories.length ?? 0) + (data?.subCategories.length ?? 0);

  const actions = (kind: ArchiveKind, id: number, name: string, alsoRemoves: string | null) =>
    canWrite ? (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => restore.mutate({ kind, id, name })}
          disabled={restore.isPending}
          aria-label={`Restore ${name}`}
        >
          {restore.isPending && restore.variables?.id === id && restore.variables.kind === kind ? (
            <Loader2 className="animate-spin" />
          ) : (
            <RotateCcw />
          )}
          Restore
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setDoomed({ kind, id, name, alsoRemoves })}
          aria-label={`Delete ${name} for good`}
        >
          <Trash2 />
          Delete forever
        </Button>
      </>
    ) : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {showProducts
          ? "Archived products. Restore brings one back; Delete forever removes it for good."
          : "Archived categories and sub-categories, with the products that went with them. Restore brings one back; Delete forever removes it for good."}
      </p>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={showProducts ? "Search archived products by name or SKU" : "Search archived categories by name"}
          aria-label="Search the archive"
          className="pl-8"
        />
      </div>

      {isPending ? <Skeleton className="h-40 rounded-lg" /> : null}

      {isError ? (
        <Card>
          <EmptyState
            title="Could not load the archive"
            description={error instanceof Error ? error.message : undefined}
            action={
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : null}

      {data && total === 0 ? (
        <Card>
          <EmptyState
            icon={<Archive />}
            title={query.trim() ? `Nothing archived matches “${query.trim()}”` : "The archive is empty"}
            description={
              query.trim()
                ? "Try a different name."
                : showProducts
                  ? "Use Archive on a product to put it here instead of deleting it."
                  : "Use Archive on a category or sub-category to put it here instead of deleting it."
            }
          />
        </Card>
      ) : null}

      {data && !showProducts && data.categories.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Categories ({data.categories.length})</h2>
          <div className={GRID}>
            {data.categories.map((category: ArchivedCategory) => {
              const subs = `${category.subCategories} ${category.subCategories === 1 ? "sub-category" : "sub-categories"}`;
              const items = `${category.products} ${category.products === 1 ? "product" : "products"}`;
              return (
                <ArchiveCard
                  key={category.id}
                  visual={
                    <IconTile>
                      <Tags className="size-6" aria-hidden="true" />
                    </IconTile>
                  }
                  title={category.name}
                  subtitle="Category"
                  detail={`${subs} · ${items}`}
                  notes={<Badge variant="outline">Archived {dateLabel(category.archivedAt)}</Badge>}
                  footer={actions("categories", category.id, category.name, `its ${subs} and ${items}`)}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {data && !showProducts && data.subCategories.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Sub-categories ({data.subCategories.length})</h2>
          <div className={GRID}>
            {data.subCategories.map((sub: ArchivedSubCategory) => (
              <ArchiveCard
                key={sub.id}
                visual={
                  <IconTile>
                    <Layers className="size-6" aria-hidden="true" />
                  </IconTile>
                }
                title={sub.name}
                subtitle={`In ${sub.categoryName}`}
                detail={`${sub.products} ${sub.products === 1 ? "product" : "products"}`}
                notes={
                  <>
                    <Badge variant="outline">Archived {dateLabel(sub.archivedAt)}</Badge>
                    {sub.archivedWithParent ? <Badge>With its category</Badge> : null}
                    {sub.categoryArchived ? <Badge>Category archived too</Badge> : null}
                  </>
                }
                footer={actions(
                  "sub-categories",
                  sub.id,
                  sub.name,
                  sub.products ? `its ${sub.products} ${sub.products === 1 ? "product" : "products"}` : null,
                )}
              />
            ))}
          </div>
        </section>
      ) : null}

      {data && showProducts && data.products.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">
            Products ({data.productTotal > data.products.length ? `${data.products.length} of ${data.productTotal}` : data.productTotal})
          </h2>
          <div className={GRID}>
            {data.products.map((product: ArchivedProduct) => (
              <ArchiveCard
                key={product.id}
                visual={<Thumb src={product.imageUrl} />}
                title={product.name}
                subtitle={product.sku}
                detail={`${product.categoryName} › ${product.subCategoryName}`}
                notes={
                  <>
                    <Badge variant="outline">Archived {dateLabel(product.archivedAt)}</Badge>
                    {product.archivedWithParent ? <Badge>With its parent</Badge> : null}
                    {product.parentArchived ? <Badge>Parent archived</Badge> : null}
                  </>
                }
                footer={actions("products", product.id, product.name, null)}
              />
            ))}
          </div>
          {data.productTotal > data.products.length ? (
            <p className="text-xs text-muted-foreground">
              Showing the first {data.products.length} of {data.productTotal}. Search to narrow the list.
            </p>
          ) : null}
        </section>
      ) : null}

      {isFetching && !isPending ? <p className="text-xs text-muted-foreground">Refreshing…</p> : null}

      {doomed ? (
        <ConfirmDialog
          title={`Delete ${doomed.name} for good?`}
          description={
            doomed.alsoRemoves
              ? `This cannot be undone. It also deletes ${doomed.alsoRemoves}. If any product in it is still on a quotation, an order or a customer's plan, nothing is deleted.`
              : "This cannot be undone. Its variants, stock and photo records are deleted with it. A product that is still on a quotation, an order or a customer's plan cannot be deleted; it stays here."
          }
          confirmLabel="Delete forever"
          fallbackError="Could not delete it."
          action={() => deleteArchivedItem(doomed.kind, doomed.id)}
          onDone={() => {
            toast.success(`${doomed.name} was deleted`);
            refresh();
            setDoomed(null);
          }}
          onClose={() => setDoomed(null)}
        />
      ) : null}
    </div>
  );
}

"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, List, Plus, Search, SearchX, Tags, X } from "lucide-react";
import {
  activateCategory,
  deactivateCategory,
  listCategories,
  listProducts,
  masterDataKeys,
} from "@/features/master-data/api";
import type { CategoryView } from "@/features/master-data/types";
import { CategoryCard, NO_COUNTS, type CategoryCounts } from "@/features/master-data/components/CategoryCard";
import { CategoryDialog } from "@/features/master-data/components/CategoryDialog";
import { useCan } from "@/features/auth";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

type StatusFilter = "all" | "active" | "inactive";

const GRID = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";

export function CategoriesPage() {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const canRead = useCan("MASTER_DATA_READ");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CategoryView | null>(null);
  const [deactivating, setDeactivating] = useState<CategoryView | null>(null);
  const [activating, setActivating] = useState<CategoryView | null>(null);
  const queryClient = useQueryClient();

  const deferredSearch = useDeferredValue(search);
  const term = deferredSearch.trim().toLowerCase();

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: masterDataKeys.categories,
    queryFn: ({ signal }) => listCategories(signal),
  });

  // How many products sit in each category and sub-category. Shares the products cache entry the other
  // screens use; a role that cannot read products simply sees no counts.
  const products = useQuery({
    queryKey: masterDataKeys.products,
    queryFn: ({ signal }) => listProducts(signal),
    enabled: canRead,
  });
  const counts = useMemo(() => {
    if (!products.data) return null;
    const byCategory = new Map<string, CategoryCounts>();
    for (const product of products.data) {
      if (!product.categoryId) continue;
      const entry: CategoryCounts = byCategory.get(product.categoryId) ?? { total: 0, bySub: new Map(), subMedia: new Map() };
      entry.total += 1;
      entry.media ??= product.media?.some((item) => item.kind === "IMAGE") ? product.media : undefined;
      if (product.subCategoryId) {
        entry.bySub.set(product.subCategoryId, (entry.bySub.get(product.subCategoryId) ?? 0) + 1);
        if (!entry.subMedia.get(product.subCategoryId)?.length && product.media?.some((item) => item.kind === "IMAGE")) {
          entry.subMedia.set(product.subCategoryId, product.media);
        }
      }
      byCategory.set(product.categoryId, entry);
    }
    return byCategory;
  }, [products.data]);

  const activeCount = (data ?? []).filter((category: CategoryView) => category.active).length;
  const inactiveCount = (data?.length ?? 0) - activeCount;
  const subCount = (data ?? []).reduce((sum, category: CategoryView) => sum + category.subCategories.length, 0);

  const visible = useMemo(() => {
    // A match on a sub-category keeps its parent in view, so a search for
    // "chandeliers" shows where they are filed.
    return (data ?? []).filter(
      (category: CategoryView) =>
        (status === "all" || (status === "active" ? category.active : !category.active)) &&
        (!term ||
          category.name.toLowerCase().includes(term) ||
          category.subCategories.some((sub) => sub.name.toLowerCase().includes(term))),
    );
  }, [data, term, status]);

  const newButton = canWrite ? (
    <Button onClick={() => setCreating(true)}>
      <Plus />
      New category
    </Button>
  ) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Categories"
        description="Groupings used to organise the product catalogue."
        actions={newButton}
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search categories and sub-categories"
            className="h-10 pr-9 pl-9"
            aria-label="Search categories"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <div role="group" aria-label="Status" className="inline-flex rounded-md border border-border bg-card p-0.5">
          {(
            [
              { value: "all", label: "All", count: data?.length ?? 0 },
              { value: "active", label: "Active", count: activeCount },
              { value: "inactive", label: "Inactive", count: inactiveCount },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setStatus(option.value)}
              aria-pressed={status === option.value}
              className={cn(
                "h-8 rounded px-2.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                status === option.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {option.label} <span className="text-[0.7rem] tabular opacity-70">{option.count}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground tabular" aria-live="polite">
          {isPending
            ? "Loading…"
            : `${visible.length} of ${data?.length ?? 0} categories · ${subCount} sub-categories`}
          {isFetching && !isPending ? " · refreshing" : ""}
        </p>
        <div role="group" aria-label="Layout" className="ml-auto inline-flex rounded-md border border-border bg-card p-0.5">
          {(
            [
              { value: "grid", label: "Card view", icon: LayoutGrid },
              { value: "list", label: "List view", icon: List },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setLayout(option.value)}
              aria-pressed={layout === option.value}
              aria-label={option.label}
              title={option.label}
              className={cn(
                "flex size-8 items-center justify-center rounded outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                layout === option.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <option.icon className="size-4" />
            </button>
          ))}
        </div>
      </div>

      {isPending ? (
        <div className={GRID}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-60 rounded-lg" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <Card>
          <EmptyState
            title="Could not load categories"
            description={error instanceof Error ? error.message : undefined}
            action={
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : null}

      {data && visible.length === 0 ? (
        <Card>
          {data.length ? (
            <EmptyState
              icon={<SearchX />}
              title={deferredSearch.trim() ? `No categories match “${deferredSearch.trim()}”` : `No ${status} categories`}
              description="Nothing matches this search and status. Try a different word or status."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setStatus("all");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState icon={<Tags />} title="No categories yet" action={newButton} />
          )}
        </Card>
      ) : null}

      {visible.length > 0 ? (
        <div className={layout === "grid" ? GRID : "space-y-3"}>
          {visible.map((category: CategoryView) => (
            <CategoryCard
              key={category.id}
              category={category}
              term={term}
              layout={layout}
              canViewProducts={canRead}
              counts={counts?.get(category.id) ?? (counts ? NO_COUNTS : null)}
              onEdit={canWrite ? () => setEditing(category) : undefined}
              onDeactivate={
                canWrite && category.active ? () => setDeactivating(category) : undefined
              }
              onActivate={
                canWrite && !category.active ? () => setActivating(category) : undefined
              }
            />
          ))}
        </div>
      ) : null}

      {creating ? <CategoryDialog onClose={() => setCreating(false)} /> : null}
      {editing ? <CategoryDialog existing={editing} onClose={() => setEditing(null)} /> : null}
      {activating ? (
        <ConfirmDialog
          title={`Activate ${activating.name}?`}
          description="It returns to the product picker, along with its sub-categories."
          confirmLabel="Activate category"
          destructive={false}
          fallbackError="Could not activate the category."
          action={() => activateCategory(activating.id)}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: masterDataKeys.categories });
            setActivating(null);
          }}
          onClose={() => setActivating(null)}
        />
      ) : null}
      {deactivating ? (
        <ConfirmDialog
          title={`Deactivate ${deactivating.name}?`}
          description="It disappears from the list and from any picker, along with its sub-categories, but the rows stay, so products already filed under it keep their label."
          confirmLabel="Deactivate category"
          fallbackError="Could not deactivate the category."
          action={() => deactivateCategory(deactivating.id)}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: masterDataKeys.categories });
            setDeactivating(null);
          }}
          onClose={() => setDeactivating(null)}
        />
      ) : null}
    </div>
  );
}

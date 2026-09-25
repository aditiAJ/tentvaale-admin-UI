"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, SearchX, Tags, X } from "lucide-react";
import { deactivateCategory, listCategories, masterDataKeys } from "@/features/master-data/api";
import type { CategoryView } from "@/features/master-data/types";
import { CategoryCard } from "@/features/master-data/components/CategoryCard";
import { CategoryDialog } from "@/features/master-data/components/CategoryDialog";
import { useCan } from "@/features/auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

const GRID = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";

export function CategoriesPage() {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CategoryView | null>(null);
  const [deactivating, setDeactivating] = useState<CategoryView | null>(null);
  const queryClient = useQueryClient();

  const deferredSearch = useDeferredValue(search);
  const term = deferredSearch.trim().toLowerCase();

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: masterDataKeys.categories,
    queryFn: ({ signal }) => listCategories(signal),
  });

  const visible = useMemo(() => {
    if (!term) return data ?? [];
    // A match on a sub-category keeps its parent in view, so a search for
    // "chandeliers" shows where they are filed.
    return (data ?? []).filter(
      (category: CategoryView) =>
        category.name.toLowerCase().includes(term) ||
        category.subCategories.some((sub) => sub.name.toLowerCase().includes(term)),
    );
  }, [data, term]);

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
        <p className="text-xs text-muted-foreground tabular" aria-live="polite">
          {isPending ? "Loading…" : `${visible.length} of ${data?.length ?? 0} categories`}
          {isFetching && !isPending ? " · refreshing" : ""}
        </p>
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
              title={`No categories match “${deferredSearch.trim()}”`}
              description="Neither a category nor any of its sub-categories has that in its name."
              action={
                <Button variant="outline" onClick={() => setSearch("")}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <EmptyState icon={<Tags />} title="No categories yet" action={newButton} />
          )}
        </Card>
      ) : null}

      {visible.length > 0 ? (
        <div className={GRID}>
          {visible.map((category: CategoryView) => (
            <CategoryCard
              key={category.id}
              category={category}
              term={term}
              onEdit={canWrite ? () => setEditing(category) : undefined}
              onDeactivate={
                canWrite && category.active ? () => setDeactivating(category) : undefined
              }
            />
          ))}
        </div>
      ) : null}

      {creating ? <CategoryDialog onClose={() => setCreating(false)} /> : null}
      {editing ? <CategoryDialog existing={editing} onClose={() => setEditing(null)} /> : null}
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

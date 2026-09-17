"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EyeOff, Plus, Search, Tags } from "lucide-react";
import { deactivateCategory, listCategories, masterDataKeys } from "@/features/master-data/api";
import type { CategoryView } from "@/features/master-data/types";
import { CategoryDialog } from "@/features/master-data/components/CategoryDialog";
import { RowActions } from "@/features/master-data/components/RowActions";
import { useCan } from "@/features/auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export function CategoriesPage() {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CategoryView | null>(null);
  const [deactivating, setDeactivating] = useState<CategoryView | null>(null);
  const queryClient = useQueryClient();

  const deferredSearch = useDeferredValue(search);
  const columns = canWrite ? 2 : 1;

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: masterDataKeys.categories,
    queryFn: ({ signal }) => listCategories(signal),
  });

  const visible = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    if (!term) return data ?? [];
    return (data ?? []).filter((category: CategoryView) => category.name.toLowerCase().includes(term));
  }, [data, deferredSearch]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Categories"
        description="Groupings used to organise the product catalogue."
        actions={
          canWrite ? (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              New category
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search category name"
            className="pl-8"
            aria-label="Search categories"
          />
        </div>
        <p className="text-xs text-muted-foreground tabular" aria-live="polite">
          {isPending ? "Loading…" : `${visible.length} of ${data?.length ?? 0} categories`}
          {isFetching && !isPending ? " · refreshing" : ""}
        </p>
      </div>

      <Card>
        <TableWrapper>
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                {canWrite ? <TH className="text-right">Actions</TH> : null}
              </tr>
            </THead>
            <TBody>
              {isPending ? <TableSkeleton columns={columns} /> : null}

              {!isPending && visible.length > 0
                ? visible.map((category: CategoryView) => (
                    <TR key={category.id}>
                      <TD className="font-medium">{category.name}</TD>
                      {canWrite ? (
                        <TD>
                          <RowActions
                            label={category.name}
                            onEdit={() => setEditing(category)}
                            onRemove={() => setDeactivating(category)}
                            removeLabel="Deactivate"
                            removeIcon={<EyeOff />}
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
            title="Could not load categories"
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
            icon={<Tags />}
            title={data?.length ? "No categories match that search" : "No categories yet"}
            description={
              data?.length
                ? "Try a different name."
                : "Add the first grouping for this company's catalogue."
            }
            action={
              !data?.length && canWrite ? (
                <Button onClick={() => setCreating(true)}>
                  <Plus />
                  New category
                </Button>
              ) : null
            }
          />
        ) : null}
      </Card>

      {creating ? <CategoryDialog onClose={() => setCreating(false)} /> : null}
      {editing ? <CategoryDialog existing={editing} onClose={() => setEditing(null)} /> : null}
      {deactivating ? (
        <ConfirmDialog
          title={`Deactivate ${deactivating.name}?`}
          description="It disappears from the list and from any picker, but the row stays, so products already filed under it keep their label."
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

"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Tags } from "lucide-react";
import { listCategories, masterDataKeys } from "@/features/master-data/api";
import type { CategoryView } from "@/features/master-data/types";
import { CreateCategoryDialog } from "@/features/master-data/components/CreateCategoryDialog";
import { useCan } from "@/features/auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const COLUMNS = 1;

export function CategoriesPage() {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const deferredSearch = useDeferredValue(search);

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
              </tr>
            </THead>
            <TBody>
              {isPending ? <TableSkeleton columns={COLUMNS} /> : null}

              {!isPending && visible.length > 0
                ? visible.map((category: CategoryView) => (
                    <TR key={category.id}>
                      <TD className="font-medium">{category.name}</TD>
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

      {creating ? <CreateCategoryDialog onClose={() => setCreating(false)} /> : null}
    </div>
  );
}

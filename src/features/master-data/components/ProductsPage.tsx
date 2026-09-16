"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package, Plus, Search } from "lucide-react";
import { listProducts, masterDataKeys } from "@/features/master-data/api";
import type { ProductView } from "@/features/master-data/types";
import { CreateProductDialog } from "@/features/master-data/components/CreateProductDialog";
import { useCan } from "@/features/auth";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const COLUMNS = 5;

function matches(product: ProductView, term: string): boolean {
  const haystack = [product.sku, product.name, product.categoryName ?? ""].join(" ").toLowerCase();
  return haystack.includes(term);
}

export function ProductsPage() {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  // The list is unpaged and filtered in the browser, so typing re-renders every
  // row. Deferring the term keeps the input responsive on a large catalogue;
  // when the backend grows a search parameter this moves server-side.
  const deferredSearch = useDeferredValue(search);

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: masterDataKeys.products,
    queryFn: ({ signal }) => listProducts(signal),
  });

  const visible = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    if (!term) return data ?? [];
    return (data ?? []).filter((product) => matches(product, term));
  }, [data, deferredSearch]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Products"
        description="The rental catalogue for this company."
        actions={
          canWrite ? (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              New product
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
            placeholder="Search SKU, name or category"
            className="pl-8"
            aria-label="Search products"
          />
        </div>
        <p className="text-xs text-muted-foreground tabular" aria-live="polite">
          {isPending ? "Loading…" : `${visible.length} of ${data?.length ?? 0} products`}
          {isFetching && !isPending ? " · refreshing" : ""}
        </p>
      </div>

      <Card>
        <TableWrapper>
          <Table>
            <THead>
              <tr>
                <TH>SKU</TH>
                <TH>Name</TH>
                <TH>Category</TH>
                <TH className="text-right">Rental rate</TH>
                <TH className="text-right">Security deposit</TH>
              </tr>
            </THead>
            <TBody>
              {isPending ? <TableSkeleton columns={COLUMNS} /> : null}

              {!isPending && visible.length > 0
                ? visible.map((product) => (
                    <TR key={product.id}>
                      <TD className="font-mono text-xs">{product.sku}</TD>
                      <TD>
                        <span className="font-medium">{product.name}</span>
                        {product.description ? (
                          <span className="block max-w-sm truncate text-xs text-muted-foreground">
                            {product.description}
                          </span>
                        ) : null}
                      </TD>
                      <TD>
                        {product.categoryName ? (
                          <Badge variant="outline">{product.categoryName}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Uncategorised</span>
                        )}
                      </TD>
                      <TD className="text-right tabular">{formatMoney(product.rentalRate)}</TD>
                      <TD className="text-right tabular">{formatMoney(product.securityDeposit)}</TD>
                    </TR>
                  ))
                : null}
            </TBody>
          </Table>
        </TableWrapper>

        {isError ? (
          <EmptyState
            title="Could not load products"
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
            icon={<Package />}
            title={data?.length ? "No products match that search" : "No products yet"}
            description={
              data?.length
                ? "Try a different SKU, name or category."
                : "Add the first item in this company's rental catalogue."
            }
            action={
              !data?.length && canWrite ? (
                <Button onClick={() => setCreating(true)}>
                  <Plus />
                  New product
                </Button>
              ) : null
            }
          />
        ) : null}
      </Card>

      {creating ? <CreateProductDialog onClose={() => setCreating(false)} /> : null}
    </div>
  );
}

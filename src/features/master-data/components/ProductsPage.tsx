"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Layers, Package, Pencil, Plus, Search } from "lucide-react";
import { listProducts, masterDataKeys, setProductActive } from "@/features/master-data/api";
import type { ProductView } from "@/features/master-data/types";
import { MediaThumb } from "@/features/master-data/components/MediaThumb";
import { ProductDialog } from "@/features/master-data/components/ProductDialog";
import { ProductVariantsDialog } from "@/features/master-data/components/ProductVariantsDialog";
import { useCan } from "@/features/auth";
import { formatMoney } from "@/lib/money";
import { RATE_TYPE_LABEL } from "@/features/master-data/storefront";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

function matches(product: ProductView, term: string): boolean {
  const haystack = [
    product.sku,
    product.skuOwner,
    product.name,
    product.genericName,
    product.categoryName ?? "",
    product.subCategoryName ?? "",
    // The storefront facets, so "velvet" or "royal heritage" finds its products.
    ...(product.colours ?? []),
    ...(product.materials ?? []),
    ...(product.fabrics ?? []),
    ...(product.moods ?? []),
    ...(product.themes ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
}

export function ProductsPage() {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ProductView | null>(null);
  const [managingVariants, setManagingVariants] = useState<ProductView | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [switching, setSwitching] = useState<ProductView | null>(null);
  const queryClient = useQueryClient();

  // Actions is always shown: anyone who can see a product can see its variants.
  const columns = 6;

  // The list is unpaged and filtered in the browser, so typing re-renders every
  // row. Deferring the term keeps the input responsive on a large catalogue;
  // when the backend grows a search parameter this moves server-side.
  const deferredSearch = useDeferredValue(search);

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: [...masterDataKeys.products, showInactive ? "all" : "active"],
    queryFn: ({ signal }) => listProducts(signal, { includeInactive: showInactive }),
  });

  // The filter offers the categories the catalogue actually uses, each with how many products it holds.
  const categories = useMemo(() => {
    const byId = new Map<string, { name: string; count: number }>();
    for (const product of data ?? []) {
      if (!product.categoryId) continue;
      const entry = byId.get(product.categoryId) ?? { name: product.categoryName ?? product.categoryId, count: 0 };
      entry.count += 1;
      byId.set(product.categoryId, entry);
    }
    return [...byId.entries()]
      .map(([id, entry]) => ({ id, ...entry }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const visible = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    return (data ?? []).filter(
      (product) =>
        (!categoryId || product.categoryId === categoryId) &&
        (!term || matches(product, term)),
    );
  }, [data, deferredSearch, categoryId]);

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
            placeholder="Search SKU, name, category or colour"
            className="pl-8"
            aria-label="Search products"
          />
        </div>
        <Select
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          aria-label="Category"
          className="w-52"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name} ({category.count})
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(event) => setShowInactive(event.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />
          Show inactive
        </label>
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
                <TH className="text-right">Wholesale</TH>
                <TH className="text-right">Retail</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {isPending ? <TableSkeleton columns={columns} /> : null}

              {!isPending && visible.length > 0
                ? visible.map((product) => (
                    <TR key={product.id}>
                      <TD>
                        <span className="font-mono text-xs whitespace-nowrap">{product.sku}</span>
                        <span className="block text-xs text-muted-foreground">
                          {product.skuOwner}
                        </span>
                      </TD>
                      <TD>
                        <div className="flex items-center gap-2.5">
                          <MediaThumb media={product.media} />
                          <div className="min-w-0">
                            <span className="font-medium">{product.name}</span>
                            {product.active === false ? (
                              <Badge className="ml-1.5 align-middle">Inactive</Badge>
                            ) : null}
                            {product.hasVariants ? (
                              <Badge className="ml-1.5 align-middle tabular">
                                {product.variants.length}{" "}
                                {product.variants.length === 1 ? "variant" : "variants"}
                              </Badge>
                            ) : null}
                            {product.genericName || product.description ? (
                              <span className="block max-w-[15rem] truncate text-xs text-muted-foreground xl:max-w-xs">
                                {[product.genericName, product.description].filter(Boolean).join(" · ")}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </TD>
                      <TD>
                        {product.categoryName ? (
                          <>
                            <Badge variant="outline">{product.categoryName}</Badge>
                            {product.subCategoryName ? (
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {product.subCategoryName}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">Uncategorised</span>
                        )}
                      </TD>
                      <TD className="text-right tabular">{formatMoney(product.wholesaleRate)}</TD>
                      <TD className="text-right tabular">
                        {formatMoney(product.retailRate)}
                        {/* Per unit is the norm and goes unsaid; the others change what a quantity means. */}
                        {product.rateType && product.rateType !== "Qty" ? (
                          <span className="block text-xs text-muted-foreground">
                            {RATE_TYPE_LABEL[product.rateType]}
                          </span>
                        ) : null}
                      </TD>
                      <TD>
                        <div className="flex justify-end gap-1">
                          {/* Every product has a variant (the default), so every product has stock to
                              write and may gain variants. */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setManagingVariants(product)}
                            aria-label={`Variants and stock of ${product.name}`}
                            title="Variants & stock"
                          >
                            <Layers />
                            <span className="hidden 2xl:inline">Variants & stock</span>
                          </Button>
                          {canWrite ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditing(product)}
                              aria-label={`Edit ${product.name}`}
                              title="Edit"
                            >
                              <Pencil />
                            </Button>
                          ) : null}
                          {canWrite ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSwitching(product)}
                              aria-label={`${product.active === false ? "Activate" : "Deactivate"} ${product.name}`}
                              title={product.active === false ? "Activate" : "Deactivate"}
                            >
                              {product.active === false ? <Eye /> : <EyeOff />}
                            </Button>
                          ) : null}
                        </div>
                      </TD>
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
            title={data?.length ? "No products match those filters" : "No products yet"}
            description={
              data?.length
                ? "Try a different search or category."
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

      {creating ? <ProductDialog onClose={() => setCreating(false)} /> : null}
      {editing ? <ProductDialog existing={editing} onClose={() => setEditing(null)} /> : null}
      {switching ? (
        <ConfirmDialog
          title={`${switching.active === false ? "Activate" : "Deactivate"} ${switching.name}?`}
          description={
            switching.active === false
              ? "It returns to the product pickers and the storefront."
              : "It stays on record, with its variants and stock, but leaves the product pickers and the storefront. Existing quotations and orders keep it."
          }
          confirmLabel={switching.active === false ? "Activate product" : "Deactivate product"}
          destructive={switching.active !== false}
          fallbackError="Could not change the product."
          action={() => setProductActive(switching.id, switching.active === false)}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: masterDataKeys.products });
            setSwitching(null);
          }}
          onClose={() => setSwitching(null)}
        />
      ) : null}
      {managingVariants ? (
        <ProductVariantsDialog
          product={managingVariants}
          onClose={() => setManagingVariants(null)}
        />
      ) : null}
    </div>
  );
}

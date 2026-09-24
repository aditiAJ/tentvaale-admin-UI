"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Film, Layers, Package, Pencil, Plus, Search } from "lucide-react";
import { listProducts, masterDataKeys } from "@/features/master-data/api";
import type { ProductMedia, ProductView } from "@/features/master-data/types";
import { ProductDialog } from "@/features/master-data/components/ProductDialog";
import { ProductVariantsDialog } from "@/features/master-data/components/ProductVariantsDialog";
import { useCan } from "@/features/auth";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

/**
 * The product's first image at thumbnail size, or a film icon when it has only
 * a video. Nothing at all when it has neither, so a catalogue without media
 * reads exactly as it did before.
 */
function MediaThumb({ media }: { media: ProductMedia[] }) {
  if (!media.length) return null;
  const image = media.find((item) => item.kind === "IMAGE" && item.url);
  const label = `${media.length} media ${media.length === 1 ? "item" : "items"}`;

  return (
    <div
      className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted text-muted-foreground"
      title={label}
    >
      {image?.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local data URL; nothing to optimise
        <img src={image.url} alt="" className="size-full object-cover" />
      ) : (
        <Film className="size-4" aria-label={label} />
      )}
    </div>
  );
}

function matches(product: ProductView, term: string): boolean {
  const haystack = [
    product.sku,
    product.skuOwner,
    product.name,
    product.genericName,
    product.categoryName ?? "",
    product.subCategoryName ?? "",
    product.tag,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
}

export function ProductsPage() {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ProductView | null>(null);
  const [managingVariants, setManagingVariants] = useState<ProductView | null>(null);

  // Actions is always shown: anyone who can see a product can see its variants.
  const columns = 8;

  // The list is unpaged and filtered in the browser, so typing re-renders every
  // row. Deferring the term keeps the input responsive on a large catalogue;
  // when the backend grows a search parameter this moves server-side.
  const deferredSearch = useDeferredValue(search);

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: masterDataKeys.products,
    queryFn: ({ signal }) => listProducts(signal),
  });

  // Tags are free text, so the filter offers the ones the catalogue actually
  // uses rather than a fixed list. Compared case-insensitively, so "lighting"
  // and "Lighting" are one option and one filter.
  const tags = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const product of data ?? []) {
      const key = product.tag.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, product.tag);
    }
    return [...byKey.values()].sort((a, b) => a.localeCompare(b));
  }, [data]);

  const visible = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    return (data ?? []).filter(
      (product) =>
        (!tag || product.tag.toLowerCase() === tag.toLowerCase()) &&
        (!term || matches(product, term)),
    );
  }, [data, deferredSearch, tag]);

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
            placeholder="Search SKU, owner, name, category or tag"
            className="pl-8"
            aria-label="Search products"
          />
        </div>
        <Select
          value={tag}
          onChange={(event) => setTag(event.target.value)}
          aria-label="Tag"
          className="w-40"
        >
          <option value="">All tags</option>
          {tags.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
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
                <TH>Generic name</TH>
                <TH>Category</TH>
                <TH>Tag</TH>
                <TH className="text-right">Wholesale rate</TH>
                <TH className="text-right">Retail rate</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {isPending ? <TableSkeleton columns={columns} /> : null}

              {!isPending && visible.length > 0
                ? visible.map((product) => (
                    <TR key={product.id}>
                      <TD>
                        <span className="font-mono text-xs">{product.sku}</span>
                        <span className="block text-xs text-muted-foreground">
                          {product.skuOwner}
                        </span>
                      </TD>
                      <TD>
                        <div className="flex items-center gap-2.5">
                          <MediaThumb media={product.media} />
                          <div className="min-w-0">
                            <span className="font-medium">{product.name}</span>
                            {product.hasVariants ? (
                              <Badge className="ml-1.5 align-middle tabular">
                                {product.variants.length}{" "}
                                {product.variants.length === 1 ? "variant" : "variants"}
                              </Badge>
                            ) : null}
                            {product.description ? (
                              <span className="block max-w-sm truncate text-xs text-muted-foreground">
                                {product.description}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </TD>
                      <TD>{product.genericName}</TD>
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
                      <TD>{product.tag}</TD>
                      <TD className="text-right tabular">{formatMoney(product.wholesaleRate)}</TD>
                      <TD className="text-right tabular">{formatMoney(product.retailRate)}</TD>
                      <TD>
                        <div className="flex justify-end gap-1">
                          {/* Only a product set to have variants has any to
                              manage, so the rest get no button at all. */}
                          {product.hasVariants ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setManagingVariants(product)}
                              aria-label={`Variants of ${product.name}`}
                            >
                              <Layers />
                              Variants
                            </Button>
                          ) : null}
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
                ? "Try a different search or tag."
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
      {managingVariants ? (
        <ProductVariantsDialog
          product={managingVariants}
          onClose={() => setManagingVariants(null)}
        />
      ) : null}
    </div>
  );
}

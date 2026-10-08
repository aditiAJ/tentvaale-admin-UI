"use client";

import { Fragment, useDeferredValue, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Eye, EyeOff, Package, Pencil, Plus, Search } from "lucide-react";
import { listProducts, masterDataKeys, setProductActive } from "@/features/master-data/api";
import type { ProductView } from "@/features/master-data/types";
import { MediaThumb } from "@/features/master-data/components/MediaThumb";
import { ProductDialog } from "@/features/master-data/components/ProductDialog";
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

/** The variants a customer can choose between: a lone untouched default is just the product itself. */
function realVariants(product: ProductView) {
  return product.variants.filter((variant) => !(variant.isDefault && !variant.hasAttributes));
}

/** What a variant differs by (Colour, Size ...), from the product's axes. */
function variantType(product: ProductView, attributeFacetIds: string[] | undefined) {
  return (attributeFacetIds ?? [])
    .map((id) => product.axes?.find((axis) => axis.facetId === id)?.label)
    .filter(Boolean)
    .join(" / ");
}

/**
 * A product's variants as rows of the product table itself, so their rates sit under the product's own columns and
 * the full width is used. Same type together, in the order types first appear.
 */
function VariantRows({ product }: { product: ProductView }) {
  const list = realVariants(product);
  if (list.length === 0) {
    return (
      <tr className="bg-muted/30">
        <td colSpan={6} className="border-l-2 border-primary/40 px-4 py-2 text-xs text-muted-foreground">
          No variants yet. Add them from Edit.
        </td>
      </tr>
    );
  }
  const typeOf = (variant: (typeof list)[number]) => variantType(product, variant.attributeFacetIds) || "Other";
  const types = [...new Set(list.map(typeOf))];
  const rows = types.flatMap((type) => list.filter((variant) => typeOf(variant) === type));
  // The product's own pieces (its default variant) sit beside the variants, counted in the product's total.
  const base = product.variants.find((variant) => variant.isDefault && !variant.hasAttributes);
  return (
    <>
      {base && base.stock > 0 ? (
        <tr className="bg-muted/30 text-xs">
          <td className="border-l-2 border-primary/40 px-4 py-1.5">
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide text-primary uppercase">
              Main
            </span>
          </td>
          <td className="py-1.5 pr-3">
            <span className="flex items-center gap-2 pl-[3.1rem] font-medium">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-primary/50" />
              {product.name} (the product itself)
            </span>
          </td>
          <td className="py-1.5 pr-3">
            <span className="inline-flex items-center gap-1.5 tabular text-success">
              <span className="size-1.5 rounded-full bg-success" />
              {base.stock} in stock
            </span>
          </td>
          <td className="px-4 py-1.5 text-right tabular">{formatMoney(product.wholesaleRate)}</td>
          <td className="px-4 py-1.5 text-right tabular">{formatMoney(product.retailRate)}</td>
          <td />
        </tr>
      ) : null}
      {rows.map((variant, index) => {
        const type = typeOf(variant);
        const firstOfType = index === 0 || typeOf(rows[index - 1]) !== type;
        const off = variant.active === false;
        return (
          <tr key={variant.id} className={`bg-muted/30 text-xs ${off ? "opacity-60" : ""}`}>
            <td className="border-l-2 border-primary/40 px-4 py-1.5">
              {firstOfType ? (
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide text-primary uppercase">
                  {type}
                </span>
              ) : null}
            </td>
            <td className="py-1.5 pr-3">
              <span className="flex items-center gap-2 pl-[3.1rem] font-medium">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-primary/50" />
                {variant.name}
                {off ? <Badge>Off</Badge> : null}
              </span>
            </td>
            <td className="py-1.5 pr-3">
              <span
                className={`inline-flex items-center gap-1.5 tabular ${variant.stock > 0 ? "text-success" : "text-muted-foreground"}`}
              >
                <span className={`size-1.5 rounded-full ${variant.stock > 0 ? "bg-success" : "bg-muted-foreground/50"}`} />
                {variant.stock > 0 ? `${variant.stock} in stock` : "No stock"}
              </span>
            </td>
            <td className="px-4 py-1.5 text-right tabular">{formatMoney(variant.wholesaleRate)}</td>
            <td className="px-4 py-1.5 text-right tabular">{formatMoney(variant.retailRate)}</td>
            <td />
          </tr>
        );
      })}
    </>
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
  const [showInactive, setShowInactive] = useState(false);
  const [switching, setSwitching] = useState<ProductView | null>(null);
  const [openVariants, setOpenVariants] = useState<Set<string>>(new Set());
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
                    <Fragment key={product.id}>
                    <TR>
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setOpenVariants((current) => {
                                const next = new Set(current);
                                if (!next.delete(product.id)) next.add(product.id);
                                return next;
                              })
                            }
                            aria-expanded={openVariants.has(product.id)}
                            aria-label={`View variants of ${product.name}`}
                          >
                            {openVariants.has(product.id) ? <ChevronDown /> : <ChevronRight />}
                            View variants
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
                    {openVariants.has(product.id) ? <VariantRows product={product} /> : null}
                    </Fragment>
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
    </div>
  );
}

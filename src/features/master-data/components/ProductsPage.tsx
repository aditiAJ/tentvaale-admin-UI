"use client";

import { useDeferredValue, useMemo, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  EyeOff,
  Layers,
  Package,
  Pencil,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import {
  listCategories,
  listProducts,
  masterDataKeys,
  setProductActive,
} from "@/features/master-data/api";
import type { ProductView } from "@/features/master-data/types";
import {
  activeFilterCount,
  applyFilters,
  EMPTY_FILTERS,
  ProductFilterPanel,
  type ProductFilters,
} from "@/features/master-data/components/ProductFilterPanel";
import { DEFAULT_SORT, SortSelect, sortItems, type SortKey } from "@/features/master-data/sorting";
import { ProductImageCarousel } from "@/features/master-data/components/ProductImageCarousel";
import { ProductVariantsDialog } from "@/features/master-data/components/ProductVariantsDialog";
import { ProductDialog } from "@/features/master-data/components/ProductDialog";
import { useCan } from "@/features/auth";
import { formatMoney } from "@/lib/money";
import { RATE_TYPE_LABEL } from "@/features/master-data/storefront";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

/** Where the filter panel sits beside the list (Tailwind's `lg`); narrower, it would sit above the list. */
const WIDE_SCREEN = "(min-width: 1024px)";

function subscribeToWidth(onChange: () => void) {
  const query = window.matchMedia(WIDE_SCREEN);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True on a wide screen. The server has no screen, so it assumes a wide one; the browser corrects it at once. */
function useWideScreen(): boolean {
  return useSyncExternalStore(
    subscribeToWidth,
    () => window.matchMedia(WIDE_SCREEN).matches,
    () => true,
  );
}

export function ProductsPage({
  initialCategoryId = "",
  initialSubCategoryId = "",
}: {
  /** Opens the list already filtered to a category, as linked from the Categories page. */
  initialCategoryId?: string;
  /** Or to one sub-category, which wins over its category. */
  initialSubCategoryId?: string;
} = {}) {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const [filters, setFilters] = useState<ProductFilters>(() => ({
    ...EMPTY_FILTERS,
    categoryIds: initialCategoryId && !initialSubCategoryId ? [initialCategoryId] : [],
    subCategoryIds: initialSubCategoryId ? [initialSubCategoryId] : [],
  }));
  // Open beside the list on a wide screen, closed on a phone or tablet, where the panel would sit above the products and
  // push them a long scroll down. Once the button is pressed, that choice holds whatever the width.
  const wideScreen = useWideScreen();
  const [filtersChoice, setFiltersChoice] = useState<boolean | null>(null);
  const showFilters = filtersChoice ?? wideScreen;
  const [sort, setSort] = useState<SortKey>(DEFAULT_SORT);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ProductView | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [switching, setSwitching] = useState<ProductView | null>(null);
  const [viewing, setViewing] = useState<ProductView | null>(null);
  const queryClient = useQueryClient();

  // The list is unpaged and filtered in the browser, so typing re-renders every
  // row. Deferring the term keeps the input responsive on a large catalogue;
  // when the backend grows a search parameter this moves server-side.
  const deferredFilters = useDeferredValue(filters);

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: [...masterDataKeys.products, showInactive ? "all" : "active"],
    queryFn: ({ signal }) =>
      listProducts(signal, { includeInactive: showInactive }),
  });

  // Why an active product is still not on the storefront: its sub-category or its category is switched off.
  const categories = useQuery({
    queryKey: masterDataKeys.categories,
    queryFn: ({ signal }) => listCategories(signal),
  });
  const hiddenReason = useMemo(() => {
    const reasons = new Map<string, string>();
    for (const category of categories.data ?? []) {
      for (const sub of category.subCategories) {
        if (!category.active) reasons.set(sub.id, `Its category, ${category.name}, is switched off`);
        else if (sub.active === false) reasons.set(sub.id, `Its sub-category, ${sub.name}, is switched off`);
      }
    }
    return reasons;
  }, [categories.data]);

  const visible = useMemo(
    () =>
      sortItems(applyFilters(data ?? [], deferredFilters), sort, {
        id: (product) => product.id,
        name: (product) => product.name,
        price: (product) => product.retailRate,
      }),
    [data, deferredFilters, sort],
  );
  const activeFilters = activeFilterCount(filters);
  // Four to a row when the panel is hidden or the screen is very wide; three beside the panel on a normal desktop.
  const gridCols = showFilters
    ? "sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
    : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

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
        <Button
          variant="outline"
          onClick={() => setFiltersChoice(!showFilters)}
          aria-expanded={showFilters}
          aria-controls="product-filters"
        >
          <SlidersHorizontal />
          {showFilters ? "Hide filters" : "Show filters"}
          {activeFilters > 0 ? (
            <span className="rounded-full bg-primary px-1.5 py-px text-[0.65rem] text-primary-foreground tabular">
              {activeFilters}
            </span>
          ) : null}
        </Button>
        <SortSelect value={sort} onChange={setSort} />
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
          {isPending
            ? "Loading…"
            : `${visible.length} of ${data?.length ?? 0} products`}
          {isFetching && !isPending ? " · refreshing" : ""}
        </p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {showFilters ? (
          <aside
            id="product-filters"
            aria-label="Product filters"
            // Stays in view below the top bar, and scrolls inside itself: the list of filters is longer than a screen,
            // and a sticky box taller than the screen would leave its lower filters out of reach.
            className="w-full shrink-0 lg:sticky lg:top-18 lg:max-h-[calc(100dvh-5.5rem)] lg:w-64 lg:overflow-y-auto lg:overscroll-contain lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden"
          >
            <ProductFilterPanel
              products={data ?? []}
              filters={filters}
              onChange={setFilters}
            />
          </aside>
        ) : null}

        <div className="min-w-0 flex-1 space-y-4">
          {isPending ? (
            <div className={`grid gap-4 ${gridCols}`} aria-busy="true">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-80" />
              ))}
            </div>
          ) : null}

          {!isPending && visible.length > 0 ? (
            // Cards in a row are stretched to the tallest one (no `items-start`), and each card is built from blocks of
            // a fixed size, so a product with less to say (no description, a short name) is no smaller than its neighbour.
            <div className={`grid gap-4 ${gridCols}`}>
              {visible.map((product) => {
                const inactive = product.active === false;
                const hiddenBy = !inactive && product.subCategoryId ? hiddenReason.get(product.subCategoryId) : undefined;
                return (
                  <article
                    key={product.id}
                    className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-colors hover:border-primary/50"
                  >
                    <ProductImageCarousel
                      media={product.media}
                      alt={product.name}
                      className={`border-b border-border ${inactive ? "opacity-50 grayscale" : ""}`}
                    />

                    <div className="flex flex-1 flex-col gap-1.5 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <Badge variant={inactive ? "default" : "outline"}>
                            {inactive ? "Inactive" : "Active"}
                          </Badge>
                          {hiddenBy ? (
                            <span
                              className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[0.7rem] font-medium text-amber-700 dark:text-amber-400"
                              title={`${hiddenBy}, so customers cannot see this product. Switch it on in Categories.`}
                            >
                              <EyeOff className="size-3" aria-hidden="true" />
                              Not on storefront
                            </span>
                          ) : null}
                        </span>
                        <span className="min-w-0 text-right">
                          <span className="block truncate font-mono text-xs">
                            {product.sku}
                          </span>
                          <span className="block truncate text-[0.7rem] text-muted-foreground">
                            {product.skuOwner}
                          </span>
                        </span>
                      </div>

                      {/* Two lines are always reserved for the name, so one-line and two-line names line up. */}
                      <h3
                        title={product.name}
                        className="mt-1 line-clamp-2 min-h-11 text-base leading-snug font-semibold"
                      >
                        {product.name}
                      </h3>

                      <p className="truncate text-xs text-muted-foreground">
                        {product.categoryName
                          ? [product.categoryName, product.subCategoryName]
                              .filter(Boolean)
                              .join(" · ")
                          : "Uncategorised"}
                      </p>

                      {/* Two lines are reserved here too, filled or not. */}
                      <p className="line-clamp-2 min-h-8 text-xs text-muted-foreground">
                        {[product.genericName, product.description]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>

                      <div className="mt-auto pt-2">
                        <p className="text-xs text-muted-foreground">
                          Retail rate
                          {/* Per unit is the norm and goes unsaid; the others change what a quantity means. */}
                          {product.rateType && product.rateType !== "Qty"
                            ? ` · ${RATE_TYPE_LABEL[product.rateType]}`
                            : ""}
                        </p>
                        <p className="text-lg font-semibold text-primary tabular">
                          {formatMoney(product.retailRate)}
                        </p>
                        <p className="text-xs text-muted-foreground tabular">
                          Wholesale {formatMoney(product.wholesaleRate)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-1 border-t border-border px-2 py-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewing(product)}
                        aria-haspopup="dialog"
                        aria-label={`View variants of ${product.name}`}
                      >
                        <Layers />
                        View variants
                      </Button>
                      <div className="flex gap-1">
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
                            aria-label={`${inactive ? "Activate" : "Deactivate"} ${product.name}`}
                            title={inactive ? "Activate" : "Deactivate"}
                          >
                            {inactive ? <Eye /> : <EyeOff />}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}

          <Card>
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
                title={
                  data?.length
                    ? "No products match those filters"
                    : "No products yet"
                }
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
        </div>
      </div>

      {viewing ? (
        <ProductVariantsDialog
          product={viewing}
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
      {creating ? <ProductDialog onClose={() => setCreating(false)} /> : null}
      {editing ? (
        <ProductDialog existing={editing} onClose={() => setEditing(null)} />
      ) : null}
      {switching ? (
        <ConfirmDialog
          title={`${switching.active === false ? "Activate" : "Deactivate"} ${switching.name}?`}
          description={
            switching.active === false
              ? "It returns to the product pickers and the storefront."
              : "It stays on record, with its variants and stock, but leaves the product pickers and the storefront. Existing quotations and orders keep it."
          }
          confirmLabel={
            switching.active === false
              ? "Activate product"
              : "Deactivate product"
          }
          destructive={switching.active !== false}
          fallbackError="Could not change the product."
          action={() =>
            setProductActive(switching.id, switching.active === false)
          }
          onDone={() => {
            queryClient.invalidateQueries({
              queryKey: masterDataKeys.products,
            });
            setSwitching(null);
          }}
          onClose={() => setSwitching(null)}
        />
      ) : null}
    </div>
  );
}

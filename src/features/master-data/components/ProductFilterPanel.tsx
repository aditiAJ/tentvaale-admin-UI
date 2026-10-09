"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import type { ProductView } from "@/features/master-data/types";
import { cn } from "@/lib/utils";

/**
 * The admin catalogue's filters, the same groups the storefront offers: categories with their sub-categories, the
 * facets (colour, fabric, indoor/outdoor, material, mood, theme) and the price bands. Everything is worked out from
 * the products in hand, so only values that really occur are listed, each with how many products it would show.
 * Ticking several values in one group shows products matching any of them; different groups all have to match.
 */

export const FACET_GROUPS = [
  { key: "colour", label: "Colour", values: (p: ProductView) => p.colours ?? [] },
  { key: "fabric", label: "Fabric", values: (p: ProductView) => p.fabrics ?? [] },
  { key: "setting", label: "Indoor / outdoor", values: (p: ProductView) => (p.setting ? [p.setting] : []) },
  { key: "material", label: "Material", values: (p: ProductView) => p.materials ?? [] },
  { key: "mood", label: "Mood", values: (p: ProductView) => p.moods ?? [] },
  { key: "theme", label: "Theme", values: (p: ProductView) => p.themes ?? [] },
] as const;

export type FacetKey = (typeof FACET_GROUPS)[number]["key"];

/** The storefront's bands, applied to the retail rate. Upper ends stop a paisa short of the next band. */
export const PRICE_BANDS = [
  { id: "under-500", label: "Under ₹500", min: 0, max: 499.99 },
  { id: "500-2999", label: "₹500 – ₹2,999", min: 500, max: 2999.99 },
  { id: "3000-9999", label: "₹3,000 – ₹9,999", min: 3000, max: 9999.99 },
  { id: "10000-up", label: "₹10,000 and above", min: 10000, max: Infinity },
] as const;

export interface ProductFilters {
  query: string;
  categoryIds: string[];
  subCategoryIds: string[];
  facets: Record<FacetKey, string[]>;
  bands: string[];
}

export const EMPTY_FILTERS: ProductFilters = {
  query: "",
  categoryIds: [],
  subCategoryIds: [],
  facets: { colour: [], fabric: [], setting: [], material: [], mood: [], theme: [] },
  bands: [],
};

/** How many choices are active, not counting the search box. */
export function activeFilterCount(filters: ProductFilters): number {
  return (
    filters.categoryIds.length +
    filters.subCategoryIds.length +
    filters.bands.length +
    FACET_GROUPS.reduce((sum, group) => sum + filters.facets[group.key].length, 0)
  );
}

function matchesQuery(product: ProductView, term: string): boolean {
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

function retailAmount(product: ProductView): number {
  const amount = product.retailRate.amount;
  return typeof amount === "string" ? Number(amount) : amount;
}

/** Whether a product passes every group of the filters except `skip` (used to count what a group would offer). */
function passes(product: ProductView, filters: ProductFilters, skip?: "categories" | "bands" | FacetKey): boolean {
  const term = filters.query.trim().toLowerCase();
  if (term && !matchesQuery(product, term)) return false;

  if (skip !== "categories" && (filters.categoryIds.length > 0 || filters.subCategoryIds.length > 0)) {
    const inCategory = product.categoryId !== null && filters.categoryIds.includes(product.categoryId);
    const inSub = product.subCategoryId !== null && filters.subCategoryIds.includes(product.subCategoryId);
    if (!inCategory && !inSub) return false;
  }

  for (const group of FACET_GROUPS) {
    const chosen = filters.facets[group.key];
    if (skip === group.key || chosen.length === 0) continue;
    const have = group.values(product).map((value) => value.toLowerCase());
    if (!chosen.some((value) => have.includes(value.toLowerCase()))) return false;
  }

  if (skip !== "bands" && filters.bands.length > 0) {
    const amount = retailAmount(product);
    const inBand = PRICE_BANDS.some((band) => filters.bands.includes(band.id) && amount >= band.min && amount <= band.max);
    if (!inBand) return false;
  }
  return true;
}

export function applyFilters(products: ProductView[], filters: ProductFilters): ProductView[] {
  return products.filter((product) => passes(product, filters));
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function Group({
  title,
  selected = 0,
  defaultOpen = false,
  children,
}: {
  title: string;
  selected?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-border py-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded text-left text-[0.7rem] font-semibold tracking-wider uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex items-center gap-2">
          {title}
          {selected > 0 ? (
            <span className="rounded-full bg-primary px-1.5 py-px text-[0.65rem] text-primary-foreground tabular">
              {selected}
            </span>
          ) : null}
        </span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", !open && "-rotate-90")} />
      </button>
      {open ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}

function CheckRow({
  label,
  count,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex items-center justify-between gap-2 rounded-md px-1.5 py-1.5 text-sm transition-colors",
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:bg-muted",
        checked && "font-medium text-primary",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          className="size-4 shrink-0 accent-primary"
        />
        <span className="truncate">{label}</span>
      </span>
      {count !== undefined ? <span className="text-[0.7rem] text-muted-foreground tabular">{count}</span> : null}
    </label>
  );
}

const SHOWN_AT_FIRST = 6;

function FacetList({
  options,
  selected,
  onToggle,
}: {
  options: { value: string; count: number }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [all, setAll] = useState(false);
  // A ticked value stays visible even when it falls beyond the first few.
  const visible = all
    ? options
    : options.filter((option, index) => index < SHOWN_AT_FIRST || selected.includes(option.value));
  const hidden = options.length - visible.length;
  return (
    <div>
      {visible.map((option) => (
        <CheckRow
          key={option.value}
          label={option.value}
          count={option.count}
          checked={selected.includes(option.value)}
          disabled={option.count === 0 && !selected.includes(option.value)}
          onChange={() => onToggle(option.value)}
        />
      ))}
      {hidden > 0 || (all && options.length > SHOWN_AT_FIRST) ? (
        <button
          type="button"
          onClick={() => setAll((value) => !value)}
          className="mt-1 rounded px-1.5 text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {all ? "Show less" : `Show ${hidden} more`}
        </button>
      ) : null}
    </div>
  );
}

export function ProductFilterPanel({
  products,
  filters,
  onChange,
}: {
  /** Every product in play (before filtering), so the counts and the lists come from the whole catalogue. */
  products: ProductView[];
  filters: ProductFilters;
  onChange: (filters: ProductFilters) => void;
}) {
  const [expanded, setExpanded] = useState<string[]>([]);
  const active = activeFilterCount(filters);

  // Category tree: each category with its sub-categories, counted against the other groups' choices.
  const categories = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; count: number; subs: Map<string, { id: string; name: string; count: number }> }>();
    for (const product of products) {
      if (!product.categoryId) continue;
      const entry =
        byId.get(product.categoryId) ??
        { id: product.categoryId, name: product.categoryName ?? product.categoryId, count: 0, subs: new Map() };
      if (passes(product, filters, "categories")) {
        entry.count += 1;
        if (product.subCategoryId) {
          const sub = entry.subs.get(product.subCategoryId) ?? {
            id: product.subCategoryId,
            name: product.subCategoryName ?? product.subCategoryId,
            count: 0,
          };
          sub.count += 1;
          entry.subs.set(sub.id, sub);
        }
      } else if (product.subCategoryId && !entry.subs.has(product.subCategoryId)) {
        entry.subs.set(product.subCategoryId, {
          id: product.subCategoryId,
          name: product.subCategoryName ?? product.subCategoryId,
          count: 0,
        });
      }
      byId.set(entry.id, entry);
    }
    return [...byId.values()]
      .map((entry) => ({ ...entry, subs: [...entry.subs.values()].sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, filters]);

  const facetOptions = useMemo(() => {
    return FACET_GROUPS.map((group) => {
      const counts = new Map<string, number>();
      for (const product of products) {
        const matching = passes(product, filters, group.key);
        for (const value of new Set(group.values(product))) {
          counts.set(value, (counts.get(value) ?? 0) + (matching ? 1 : 0));
        }
      }
      const options = [...counts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value));
      return { ...group, options };
    }).filter((group) => group.options.length > 0);
  }, [products, filters]);

  const bandCounts = useMemo(
    () =>
      PRICE_BANDS.map((band) => ({
        band,
        count: products.filter((product) => {
          if (!passes(product, filters, "bands")) return false;
          const amount = retailAmount(product);
          return amount >= band.min && amount <= band.max;
        }).length,
      })),
    [products, filters],
  );

  const set = (patch: Partial<ProductFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="size-4 text-primary" />
          Filters
        </h2>
        {active > 0 ? (
          <button
            type="button"
            onClick={() => onChange({ ...EMPTY_FILTERS, query: filters.query })}
            className="rounded text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={filters.query}
          onChange={(event) => set({ query: event.target.value })}
          placeholder="Search SKU, name, category or colour"
          aria-label="Search products"
          className="h-9 w-full rounded-md border border-border bg-background pr-3 pl-8 text-sm outline-none transition-colors hover:border-primary/40 focus:border-primary focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </div>

      {categories.length > 0 ? (
        <Group title="Categories" selected={filters.categoryIds.length + filters.subCategoryIds.length} defaultOpen>
          <ul>
            {categories.map((category) => {
              const on = filters.categoryIds.includes(category.id);
              const open = on || expanded.includes(category.id) || category.subs.some((sub) => filters.subCategoryIds.includes(sub.id));
              return (
                <li key={category.id}>
                  <div className="flex items-center">
                    {category.subs.length > 0 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((list) => (open ? list.filter((id) => id !== category.id) : [...list, category.id]))
                        }
                        aria-expanded={open}
                        aria-label={`${open ? "Collapse" : "Expand"} ${category.name}`}
                        className="flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
                      </button>
                    ) : (
                      <span className="size-7 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <CheckRow
                        label={category.name}
                        count={category.count}
                        checked={on}
                        onChange={() => set({ categoryIds: toggle(filters.categoryIds, category.id) })}
                      />
                    </div>
                  </div>
                  {open && category.subs.length > 0 ? (
                    <ul className="mb-1 ml-3.5 border-l border-border pl-2">
                      {category.subs.map((sub) => (
                        <li key={sub.id}>
                          <CheckRow
                            label={sub.name}
                            count={sub.count}
                            checked={filters.subCategoryIds.includes(sub.id)}
                            disabled={sub.count === 0 && !filters.subCategoryIds.includes(sub.id)}
                            onChange={() => set({ subCategoryIds: toggle(filters.subCategoryIds, sub.id) })}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Group>
      ) : null}

      {facetOptions.map((group) => (
        <Group
          key={group.key}
          title={group.label}
          selected={filters.facets[group.key].length}
          defaultOpen={group.key === "colour" || filters.facets[group.key].length > 0}
        >
          <FacetList
            options={group.options}
            selected={filters.facets[group.key]}
            onToggle={(value) => set({ facets: { ...filters.facets, [group.key]: toggle(filters.facets[group.key], value) } })}
          />
        </Group>
      ))}

      <Group title="Price band" selected={filters.bands.length} defaultOpen>
        {bandCounts.map(({ band, count }) => (
          <CheckRow
            key={band.id}
            label={band.label}
            count={count}
            checked={filters.bands.includes(band.id)}
            disabled={count === 0 && !filters.bands.includes(band.id)}
            onChange={() => set({ bands: toggle(filters.bands, band.id) })}
          />
        ))}
      </Group>
    </div>
  );
}

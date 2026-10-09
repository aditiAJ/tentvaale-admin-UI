"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Eye, EyeOff, Layers, Plus } from "lucide-react";
import type { CategoryView, MediaAsset } from "@/features/master-data/types";
import { MediaThumb } from "@/features/master-data/components/MediaThumb";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** How many sub-categories a card lists before folding the rest into "+N more". */
const PREVIEW_COUNT = 4;

/** What the products list says about a category: how many products, and a picture borrowed from them. */
export interface CategoryCounts {
  total: number;
  bySub: Map<string, number>;
  /** A product's picture from this category, used when the category has none of its own. */
  media?: MediaAsset[];
  /** A product's picture per sub-category: sub-categories carry no media of their own. */
  subMedia: Map<string, MediaAsset[] | undefined>;
}

export const NO_COUNTS: CategoryCounts = { total: 0, bySub: new Map(), subMedia: new Map() };

/**
 * One category and its sub-categories, as a card (cover picture, then each sub-category as a row) or, in the list
 * layout, as a single compact row. Sub-categories are listed inside the card rather than given cards of their own,
 * because they are edited through their category and only mean something under it. A row, like the category's name,
 * opens the Products page filtered to it.
 *
 * `term` is the active search, already lower-cased. Sub-categories it matches are listed first and marked, so a card
 * kept in view by a sub-category match shows why it is there without being expanded.
 */
export function CategoryCard({
  category,
  term,
  layout = "grid",
  counts,
  canViewProducts = true,
  onEdit,
  onDeactivate,
  onActivate,
}: {
  category: CategoryView;
  term: string;
  layout?: "grid" | "list";
  /** Absent while loading or for a role that cannot read products. */
  counts?: CategoryCounts | null;
  /** Whether the Products page can be opened from here. */
  canViewProducts?: boolean;
  /** Absent for a user who cannot write master data. */
  onEdit?: () => void;
  onDeactivate?: () => void;
  /** Offered instead of Deactivate on an inactive category. */
  onActivate?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const matches = (name: string) => term !== "" && name.toLowerCase().includes(term);
  const subCategories = term
    ? [
        ...category.subCategories.filter((sub) => matches(sub.name)),
        ...category.subCategories.filter((sub) => !matches(sub.name)),
      ]
    : category.subCategories;
  const count = subCategories.length;
  const shown = expanded || layout === "list" ? subCategories : subCategories.slice(0, PREVIEW_COUNT);
  const hidden = count - shown.length;

  const productsHref = (sub?: string) =>
    `/master-data/products?category=${encodeURIComponent(category.id)}${sub ? `&sub=${encodeURIComponent(sub)}` : ""}`;
  const cover = category.media.length > 0 ? category.media : counts?.media;

  const meta = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground tabular">
      {counts ? (
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-foreground">
          {counts.total} {counts.total === 1 ? "product" : "products"}
        </span>
      ) : null}
      {category.skuPrefix ? (
        <span className="rounded-md border border-border px-1.5 py-0.5 font-mono" title="SKU code">
          {category.skuPrefix}
        </span>
      ) : null}
    </div>
  );

  const title = canViewProducts ? (
    <Link
      href={productsHref()}
      className="rounded-sm outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50"
      title={`View products in ${category.name}`}
    >
      {category.name}
    </Link>
  ) : (
    category.name
  );

  const actions =
    onEdit || onDeactivate || onActivate ? (
      <>
        {onDeactivate ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={onDeactivate}
            aria-label={`Deactivate ${category.name}`}
          >
            <EyeOff />
            Deactivate
          </Button>
        ) : onActivate ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={onActivate}
            aria-label={`Activate ${category.name}`}
          >
            <Eye />
            Activate
          </Button>
        ) : (
          <span />
        )}
        {onEdit ? (
          <Button variant="outline" size="sm" onClick={onEdit} aria-label={`Edit ${category.name}`}>
            Edit
            <ChevronRight />
          </Button>
        ) : null}
      </>
    ) : null;

  const surface = cn(
    "min-w-0 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-md",
    !category.active && "opacity-70",
  );

  if (layout === "list") {
    return (
      <article className={cn(surface, "flex flex-col gap-3 p-3 sm:flex-row sm:items-center")}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <MediaThumb media={cover} className="size-14 shrink-0 rounded-lg" />
          <div className="min-w-0 space-y-1">
            <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold wrap-break-word">
              {title}
              {!category.active ? <Badge>Inactive</Badge> : null}
            </h3>
            {meta}
          </div>
        </div>

        <ul
          className="flex min-w-0 flex-wrap gap-1.5 sm:max-w-[45%] sm:flex-1"
          aria-label={`Sub-categories of ${category.name}`}
        >
          {count === 0 ? (
            <li className="text-xs text-muted-foreground">No sub-categories</li>
          ) : (
            shown.map((sub) => (
              <li key={sub.id}>
                <SubChip
                  href={canViewProducts ? productsHref(sub.id) : undefined}
                  name={sub.name}
                  count={counts?.bySub.get(sub.id)}
                  highlight={matches(sub.name)}
                />
              </li>
            ))
          )}
        </ul>

        {actions ? <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">{actions}</div> : null}
      </article>
    );
  }

  return (
    <article className={cn(surface, "flex flex-col")}>
      <div className="relative">
        <MediaThumb media={cover} className="aspect-video h-auto w-full rounded-none border-0 border-b" />
        <div className="pointer-events-none absolute right-3 bottom-3 left-3 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-1.5 text-xs font-medium text-white tabular backdrop-blur-sm">
            <Layers className="size-3.5" aria-hidden="true" />
            {count} sub-{count === 1 ? "category" : "categories"}
          </span>
          {!category.active ? <Badge className="bg-card/90">Inactive</Badge> : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0 space-y-1.5">
          <h3 className="line-clamp-2 text-lg font-semibold wrap-break-word" title={category.name}>
            {title}
          </h3>
          {meta}
        </div>

        {count === 0 ? (
          onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground transition-colors outline-none hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Add sub-categories
            </button>
          ) : (
            <p className="text-xs text-muted-foreground">No sub-categories.</p>
          )
        ) : (
          <ul className="space-y-2" aria-label={`Sub-categories of ${category.name}`}>
            {shown.map((sub) => (
              <li key={sub.id}>
                <SubRow
                  href={canViewProducts ? productsHref(sub.id) : undefined}
                  name={sub.name}
                  count={counts?.bySub.get(sub.id) ?? (counts ? 0 : undefined)}
                  media={counts?.subMedia.get(sub.id)}
                  highlight={matches(sub.name)}
                />
              </li>
            ))}
            {hidden > 0 || expanded ? (
              <li>
                <button
                  type="button"
                  onClick={() => setExpanded((value) => !value)}
                  className="rounded-sm text-xs font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                  aria-expanded={expanded}
                >
                  {expanded ? "Show fewer" : `+${hidden} more`}
                </button>
              </li>
            ) : null}
          </ul>
        )}
      </div>

      {actions ? (
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2.5">{actions}</div>
      ) : null}
    </article>
  );
}

/** A sub-category as a bordered row with a picture, its product count and a chevron into its products. */
function SubRow({
  href,
  name,
  count,
  media,
  highlight,
}: {
  href?: string;
  name: string;
  count?: number;
  media?: MediaAsset[];
  highlight: boolean;
}) {
  const body = (
    <>
      <MediaThumb media={media} className="size-10 rounded-md" />
      <span className={cn("min-w-0 flex-1 truncate text-sm", highlight ? "font-medium text-primary" : "font-medium")}>
        {name}
      </span>
      {count !== undefined ? (
        <span className="shrink-0 text-xs text-muted-foreground tabular">
          {count} {count === 1 ? "product" : "products"}
        </span>
      ) : null}
      {href ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
    </>
  );
  const row = "flex items-center gap-3 rounded-lg border border-border bg-background px-2.5 py-2";
  return href ? (
    <Link
      href={href}
      title={`View ${name} products`}
      className={cn(row, "outline-none transition-colors hover:border-primary/40 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50")}
    >
      {body}
    </Link>
  ) : (
    <div className={row}>{body}</div>
  );
}

/** A sub-category as a pill, for the compact list layout. */
function SubChip({
  href,
  name,
  count,
  highlight,
}: {
  href?: string;
  name: string;
  count?: number;
  highlight: boolean;
}) {
  const chip = cn(
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
    highlight ? "border-primary/50 font-medium text-primary" : "border-border text-muted-foreground",
  );
  const body = (
    <>
      {name}
      {count !== undefined ? <span className="tabular opacity-70">{count}</span> : null}
    </>
  );
  return href ? (
    <Link href={href} className={cn(chip, "outline-none hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50")}>
      {body}
    </Link>
  ) : (
    <span className={chip}>{body}</span>
  );
}

"use client";

import { useState } from "react";
import { ChevronRight, EyeOff, FolderTree, Plus } from "lucide-react";
import type { CategoryView } from "@/features/master-data/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** How many sub-categories a card lists before folding the rest into "+N more". */
const PREVIEW_COUNT = 4;

/**
 * One category and its sub-categories. Sub-categories are listed inside the
 * card rather than given cards of their own, because they are edited through
 * their category and only mean something under it.
 *
 * `term` is the active search, already lower-cased. Sub-categories it matches
 * are listed first and marked, so a card kept in view by a sub-category match
 * shows why it is there without being expanded.
 */
export function CategoryCard({
  category,
  term,
  onEdit,
  onDeactivate,
}: {
  category: CategoryView;
  term: string;
  /** Absent for a user who cannot write master data. */
  onEdit?: () => void;
  onDeactivate?: () => void;
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
  const shown = expanded ? subCategories : subCategories.slice(0, PREVIEW_COUNT);
  const hidden = count - shown.length;

  return (
    <Card
      className={cn(
        "flex min-w-0 flex-col transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-sm",
        !category.active && "opacity-70",
      )}
    >
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            aria-hidden="true"
          >
            <FolderTree className="size-5" />
          </span>
          {!category.active ? <Badge>Inactive</Badge> : null}
        </div>

        <div className="min-w-0 space-y-1">
          <h3
            className="line-clamp-2 text-base font-semibold wrap-break-word"
            title={category.name}
          >
            {category.name}
          </h3>
          <p className="text-xs text-muted-foreground tabular">
            {count} sub-{count === 1 ? "category" : "categories"}
          </p>
        </div>

        {count === 0 ? (
          onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground transition-colors outline-none hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Add sub-categories
            </button>
          ) : null
        ) : (
          <ul className="space-y-1.5 border-l border-border pl-3" aria-label={`Sub-categories of ${category.name}`}>
            {shown.map((sub) => (
              <li
                key={sub.id}
                className={cn(
                  "truncate text-sm",
                  matches(sub.name) ? "font-medium text-primary" : "text-muted-foreground",
                )}
                title={sub.name}
              >
                {sub.name}
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

      {onEdit || onDeactivate ? (
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
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
          ) : (
            <span />
          )}
          {onEdit ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              aria-label={`Edit ${category.name}`}
            >
              Edit
              <ChevronRight />
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

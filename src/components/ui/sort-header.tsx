"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TH } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface SortState<K extends string> {
  key: K;
  descending: boolean;
}

/** The state after a header is pressed: a new column sorts ascending, the same column flips direction. */
export function nextSort<K extends string>(current: SortState<K>, key: K): SortState<K> {
  return { key, descending: current.key === key ? !current.descending : false };
}

/**
 * A table heading that sorts by its column when pressed, and says which way it is sorted (`aria-sort` for screen
 * readers, an arrow for everyone else). Put `text-right` in `className` for a numeric column.
 */
export function SortHeader<K extends string>({
  label,
  column,
  sort,
  onSort,
  className,
}: {
  label: string;
  column: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  className?: string;
}) {
  const active = sort.key === column;
  const Icon = !active ? ArrowUpDown : sort.descending ? ArrowDown : ArrowUp;
  return (
    <TH className={className} aria-sort={!active ? "none" : sort.descending ? "descending" : "ascending"}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex items-center gap-1 uppercase tracking-wide outline-none hover:text-foreground focus-visible:text-foreground",
          active && "text-foreground",
          className?.includes("text-right") && "flex-row-reverse",
        )}
      >
        {label}
        <Icon className="size-3" aria-hidden="true" />
      </button>
    </TH>
  );
}

"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";

export const PAGE_SIZES = [10, 25, 50] as const;

/** How many pages `total` rows make at `pageSize` per page. Never less than one, so an empty list is page 1 of 1. */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** The rows of one page. `page` counts from 1 and is held inside the real range, so a shrinking list cannot strand it. */
export function paginate<T>(rows: readonly T[], page: number, pageSize: number): T[] {
  const current = Math.min(Math.max(1, page), pageCount(rows.length, pageSize));
  return rows.slice((current - 1) * pageSize, current * pageSize);
}

/**
 * "Showing 11–20 of 42", previous and next, and a rows-per-page choice. Draws nothing while everything fits on the
 * smallest page, so a short list is not cluttered by controls it cannot use.
 *
 * Paging is done in the browser over the full list (like the search on these pages), so `page` and `pageSize` are the
 * caller's to keep, and the caller sends the page back to 1 when the search or a filter changes.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  noun = "rows",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  /** What is being counted, for "of 42 suppliers". */
  noun?: string;
}) {
  if (total <= PAGE_SIZES[0]) return null;

  const pages = pageCount(total, pageSize);
  const current = Math.min(Math.max(1, page), pages);
  const first = (current - 1) * pageSize + 1;
  const last = Math.min(current * pageSize, total);

  return (
    <nav
      aria-label={`Pages of ${noun}`}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2.5 text-xs text-muted-foreground"
    >
      <p className="tabular" aria-live="polite">
        Showing {first}–{last} of {total} {noun}
      </p>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5">
          Rows per page
          <Select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            aria-label="Rows per page"
            className="h-8 w-[4.5rem]"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </label>
        <span className="tabular">
          Page {current} of {pages}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous page"
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next page"
          disabled={current >= pages}
          onClick={() => onPageChange(current + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}

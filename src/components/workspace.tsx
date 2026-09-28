"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The record workspace the quotation, order and credit-note screens share: a
 * status-filter sidebar beside a searchable list, or one record opened from
 * it. The filter and the open record both live in the URL (`?status=`,
 * `?id=`), so every view can be linked to, reloaded and stepped back out of.
 *
 * Only the shell is shared. What a row or a detail shows is each feature's own.
 */

/** One entry in the sidebar. `key` is the `?status=` value; "" is "all". */
export interface WorkspaceFilter {
  key: string;
  label: string;
  /** The record status it narrows to; absent for "all". */
  status?: string;
}

/** The workspace URL for a filter, optionally with a record open in it. */
export function workspaceHref(base: string, filterKey: string, id?: string): string {
  const params = new URLSearchParams();
  if (filterKey) params.set("status", filterKey);
  if (id) params.set("id", id);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

/**
 * The sidebar and the pane beside it. `counts` is per status and `total` is the
 * whole list; both are left out until the list has loaded, so the sidebar shows
 * no numbers rather than zeros.
 */
export function WorkspaceLayout({
  navLabel,
  heading,
  filters,
  activeKey,
  counts,
  total,
  hrefFor,
  children,
}: {
  /** The nav landmark's name, e.g. "Order filters". */
  navLabel: string;
  /** The small caps heading over the filters on a wide screen. */
  heading: string;
  filters: readonly WorkspaceFilter[];
  activeKey: string;
  counts?: ReadonlyMap<string, number>;
  total?: number;
  hrefFor: (filterKey: string) => string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
      <nav aria-label={navLabel} className="md:sticky md:top-4 md:w-52 md:shrink-0">
        <p className="mb-1 hidden px-2 text-[0.65rem] font-semibold tracking-wider text-muted-foreground uppercase md:block">
          {heading}
        </p>
        {/* A row of tabs on a narrow screen, a column beside the list on a wide one. */}
        <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0">
          {filters.map((option) => {
            const active = option.key === activeKey;
            const count = option.status ? (counts?.get(option.status) ?? 0) : total;
            return (
              <li key={option.key} className="shrink-0">
                <Link
                  href={hrefFor(option.key)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors",
                    active
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  {option.label}
                  {counts && total !== undefined ? (
                    <span
                      className={cn(
                        "tabular text-xs",
                        active ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {count}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0 flex-1 space-y-4">{children}</div>
    </div>
  );
}

/** The list's search box, with a clear button and an optional "n of m" line beside it. */
export function WorkspaceSearch({
  value,
  onChange,
  placeholder,
  label,
  summary,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** The accessible name, saying what the search matches. */
  label: string;
  /** Announced politely as it changes; omitted until the list has loaded. */
  summary?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="relative w-full sm:max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-10 pr-9 pl-9"
          aria-label={label}
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label="Clear search"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
      {summary !== undefined ? (
        <p className="text-xs text-muted-foreground tabular" aria-live="polite">
          {summary}
        </p>
      ) : null}
    </div>
  );
}

/** The list's loading state: a few placeholder rows. */
export function WorkspaceListSkeleton() {
  return (
    <Card className="divide-y divide-border">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="space-y-2 px-4 py-3.5">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </Card>
  );
}

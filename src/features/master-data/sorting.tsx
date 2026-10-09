"use client";

import { ArrowUpDown } from "lucide-react";
import { Select } from "@/components/ui/input";
import type { Money } from "@/lib/money";

/** How the catalogue lists (products, bundles) can be ordered, as the storefront offers it plus oldest and Z–A. */
export type SortKey = "name-asc" | "name-desc" | "newest" | "oldest" | "price-asc" | "price-desc";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

/** The backend lists by name already, so A–Z is the order a list arrives in. */
export const DEFAULT_SORT: SortKey = "name-asc";

/**
 * Records carry no created date, but ids are handed out in order, so a higher id is a newer record. Takes the number
 * from the id (a plain "42", or "p-42" in the demo data); an id with none ranks as oldest.
 */
function idRank(id: string): number {
  const digits = /(\d+)$/.exec(id);
  return digits ? Number(digits[1]) : 0;
}

function amount(money: Money | null | undefined): number {
  if (!money) return 0;
  const value = typeof money.amount === "string" ? Number(money.amount) : money.amount;
  return Number.isFinite(value) ? value : 0;
}

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });

/** A sorted copy; the list it was given is left alone. Ties fall back to name so the order is stable. */
export function sortItems<T>(
  items: T[],
  key: SortKey,
  get: { id: (item: T) => string; name: (item: T) => string; price: (item: T) => Money | null | undefined },
): T[] {
  const compare: Record<SortKey, (a: T, b: T) => number> = {
    "name-asc": (a, b) => byName(get.name(a), get.name(b)),
    "name-desc": (a, b) => byName(get.name(b), get.name(a)),
    newest: (a, b) => idRank(get.id(b)) - idRank(get.id(a)),
    oldest: (a, b) => idRank(get.id(a)) - idRank(get.id(b)),
    "price-asc": (a, b) => amount(get.price(a)) - amount(get.price(b)),
    "price-desc": (a, b) => amount(get.price(b)) - amount(get.price(a)),
  };
  return [...items].sort((a, b) => compare[key](a, b) || byName(get.name(a), get.name(b)));
}

/** A native select, so phones get their own picker. */
export function SortSelect({ value, onChange }: { value: SortKey; onChange: (value: SortKey) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-sm">
      <ArrowUpDown className="size-4 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only sm:not-sr-only sm:text-muted-foreground">Sort</span>
      <Select
        value={value}
        onChange={(event) => onChange(event.target.value as SortKey)}
        aria-label="Sort by"
        className="h-9 w-auto min-w-40"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

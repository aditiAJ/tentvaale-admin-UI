"use client";

import { X } from "lucide-react";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { INDIAN_STATES, matchState } from "@/lib/indian-states";

/** All 36, A to Z. Typing narrows by name, abbreviation (GJ) or GST code (24). */
const OPTIONS: readonly SearchSelectOption[] = [...INDIAN_STATES]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((s) => ({
    value: s.name,
    label: s.name,
    hint: s.abbreviation,
    keywords: `${s.abbreviation} ${s.gstCode}`,
  }));

/**
 * What a form should start with for a saved value: the canonical name when it is a known state in any spelling
 * ("gj", "Orissa"), the value as it was when it is not (so it can be shown and corrected, never silently dropped), and
 * empty when there is none.
 */
export function initialState(saved: string | null | undefined): string {
  return matchState(saved)?.name ?? saved?.trim() ?? "";
}

/**
 * The one place a State or Union Territory is chosen: a searchable list of the 36, built on {@link SearchSelect}
 * (which draws its list on the page itself, so a dialog cannot clip it).
 *
 * `value` is what the form holds: a canonical name, empty, or an old value nobody can read. An old value is not shown
 * as an empty box: a note says what was saved, so the person can pick the right state, or clear it when the field is
 * optional. Nothing is wiped without being seen.
 */
export function StateSelect({
  id,
  value,
  onChange,
  clearable = false,
  disabled,
  ...aria
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** Optional fields can be emptied; required ones cannot. */
  clearable?: boolean;
  disabled?: boolean;
  "aria-invalid"?: boolean;
}) {
  const saved = value.trim();
  const matched = matchState(saved);
  const unreadable = saved !== "" && !matched;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <SearchSelect
          id={id}
          className="min-w-0 flex-1"
          value={matched?.name ?? ""}
          onChange={onChange}
          options={OPTIONS}
          placeholder="Select State"
          disabled={disabled}
          aria-invalid={aria["aria-invalid"] || unreadable}
        />
        {clearable && saved && !disabled ? (
          <button
            type="button"
            aria-label="Clear state"
            title="Clear state"
            onClick={() => onChange("")}
            className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
      {unreadable ? (
        <p role="note" className="text-xs text-amber-700 dark:text-amber-400">
          Previously saved: “{saved}”. Please select the correct state{clearable ? " or clear it" : ""}.
        </p>
      ) : null}
    </div>
  );
}

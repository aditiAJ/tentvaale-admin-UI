"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A short list of words — colours, materials, occasions — edited as chips.
 * Enter or a comma adds what is typed, Backspace in an empty box takes the last
 * one back, and leaving the box keeps anything still typed rather than losing
 * it. `suggestions` are offered as the admin types; anything else is kept too.
 * A repeat that differs only in case is not added twice.
 */
export function TagInput({
  id,
  value,
  onChange,
  suggestions = [],
  placeholder,
  disabled,
  ...aria
}: {
  id?: string;
  value: string[];
  onChange: (value: string[]) => void;
  suggestions?: readonly string[];
  placeholder?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-label"?: string;
}) {
  const listId = useId();
  const [draft, setDraft] = useState("");

  const has = (item: string) => value.some((kept) => kept.toLowerCase() === item.toLowerCase());

  const commit = (text: string) => {
    const items = text
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const added: string[] = [];
    for (const item of items) {
      if (!has(item) && !added.some((kept) => kept.toLowerCase() === item.toLowerCase())) {
        added.push(item);
      }
    }
    if (added.length) onChange([...value, ...added]);
    setDraft("");
  };

  const offered = suggestions.filter((item) => !has(item));

  return (
    <div
      className={cn(
        "flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-border bg-input px-1.5 py-1 text-sm transition-colors",
        "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
        aria["aria-invalid"] && "border-destructive ring-2 ring-destructive/20",
        disabled && "opacity-60",
      )}
    >
      {value.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-0.5 rounded-full bg-muted py-0.5 pr-0.5 pl-2 text-xs"
        >
          {item}
          <button
            type="button"
            onClick={() => onChange(value.filter((kept) => kept !== item))}
            disabled={disabled}
            className="flex size-4 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label={`Remove ${item}`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        list={offered.length ? listId : undefined}
        disabled={disabled}
        placeholder={value.length ? undefined : placeholder}
        onChange={(event) => {
          // Picking a suggestion, or pasting "Gold, Ivory", arrives in one go.
          const next = event.target.value;
          const picked = (event.nativeEvent as InputEvent).inputType === "insertReplacementText";
          if (picked || next.includes(",")) commit(next);
          else setDraft(next);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            // Enter adds the word; it must not submit the surrounding form.
            event.preventDefault();
            commit(draft);
          } else if (event.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => commit(draft)}
        className="h-6 min-w-24 flex-1 bg-transparent px-1 outline-none placeholder:text-muted-foreground/70"
        {...aria}
      />
      {offered.length ? (
        <datalist id={listId}>
          {offered.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      ) : null}
    </div>
  );
}

/**
 * Picks any number of values from a fixed list — the storefront's moods and
 * themes — as toggle buttons, so nothing outside the list can be entered.
 * `labelFor` names an option that is an id rather than its own label.
 */
export function ToggleChips({
  id,
  options,
  value,
  onChange,
  labelFor = (option) => option,
  disabled,
  "aria-label": label,
}: {
  id?: string;
  options: readonly string[];
  value: string[];
  onChange: (value: string[]) => void;
  labelFor?: (option: string) => string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <div id={id} role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const on = value.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() =>
              // Kept in the list's own order, whichever order they were picked in.
              onChange(options.filter((item) => (item === option ? !on : value.includes(item))))
            }
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60",
              on
                ? "border-primary/40 bg-primary/10 font-medium text-primary"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {labelFor(option)}
          </button>
        );
      })}
    </div>
  );
}

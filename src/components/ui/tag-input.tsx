"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A short list of words — colours, materials, occasions — edited as chips.
 * Enter or a comma adds what is typed, Backspace in an empty box takes the last
 * one back, and leaving the box keeps anything still typed rather than losing
 * it. A repeat that differs only in case is not added twice.
 *
 * `suggestions` open in a list under the box as soon as it is focused and
 * narrow as the admin types, best matches first. Arrow keys move through the
 * list, Enter or a click adds the highlighted one, Escape closes it. Typing a
 * word that is not offered adds it as typed ("Add “Teal”"), so nothing outside
 * the list is ever refused. It is a custom list rather than the browser's own
 * `<datalist>`, which cannot be styled, sized to the box or navigated reliably.
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
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Enter takes the highlighted suggestion only once the arrow keys have been used; until then it adds what was typed.
  const [navigated, setNavigated] = useState(false);

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
    setActive(0);
    setNavigated(false);
  };

  const term = draft.trim().toLowerCase();

  // What the list shows: unpicked suggestions that match, those starting with the
  // text first, then (when the text is not already offered) the word as typed.
  const options = useMemo(() => {
    const matching = suggestions
      .filter((item) => !value.some((kept) => kept.toLowerCase() === item.toLowerCase()))
      .filter((item) => !term || item.toLowerCase().includes(term))
      .sort((a, b) => {
        const rank = (item: string) => (item.toLowerCase().startsWith(term) ? 0 : 1);
        return rank(a) - rank(b);
      })
      .map((item) => ({ label: item, custom: false }));
    const typed = draft.trim();
    const offered = typed && !suggestions.some((item) => item.toLowerCase() === typed.toLowerCase());
    const taken = typed && value.some((kept) => kept.toLowerCase() === typed.toLowerCase());
    return offered && !taken ? [...matching, { label: typed, custom: true }] : matching;
  }, [suggestions, value, term, draft]);

  const showList = open && !disabled && options.length > 0;
  const highlighted = Math.min(active, Math.max(options.length - 1, 0));
  const optionId = (index: number) => `${listId}-option-${index}`;

  const pick = (label: string) => {
    commit(label);
    // Stay in the box so several can be added in a row.
    input.current?.focus();
  };

  return (
    <div className="relative">
      <div
        onClick={() => input.current?.focus()}
        className={cn(
          "flex min-h-9 w-full cursor-text flex-wrap items-center gap-1 rounded-md border border-border bg-input px-1.5 py-1 text-sm transition-colors",
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
          ref={input}
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-activedescendant={showList ? optionId(highlighted) : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          value={draft}
          disabled={disabled}
          placeholder={value.length ? undefined : placeholder}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            // Pasting "Gold, Ivory" arrives in one go.
            const next = event.target.value;
            if (next.includes(",")) commit(next);
            else setDraft(next);
            setActive(0);
            setNavigated(false);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              if (!options.length) return;
              event.preventDefault();
              setOpen(true);
              setNavigated(true);
              const step = event.key === "ArrowDown" ? 1 : -1;
              setActive((highlighted + step + options.length) % options.length);
            } else if (event.key === "Enter") {
              // Enter adds a word; it must not submit the surrounding form.
              event.preventDefault();
              if (showList && navigated && options[highlighted]) commit(options[highlighted].label);
              else commit(draft);
            } else if (event.key === "Escape") {
              if (showList) {
                // Closes the list, not the dialog around it.
                event.preventDefault();
                // React listens on the document itself, where the dialog's Escape handler also sits, so a
                // plain stopPropagation would not keep it from firing.
                event.nativeEvent.stopImmediatePropagation();
                setOpen(false);
              }
            } else if (event.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => {
            commit(draft);
            setOpen(false);
          }}
          className="h-6 min-w-24 flex-1 bg-transparent px-1 outline-none placeholder:text-muted-foreground/70"
          {...aria}
        />
      </div>

      {showList ? (
        <div className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          <ul id={listId} role="listbox" className="max-h-56 overflow-y-auto p-1">
            {options.map((option, index) => (
              <li
                key={`${option.custom ? "new" : "s"}-${option.label}`}
                id={optionId(index)}
                role="option"
                aria-selected={index === highlighted}
                // Mouse down, not click: the box must keep focus or its blur closes the list first.
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(option.label);
                }}
                onMouseMove={() => setActive(index)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm",
                  index === highlighted ? "bg-primary/10 text-primary" : "text-foreground",
                )}
              >
                {option.custom ? (
                  <>
                    <Plus className="size-3.5 shrink-0" />
                    <span className="truncate">
                      Add <span className="font-medium">“{option.label}”</span>
                    </span>
                  </>
                ) : (
                  <span className="truncate">{option.label}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="border-t border-border bg-muted/40 px-2.5 py-1 text-[0.7rem] text-muted-foreground">
            ↑ ↓ to move · Enter to add · Esc to close
          </p>
        </div>
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

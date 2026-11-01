"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { FloatingList, useAnchoredPosition } from "@/components/ui/floating-list";

export interface ComboboxOption {
  value: string;
  /** Shown to the right of the value, e.g. "48 products". */
  hint?: string;
}

/**
 * A box with a list of names to pick from, for a value that is usually one of a known set but may be new
 * (the SKU owner: a name already used on other products, or a partner not seen before).
 *
 * Typing only searches: the form keeps the last name that was picked until another is picked, so text left in the
 * box can never look filled in without being saved. A name is taken by clicking it, or with the arrow keys and Enter
 * (Enter takes the top match when no arrow key was used). A typed name that is not in the list is offered as
 * "Use “name”", which is how a new one is added. Leaving the box with text that was not picked puts the saved name
 * back; clearing the box and leaving it empties the field. Escape closes the list without closing the dialog around
 * it; Enter never submits the form.
 *
 * A custom list rather than the browser's `<datalist>`, for the reasons given on TagInput: it cannot be styled,
 * sized to the box or used reliably on a touch screen. The list is drawn by {@link FloatingList}, on the page body,
 * so the dialog the box sits in cannot cut it off; it opens upwards when there is no room below.
 */
export function Combobox({
  id,
  value,
  onChange,
  onBlur,
  options,
  placeholder,
  disabled,
  ...aria
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  options: readonly ComboboxOption[];
  placeholder?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // What is being typed, or null while the box just shows the saved name. Never reaches the form until picked.
  const [query, setQuery] = useState<string | null>(null);

  const typed = (query ?? "").trim();
  const term = typed.toLowerCase();
  const saved = value.trim().toLowerCase();
  const exact = options.some((option) => option.value.toLowerCase() === term);

  // Nothing typed (or the saved name left as it is) shows the whole list, so it can be swapped for another;
  // otherwise the list narrows to what matches, the exact name first.
  const entries = useMemo(() => {
    const rank = (option: ComboboxOption) => {
      const name = option.value.toLowerCase();
      return name === term ? 0 : name.startsWith(term) ? 1 : 2;
    };
    const matching = options
      .filter((option) => !term || option.value.toLowerCase().includes(term))
      .sort((a, b) => rank(a) - rank(b))
      .map((option) => ({ ...option, custom: false }));
    return typed && !exact ? [...matching, { value: typed, hint: "new", custom: true }] : matching;
  }, [options, term, typed, exact]);

  const showList = open && !disabled && entries.length > 0;
  const place = useAnchoredPosition(box, showList, { maxHeight: 240 });
  const highlighted = Math.min(active, Math.max(entries.length - 1, 0));
  const optionId = (index: number) => `${listId}-option-${index}`;

  const close = () => {
    setOpen(false);
    setQuery(null);
    setActive(0);
  };
  const pick = (next: string) => {
    onChange(next);
    close();
    input.current?.focus();
  };

  return (
    <div ref={box} className="relative">
      <div
        className={cn(
          "flex h-9 w-full items-center rounded-md border border-border bg-input text-sm transition-colors",
          "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
          aria["aria-invalid"] && "border-destructive ring-2 ring-destructive/20",
          disabled && "opacity-60",
        )}
      >
        <input
          ref={input}
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-activedescendant={showList ? optionId(highlighted) : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          value={query ?? value}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              if (!entries.length) return;
              event.preventDefault();
              setOpen(true);
              const step = event.key === "ArrowDown" ? 1 : -1;
              setActive((highlighted + step + entries.length) % entries.length);
            } else if (event.key === "Enter") {
              // Enter picks or closes; it must not submit or advance the form around the box.
              event.preventDefault();
              if (showList && entries[highlighted]) pick(entries[highlighted].value);
              else close();
            } else if (event.key === "Escape" && showList) {
              event.preventDefault();
              // React listens on the document itself, where the dialog's Escape handler also sits.
              event.nativeEvent.stopImmediatePropagation();
              close();
            }
          }}
          onBlur={() => {
            // Text that was not picked is dropped, so the box shows what the form holds. An emptied box clears it.
            if (query !== null && !typed && value) onChange("");
            close();
            onBlur?.();
          }}
          className="h-full min-w-0 flex-1 bg-transparent px-3 outline-none placeholder:text-muted-foreground/70"
          {...aria}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label="Show the list"
          // Mouse down, not click: the box keeps focus, or its blur would close the list before the tap lands.
          onMouseDown={(event) => {
            event.preventDefault();
            input.current?.focus();
            setOpen((current) => !current);
          }}
          className="flex h-full w-9 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={cn("size-4 transition-transform", showList && "rotate-180")} />
        </button>
      </div>

      {place ? (
        <FloatingList place={place}>
          <ul id={listId} role="listbox" className="min-h-0 flex-1 overflow-y-auto p-1">
            {entries.map((entry, index) => (
              <li
                key={`${entry.custom ? "new" : "o"}-${entry.value}`}
                id={optionId(index)}
                role="option"
                aria-selected={entry.value.toLowerCase() === saved}
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(entry.value);
                }}
                onMouseMove={() => setActive(index)}
                className={cn(
                  // Tall enough to tap on a phone.
                  "flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm",
                  index === highlighted ? "bg-primary/10 text-primary" : "text-foreground",
                )}
              >
                {entry.custom ? (
                  <span className="flex min-w-0 items-center gap-2">
                    <Plus className="size-3.5 shrink-0" />
                    <span className="truncate">
                      Use <span className="font-medium">“{entry.value}”</span>
                    </span>
                  </span>
                ) : (
                  <span className="flex min-w-0 items-center gap-2">
                    <Check className={cn("size-3.5 shrink-0", entry.value.toLowerCase() === saved ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{entry.value}</span>
                  </span>
                )}
                {entry.hint ? <span className="shrink-0 text-xs text-muted-foreground">{entry.hint}</span> : null}
              </li>
            ))}
          </ul>
        </FloatingList>
      ) : null}
    </div>
  );
}

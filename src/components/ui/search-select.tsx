"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ImageOff, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { FloatingList, useAnchoredPosition } from "@/components/ui/floating-list";

export interface SearchSelectOption {
  value: string;
  /** What the box shows once chosen, and what typing is matched against. */
  label: string;
  /** Shown to the right in the list, such as a price. */
  hint?: string;
  /** Extra words typing may match that are not shown, such as a SKU. */
  keywords?: string;
  /** A small picture shown beside the name. Null is "has none" (a placeholder shows); leave it out to show no pictures. */
  image?: string | null;
}

/** A square picture for a row, falling back to a neutral icon when there is none or it will not load. */
function OptionImage({ src, className }: { src: string | null; className: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return (
    <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted text-muted-foreground", className)}>
      {src && src !== failedSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- a storage address, which next/image has nothing to optimise
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailedSrc(src)} className="size-full object-cover" />
      ) : (
        <ImageOff className="size-1/2" aria-hidden="true" />
      )}
    </span>
  );
}

/**
 * A select you can type into: a box showing the chosen name, a list below it that narrows as you type, and a pick by
 * click, Enter or the arrow keys. Unlike the plain `<select>` it copes with a catalogue of hundreds, and unlike
 * {@link Combobox} the value is always one of the options (an id), never free text.
 *
 * The list is drawn on the page itself, not inside the box's parent, so a table's scroll area cannot cut it off. It
 * opens upwards when the window is short of room below, and stays inside the window (see {@link FloatingList}).
 */
export function SearchSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Choose…",
  action,
  disabled,
  className,
  ...aria
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly SearchSelectOption[];
  placeholder?: string;
  /** A row kept at the bottom of the list that does something else than pick an option, such as "Add one-time product". It is handed what was typed. */
  action?: { label: string; onSelect: (typed: string) => void };
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
}) {
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  // As wide as the box (and at least wide enough to read a long name).
  const place = useAnchoredPosition(box, open, { minWidth: 320, maxHeight: 320 });

  const chosen = options.find((option) => option.value === value);

  // Every typed word must appear in the name or keywords; names that start with the text come first.
  const entries = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const text = query.trim().toLowerCase();
    return options
      .filter((option) => {
        const haystack = `${option.label} ${option.keywords ?? ""}`.toLowerCase();
        return words.every((word) => haystack.includes(word));
      })
      .sort((a, b) => Number(!a.label.toLowerCase().startsWith(text)) - Number(!b.label.toLowerCase().startsWith(text)));
  }, [options, query]);
  // The action row, when there is one, is the last row of the list and reachable by the arrow keys like the others.
  const rows = entries.length + (action ? 1 : 0);
  const highlighted = Math.min(active, Math.max(rows - 1, 0));

  // Keep the highlighted row in view while the arrow keys move it.
  useEffect(() => {
    if (open) document.getElementById(`${listId}-${highlighted}`)?.scrollIntoView({ block: "nearest" });
  }, [open, highlighted, listId]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setActive(0);
  };
  const pick = (option: SearchSelectOption) => {
    onChange(option.value);
    close();
  };
  const runAction = () => {
    const typed = query.trim();
    close();
    action?.onSelect(typed);
  };

  return (
    <div ref={box} className={cn("relative", className)}>
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
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          // Open: what is being typed. Closed: the chosen name.
          value={open ? query : (chosen?.label ?? "")}
          placeholder={open && chosen ? chosen.label : placeholder}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              if (rows) setActive((highlighted + (event.key === "ArrowDown" ? 1 : -1) + rows) % rows);
            } else if (event.key === "Enter") {
              // Picks the highlighted name; it must never submit the form around the box.
              event.preventDefault();
              if (open && entries[highlighted]) pick(entries[highlighted]);
              else if (open && action && highlighted === entries.length) runAction();
            } else if (event.key === "Escape" && open) {
              event.preventDefault();
              close();
            }
          }}
          onBlur={close}
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
            if (open) close();
            else {
              input.current?.focus();
              setOpen(true);
            }
          }}
          className="flex h-full w-9 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && place
        ? (
            <FloatingList place={place}>
              <ul id={listId} role="listbox" className="min-h-0 flex-1 overflow-y-auto p-1">
                {entries.length === 0 ? (
                  <li className="px-2.5 py-3 text-sm text-muted-foreground">Nothing matches “{query.trim()}”</li>
                ) : (
                  entries.map((option, index) => (
                    <li
                      key={option.value}
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={option.value === value}
                      // Mouse down, not click, so the box's blur does not close the list first.
                      onMouseDown={(event) => {
                        event.preventDefault();
                        pick(option);
                      }}
                      onMouseMove={() => setActive(index)}
                      className={cn(
                        "flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm",
                        option.image !== undefined && "py-1.5",
                        index === highlighted ? "bg-primary/10 text-primary" : "text-foreground",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Check className={cn("size-3.5 shrink-0", option.value === value ? "opacity-100" : "opacity-0")} />
                        {option.image !== undefined ? <OptionImage src={option.image} className="size-11" /> : null}
                        <span className="truncate">{option.label}</span>
                      </span>
                      {option.hint ? <span className="shrink-0 text-xs text-muted-foreground">{option.hint}</span> : null}
                    </li>
                  ))
                )}
              </ul>
              {action ? (
                <div
                  id={`${listId}-${entries.length}`}
                  role="option"
                  aria-selected={false}
                  // Mouse down, not click, for the same reason as the rows above.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    runAction();
                  }}
                  onMouseMove={() => setActive(entries.length)}
                  className={cn(
                    "flex min-h-10 shrink-0 cursor-pointer items-center gap-2 border-t border-border px-3.5 py-2 text-sm font-medium",
                    highlighted === entries.length ? "bg-primary/10 text-primary" : "text-primary",
                  )}
                >
                  <Plus className="size-3.5 shrink-0" />
                  {action.label}
                </div>
              ) : null}
            </FloatingList>
          )
        : null}
    </div>
  );
}

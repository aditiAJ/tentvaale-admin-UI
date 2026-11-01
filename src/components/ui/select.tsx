"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FloatingList, useAnchoredPosition } from "@/components/ui/floating-list";

/** A list longer than this (placeholder not counted) gets a type-to-search box instead of the browser's menu. */
const SEARCH_ABOVE = 6;

interface Entry {
  value: string;
  label: string;
  disabled: boolean;
}

/**
 * How well `label` matches what was typed, best first: 0 the whole label, 1 starts with it, 2 a word starts with it,
 * 3 it appears somewhere inside, -1 not at all. Case does not matter.
 */
function matchRank(label: string, term: string): number {
  const text = label.toLowerCase();
  if (text === term) return 0;
  if (text.startsWith(term)) return 1;
  if (text.split(/[^a-z0-9]+/).some((word) => word.startsWith(term))) return 2;
  return text.includes(term) ? 3 : -1;
}

function sameEntries(a: Entry[], b: Entry[]) {
  return (
    a.length === b.length &&
    a.every((entry, i) => entry.value === b[i].value && entry.label === b[i].label && entry.disabled === b[i].disabled)
  );
}

const NATIVE_CLASS = [
  "h-9 w-full rounded-md border border-border bg-input px-2.5 text-sm outline-none transition-colors",
  "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
  // A disabled select that only dims slightly reads as "enabled but
  // ugly". Dropping it onto the muted ground makes it plainly inert,
  // which matters here because the reason lives in a title tooltip the
  // user only looks for once they believe it is unavailable.
  "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-80",
  "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
];

/**
 * A drop-in for `<select>`. A short list stays the browser's own select. A list of more than six choices becomes a
 * box you can type into: the list narrows as you type, an exact match comes first, then names that start with the
 * text, then names with a word that starts with it, then the rest, and "No matching options" shows when nothing fits.
 *
 * The real `<select>` stays in the page, hidden, and is what the form talks to. Picking an entry sets its value and
 * fires a genuine `change` event on it, so `register()`, `watch`, `reset`, `onChange={(e) => e.target.value}`,
 * validation and submission all work exactly as they did, and no screen needs to change.
 */
export function Select({ className, ref, children, ...props }: React.ComponentProps<"select">) {
  const native = useRef<HTMLSelectElement | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [value, setValue] = useState("");

  const setRefs = useCallback(
    (node: HTMLSelectElement | null) => {
      native.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.RefObject<HTMLSelectElement | null>).current = node;
    },
    [ref],
  );

  // Read the choices and the chosen value back from the real select, which is the source of truth: the form library
  // writes to it directly (setValue, reset) without telling React.
  const sync = useCallback(() => {
    const el = native.current;
    if (!el) return;
    const next = Array.from(el.options, (option) => ({ value: option.value, label: option.text, disabled: option.disabled }));
    setEntries((current) => (sameEntries(current, next) ? current : next));
    setValue(el.value);
  }, []);

  useLayoutEffect(() => {
    sync();
  });

  useEffect(() => {
    const el = native.current;
    if (!el) return;
    const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
    if (!descriptor?.get || !descriptor.set) return;
    const { get, set } = descriptor;
    // `field.value = x` from the form library lands between renders; follow it.
    Object.defineProperty(el, "value", {
      configurable: true,
      get() {
        return get.call(this);
      },
      set(next: string) {
        set.call(this, next);
        sync();
      },
    });
    return () => {
      delete (el as { value?: unknown }).value;
    };
  }, [sync]);

  const searchable = !props.multiple && !props.size && entries.filter((entry) => entry.value !== "").length > SEARCH_ABOVE;

  const pick = (next: string) => {
    const el = native.current;
    if (!el) return;
    if (el.value !== next) {
      el.value = next;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    sync();
  };

  // The form library's blur handler listens on the real select.
  const blurNative = () => native.current?.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));

  return (
    <>
      {searchable ? (
        <SearchPicker
          id={props.id}
          className={className}
          entries={entries}
          value={value}
          disabled={props.disabled}
          title={props.title}
          onPick={pick}
          onBlur={blurNative}
          aria-label={props["aria-label"]}
          aria-labelledby={props["aria-labelledby"]}
          aria-describedby={props["aria-describedby"]}
          aria-invalid={props["aria-invalid"]}
        />
      ) : null}
      <select
        {...props}
        ref={setRefs}
        id={searchable ? undefined : props.id}
        tabIndex={searchable ? -1 : props.tabIndex}
        aria-hidden={searchable ? true : props["aria-hidden"]}
        className={searchable ? "sr-only" : cn(NATIVE_CLASS, className)}
      >
        {children}
      </select>
    </>
  );
}

interface PickerProps {
  id?: string;
  className?: string;
  entries: Entry[];
  value: string;
  disabled?: boolean;
  title?: string;
  onPick: (value: string) => void;
  onBlur: () => void;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
}

function SearchPicker({ id, className, entries, value, disabled, title, onPick, onBlur, ...aria }: PickerProps) {
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  // Fixed to the window and rendered on the page body, so a table or dialog that scrolls cannot clip the list.
  const place = useAnchoredPosition(box, open && !disabled);

  const selected = entries.find((entry) => entry.value === value);
  const selectedLabel = selected?.label ?? "";
  const term = query.trim().toLowerCase();

  const shown = useMemo(() => {
    const ranked = entries.map((entry, index) => ({ entry, index, rank: term ? matchRank(entry.label, term) : 0 }));
    return ranked.filter((row) => row.rank >= 0).sort((a, b) => a.rank - b.rank || a.index - b.index).map((row) => row.entry);
  }, [entries, term]);

  const highlighted = Math.min(active, Math.max(shown.length - 1, 0));
  const optionId = (index: number) => `${listId}-option-${index}`;

  const openList = () => {
    if (disabled || open) return;
    setQuery("");
    // Start on what is chosen now, so the list opens where the eye expects it.
    setActive(Math.max(entries.findIndex((entry) => entry.value === value), 0));
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const choose = (entry: Entry | undefined) => {
    if (!entry || entry.disabled) return;
    onPick(entry.value);
    close();
    input.current?.focus();
  };

  useEffect(() => {
    if (open) document.getElementById(optionId(highlighted))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, highlighted]);

  const showList = open && !disabled && place !== null;

  return (
    <div className={cn("relative w-full", className)}>
      <div
        ref={box}
        title={title}
        className={cn(
          "flex h-9 w-full items-center rounded-md border border-border bg-input text-sm transition-colors",
          "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
          aria["aria-invalid"] && aria["aria-invalid"] !== "false" && "border-destructive ring-2 ring-destructive/20",
          disabled && "cursor-not-allowed bg-muted opacity-80",
        )}
      >
        <input
          ref={input}
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-activedescendant={showList && shown.length ? optionId(highlighted) : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          // Closed it shows the choice; open it is the search box, with the choice as the hint.
          value={open ? query : selectedLabel}
          placeholder={open ? selectedLabel || "Type to search" : undefined}
          onFocus={openList}
          onClick={openList}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              if (!open) return openList();
              if (!shown.length) return;
              const step = event.key === "ArrowDown" ? 1 : -1;
              setActive((highlighted + step + shown.length) % shown.length);
            } else if (event.key === "Enter") {
              // Picks the top match; it must not submit or advance the form around the box.
              event.preventDefault();
              if (open) choose(shown[highlighted]);
            } else if (event.key === "Escape" && open) {
              event.preventDefault();
              // The dialog around the box also listens for Escape; this one only closes the list.
              event.nativeEvent.stopImmediatePropagation();
              close();
            }
          }}
          onBlur={() => {
            close();
            onBlur();
          }}
          className={cn(
            "h-full min-w-0 flex-1 truncate bg-transparent pl-2.5 outline-none placeholder:text-muted-foreground/70",
            "disabled:cursor-not-allowed",
            !open && value === "" && "text-muted-foreground",
          )}
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
            if (open) close();
            else openList();
          }}
          className="flex h-full w-8 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground disabled:cursor-not-allowed"
        >
          <ChevronDown className={cn("size-4 transition-transform", showList && "rotate-180")} />
        </button>
      </div>

      {showList
        ? (
            <FloatingList place={place}>
              {shown.length ? (
                <ul id={listId} role="listbox" className="min-h-0 flex-1 overflow-y-auto p-1">
                  {shown.map((entry, index) => (
                    <li
                      key={entry.value}
                      id={optionId(index)}
                      role="option"
                      aria-selected={entry.value === value}
                      aria-disabled={entry.disabled || undefined}
                      title={entry.label}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        choose(entry);
                      }}
                      onMouseMove={() => setActive(index)}
                      className={cn(
                        // Tall enough to tap on a phone.
                        "flex min-h-10 items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm",
                        entry.disabled ? "cursor-not-allowed text-muted-foreground/60" : "cursor-pointer",
                        index === highlighted && !entry.disabled ? "bg-primary/10 text-primary" : "text-foreground",
                      )}
                    >
                      <span className="truncate">{entry.label}</span>
                      {entry.value === value ? <Check className="size-4 shrink-0" /> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p role="status" className="px-3 py-3 text-sm text-muted-foreground">
                  No matching options
                </p>
              )}
            </FloatingList>
          )
        : null}
    </div>
  );
}

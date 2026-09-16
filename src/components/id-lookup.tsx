"use client";

import { Search } from "lucide-react";
import { IS_MOCK } from "@/services/data-source";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface LookupExample {
  id: string;
  label: string;
}

interface IdLookupProps {
  label: string;
  /** The id currently being looked up; also what the field resets to. */
  value: string;
  onChange: (value: string) => void;
  submitLabel: string;
  busy?: boolean;
  /** Offered as one-click shortcuts in mock mode. Nobody types a UUID. */
  examples?: LookupExample[];
}

/**
 * The lookup form four screens need, because four backend modules expose a
 * record by id but cannot list what ids exist. Shared rather than copied so
 * the keyboard and reset behaviour stay identical across them.
 */
export function IdLookup({
  label,
  value,
  onChange,
  submitLabel,
  busy,
  examples,
}: IdLookupProps) {
  const fieldId = `lookup-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const entered = new FormData(event.currentTarget).get("lookupId");
          onChange(typeof entered === "string" ? entered.trim() : "");
        }}
      >
        <div className="min-w-64 flex-1 sm:max-w-md">
          <label htmlFor={fieldId} className="mb-1.5 block text-xs font-medium">
            {label}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={fieldId}
              name="lookupId"
              // Keyed on the current id so picking an example remounts the field
              // with that value; it is otherwise uncontrolled, so a changed
              // defaultValue alone would never reach the DOM.
              key={value}
              defaultValue={value}
              placeholder="00000000-0000-0000-0000-000000000000"
              className="pl-8 font-mono text-xs"
            />
          </div>
        </div>
        <Button type="submit" disabled={busy}>
          {submitLabel}
        </Button>
      </form>

      {IS_MOCK && examples?.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Try:</span>
          {examples.map((example) => (
            <button
              key={example.id}
              type="button"
              onClick={() => onChange(example.id)}
              className="rounded-md border border-border px-2 py-1 font-mono text-xs transition-colors hover:bg-muted"
            >
              {example.label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

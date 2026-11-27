"use client";

import { useMemo } from "react";
import { TriangleAlert } from "lucide-react";
import { requiresOf, tick, untick } from "@/features/users/access";
import type { AccessBox, AccessModule } from "@/features/users/types";
import type { Permission } from "@/services/permissions";
import { cn } from "@/lib/utils";

/** The actions most modules share, each with its own column. Everything else a module offers goes under "More". */
const COLUMNS = ["View", "Add", "Edit", "Delete"] as const;

const BOX = "size-4 shrink-0 cursor-pointer accent-[var(--primary)]";

/** Module name, the four shared columns, then the rest. On a narrow screen a row wraps into labelled chips instead. */
const ROW = "md:grid md:grid-cols-[11.5rem_repeat(4,3.75rem)_minmax(0,1fr)] md:items-center";

/**
 * The column headings of the table below. Drawn once, by the form, inside its bar that stays in view, so a column can
 * still be told apart after scrolling. Its side padding matches a row's, border included, to line the columns up.
 */
export function AccessHeadings() {
  return (
    <div
      aria-hidden="true"
      className={cn("hidden border-x border-transparent px-3 text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase", ROW)}
    >
      <span>Module</span>
      {COLUMNS.map((column) => (
        <span key={column} className="flex items-center justify-center gap-1">
          {column}
          {column === "Delete" ? <TriangleAlert className="size-3 text-warning" /> : null}
        </span>
      ))}
      <span className="pl-3">More</span>
    </div>
  );
}

/**
 * The tick boxes of the access form as a table: one row for each module, grouped like the left menu, with View, Add,
 * Edit and Delete lined up so that who can do what can be read down a column.
 */
export function AccessBoxes({
  modules,
  selected,
  usual,
  onChange,
}: {
  modules: AccessModule[];
  selected: ReadonlySet<Permission>;
  /** What the chosen role starts with: a box that differs from it is marked. */
  usual: ReadonlySet<Permission>;
  onChange: (next: Set<Permission>) => void;
}) {
  const requires = useMemo(() => requiresOf(modules), [modules]);
  const groups = [...new Set(modules.map((m) => m.group))];

  const set = (boxes: Permission[], on: boolean) =>
    onChange(on ? tick(selected, boxes, requires) : untick(selected, boxes, requires));

  const box = (item: AccessBox, module: AccessModule, column: boolean) => {
    const checked = selected.has(item.permission);
    const changed = checked !== usual.has(item.permission);
    return (
      <label
        key={item.permission}
        title={`${item.description}${changed ? " (changed from the role default)" : ""}`}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
          "hover:border-primary/60 has-focus-visible:ring-2 has-focus-visible:ring-ring/50",
          checked ? "border-primary/50 bg-primary/10 font-medium" : "border-border bg-card text-muted-foreground",
          // In its own column on a wide screen the heading names it, so only the box is shown.
          column && "md:size-8 md:justify-center md:justify-self-center md:rounded-md md:border-transparent md:bg-transparent md:p-0",
          changed && "ring-2 ring-warning/60",
        )}
      >
        <input
          type="checkbox"
          className={BOX}
          checked={checked}
          onChange={(event) => set([item.permission], event.target.checked)}
          aria-label={`${module.title}: ${item.label}`}
        />
        <span className={cn(column && "md:sr-only")}>{item.label}</span>
        {item.sensitive ? (
          <TriangleAlert className={cn("size-3.5 shrink-0 text-warning", column && "md:hidden")} aria-label="sensitive" />
        ) : null}
      </label>
    );
  };

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <section key={group} className="overflow-hidden rounded-lg border border-border">
          <h4 className="bg-muted/70 px-3 py-2 text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">
            {group}
          </h4>

          {modules
            .filter((m) => m.group === group)
            .map((module) => {
              const all = module.boxes.map((b) => b.permission);
              const count = all.filter((p) => selected.has(p)).length;
              const others = module.boxes.filter((b) => !(COLUMNS as readonly string[]).includes(b.label));
              return (
                <fieldset
                  key={module.title}
                  className={cn("flex flex-wrap items-center gap-2 border-t border-border px-3 py-2 hover:bg-muted/30 md:gap-0", ROW)}
                >
                  <legend className="sr-only">{module.title}</legend>
                  <label className="flex w-full cursor-pointer items-center gap-2.5 text-sm md:w-auto">
                    <input
                      type="checkbox"
                      className={BOX}
                      checked={count === all.length}
                      ref={(input) => {
                        if (input) input.indeterminate = count > 0 && count < all.length;
                      }}
                      onChange={(event) => set(all, event.target.checked)}
                      aria-label={`All ${module.title} access`}
                    />
                    <span className={cn("leading-tight", count > 0 ? "font-medium" : "text-muted-foreground")}>
                      {module.title}
                    </span>
                  </label>
                  {COLUMNS.map((column) => {
                    const item = module.boxes.find((b) => b.label === column);
                    return item ? (
                      box(item, module, true)
                    ) : (
                      <span key={column} className="hidden text-center text-muted-foreground/40 md:block" aria-hidden="true">
                        –
                      </span>
                    );
                  })}
                  <div className="contents md:flex md:flex-wrap md:gap-1.5 md:pl-3">
                    {others.map((item) => box(item, module, false))}
                  </div>
                </fieldset>
              );
            })}
        </section>
      ))}
    </div>
  );
}

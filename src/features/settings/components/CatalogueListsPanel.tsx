"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, Eye, EyeOff, Loader2, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useCan } from "@/features/auth";
import {
  CATALOGUE_LISTS,
  addListValue,
  catalogueListKeys,
  facetOf,
  sortedValues,
  updateListValue,
  useCatalogueLists,
  type CatalogueList,
  type ListFacet,
  type ListValue,
} from "@/features/master-data/catalogueLists";
import { BundleOccasionsDialog } from "@/features/master-data/components/BundleOccasionsDialog";
import { ApiError } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** The picker has one entry per list, and one for the occasions (which have their own manager). */
const OCCASIONS = "occasions";

/**
 * The lists the product form offers (mood, theme fit, indoor / outdoor, colours, materials, fabrics) and the
 * occasions, managed in one place: pick a list on the left, see all its values on the right. A value can be added,
 * renamed (everywhere it is used) or hidden (kept on the products that have it, no longer offered for new ones).
 * Nothing is deleted, so no product loses a detail.
 */
export function CatalogueListsPanel() {
  const canWrite = useCan("MASTER_DATA_WRITE");
  const { facets, isPending, isError } = useCatalogueLists();
  const [selected, setSelected] = useState<string>(CATALOGUE_LISTS[0].code);
  const [occasions, setOccasions] = useState(false);

  if (IS_MOCK) return <Alert tone="info" title="These lists need the backend. The demo data uses the built-in ones." />;
  if (isError) return <Alert tone="error" title="Could not load the product lists." />;

  const list = CATALOGUE_LISTS.find((l) => l.code === selected);
  const facet = list ? facetOf(facets, list.code) : undefined;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">Product options</h2>
        <p className="text-sm text-muted-foreground">
          The choices on the product form and the storefront filters. Add one, rename it everywhere, or hide it from new products.
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[260px_1fr]">
        <nav aria-label="Product options" className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {CATALOGUE_LISTS.map((l) => {
            const f = facetOf(facets, l.code);
            const live = f ? f.values.filter((v) => v.active).length : null;
            return (
              <PickerButton
                key={l.code}
                active={selected === l.code}
                onClick={() => setSelected(l.code)}
                title={l.label}
                hint={live === null ? (isPending ? "Loading…" : "Not set up") : `${live} ${live === 1 ? "choice" : "choices"}`}
              />
            );
          })}
          <PickerButton active={selected === OCCASIONS} onClick={() => setSelected(OCCASIONS)} title="Occasions" hint="Bundles and collections" />
        </nav>

        <div className="min-w-0">
          {list && facet ? (
            <ListDetail key={list.code} list={list} facet={facet} canWrite={canWrite} />
          ) : list ? (
            <Card className="p-5 text-sm text-muted-foreground">
              {isPending ? "Loading…" : "This list is not set up yet. A person who may edit master data sets it up the first time they open the product form."}
            </Card>
          ) : (
            <Card className="space-y-3 p-5">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" aria-hidden />
                <h3 className="text-sm font-semibold">Occasions</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                The storefront&apos;s occasion filter (Wedding, Haldi, Sangeet and so on), used on bundles and collections. Add, rename, reorder or hide them.
              </p>
              <div>
                <Button variant="outline" onClick={() => setOccasions(true)}>
                  Manage occasions
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {occasions ? <BundleOccasionsDialog canWrite={canWrite} onClose={() => setOccasions(false)} /> : null}
    </section>
  );
}

function PickerButton({ active, onClick, title, hint }: { active: boolean; onClick: () => void; title: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex shrink-0 flex-col gap-0.5 rounded-lg border px-3.5 py-2.5 text-left transition-colors lg:w-full",
        active ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40",
      )}
    >
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}

function ListDetail({ list, facet, canWrite }: { list: CatalogueList; facet: ListFacet; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const values = sortedValues(facet);
  const refresh = () => queryClient.invalidateQueries({ queryKey: catalogueListKeys.all });
  const fail = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Could not save the change.");

  const add = useMutation({
    mutationFn: (value: string) => addListValue(facet.id, value, values.length),
    onSuccess: () => {
      setText("");
      return refresh();
    },
    onError: fail,
  });

  // The standard values this list does not have (by name, ignoring case): offered back, never forced.
  const have = new Set(values.map((v) => v.value.toLowerCase()));
  const missing = list.defaults.filter((value) => !have.has(value.toLowerCase()));
  const addStandard = useMutation({
    mutationFn: async () => {
      for (const [i, value] of missing.entries()) await addListValue(facet.id, value, values.length + i);
    },
    onSuccess: refresh,
    onError: fail,
  });

  const trimmed = text.trim();
  const duplicate = trimmed !== "" && have.has(trimmed.toLowerCase());
  const hidden = values.filter((v) => !v.active).length;

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{list.label}</h3>
          <p className="text-xs text-muted-foreground">{list.hint}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {values.length - hidden} offered{hidden > 0 ? `, ${hidden} hidden` : ""}
          </p>
        </div>

        {canWrite ? (
          <form
            className="flex w-full gap-2 sm:w-72"
            onSubmit={(event) => {
              event.preventDefault();
              if (trimmed && !duplicate) add.mutate(trimmed);
            }}
          >
            <Input
              value={text}
              maxLength={120}
              placeholder="Add a choice"
              aria-label={`Add to ${list.label}`}
              aria-invalid={duplicate}
              onChange={(e) => setText(e.target.value)}
            />
            <Button type="submit" disabled={!trimmed || duplicate || add.isPending}>
              {add.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Add
            </Button>
          </form>
        ) : null}
      </div>
      {duplicate ? <p className="-mt-2 text-xs text-destructive">That is already in the list.</p> : null}

      {values.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">Nothing in this list yet.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {values.map((value) => (
            <ValueTile key={value.id} value={value} canWrite={canWrite} onChanged={refresh} onError={fail} />
          ))}
        </ul>
      )}

      {canWrite && missing.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <span>
            {missing.length} standard {missing.length === 1 ? "choice is" : "choices are"} not in this list ({missing.slice(0, 3).join(", ")}
            {missing.length > 3 ? "…" : ""}).
          </span>
          <Button size="sm" variant="outline" disabled={addStandard.isPending} onClick={() => addStandard.mutate()}>
            {addStandard.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Add them
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function ValueTile({
  value,
  canWrite,
  onChanged,
  onError,
}: {
  value: ListValue;
  canWrite: boolean;
  onChanged: () => unknown;
  onError: (e: unknown) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (change: { value?: string; active?: boolean }) => updateListValue(value.id, value, change),
    onSuccess: () => {
      setEditing(null);
      return onChanged();
    },
    onError,
  });

  const tile = "flex h-11 items-center gap-1.5 rounded-lg border bg-card pr-1.5 pl-3";

  if (editing !== null) {
    const next = editing.trim();
    const changed = next !== "" && next !== value.value;
    return (
      <li className={cn(tile, "border-primary")}>
        <input
          autoFocus
          value={editing}
          maxLength={120}
          aria-label={`Rename ${value.value}`}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          onChange={(e) => setEditing(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(null);
            if (e.key === "Enter" && changed) save.mutate({ value: next });
          }}
        />
        <Button size="icon" variant="ghost" className="size-8" aria-label="Save name" disabled={!changed || save.isPending} onClick={() => save.mutate({ value: next })}>
          {save.isPending ? <Loader2 className="animate-spin" /> : <Check />}
        </Button>
        <Button size="icon" variant="ghost" className="size-8" aria-label="Cancel" onClick={() => setEditing(null)}>
          <X />
        </Button>
      </li>
    );
  }

  return (
    <li className={cn(tile, "border-border", !value.active && "border-dashed bg-muted/40")}>
      <span className={cn("min-w-0 flex-1 truncate text-sm", !value.active && "text-muted-foreground line-through")} title={value.value}>
        {value.value}
      </span>
      {!value.active ? <span className="shrink-0 text-[11px] text-muted-foreground">Hidden</span> : null}
      {canWrite ? (
        <>
          <Button size="icon" variant="ghost" className="size-8" aria-label={`Rename ${value.value}`} onClick={() => setEditing(value.value)}>
            <Pencil />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            aria-label={value.active ? `Hide ${value.value}` : `Show ${value.value}`}
            title={value.active ? "Hide from new products" : "Offer again"}
            disabled={save.isPending}
            onClick={() => save.mutate({ active: !value.active })}
          >
            {value.active ? <EyeOff /> : <Eye />}
          </Button>
        </>
      ) : null}
    </li>
  );
}

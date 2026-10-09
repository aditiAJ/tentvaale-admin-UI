"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Loader2, Pencil, Plus, Search, X } from "lucide-react";
import {
  createBundleOccasion,
  listBundleOccasions,
  masterDataKeys,
  reorderBundleOccasions,
  setBundleOccasionActive,
  updateBundleOccasion,
} from "@/features/master-data/api";
import type { BundleOccasionView } from "@/features/master-data/types";
import { ApiError } from "@/services/api-client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type View = "all" | "shown" | "hidden";

/**
 * The storefront's bundle filter row: add, rename, reorder, and show or hide
 * each occasion. Hiding keeps the occasion on its bundles and only stops the
 * storefront offering it as a filter; nothing here deletes one.
 *
 * Every write refreshes the bundle list too, since bundles show occasion names.
 */
export function BundleOccasionsDialog({
  canWrite,
  onClose,
}: {
  canWrite: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("all");

  const occasions = useQuery({
    queryKey: masterDataKeys.bundleOccasions,
    queryFn: ({ signal }) => listBundleOccasions(signal),
  });

  const onError = (fallback: string) => (failure: unknown) =>
    setError(failure instanceof ApiError ? failure.message : fallback);
  const refresh = () => {
    setError(null);
    // Bundles is the parent key, so this refreshes the occasions as well.
    return queryClient.invalidateQueries({ queryKey: masterDataKeys.bundles });
  };

  const create = useMutation({
    mutationFn: (name: string) => createBundleOccasion({ name }),
    onSuccess: () => {
      setNewName("");
      return refresh();
    },
    onError: onError("Could not add the occasion."),
  });

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateBundleOccasion(id, { name }),
    onSuccess: () => {
      setRenaming(null);
      return refresh();
    },
    onError: onError("Could not rename the occasion."),
  });

  const toggle = useMutation({
    mutationFn: (occasion: BundleOccasionView) =>
      setBundleOccasionActive(occasion.id, !occasion.active),
    onSuccess: refresh,
    onError: onError("Could not change the occasion."),
  });

  const reorder = useMutation({
    mutationFn: reorderBundleOccasions,
    onSuccess: refresh,
    onError: onError("Could not reorder the occasions."),
  });

  const busy = create.isPending || rename.isPending || toggle.isPending || reorder.isPending;
  const list = occasions.data ?? [];

  const move = (index: number, by: -1 | 1) => {
    const ids = list.map((occasion) => occasion.id);
    [ids[index], ids[index + by]] = [ids[index + by], ids[index]];
    reorder.mutate(ids);
  };

  const submitNew = () => {
    const name = newName.trim();
    if (!name) {
      setError("Name the occasion");
      return;
    }
    create.mutate(name);
  };

  const submitRename = () => {
    if (!renaming) return;
    const name = renaming.name.trim();
    if (!name) {
      setError("Name the occasion");
      return;
    }
    rename.mutate({ id: renaming.id, name });
  };

  const shownCount = list.filter((occasion) => occasion.active).length;
  const hiddenCount = list.length - shownCount;
  // Reordering only makes sense on the whole list: with a filter or a search the neighbours are not each other's.
  const filtered = view !== "all" || query.trim() !== "";
  const rows = list
    .map((occasion, index) => ({ occasion, index }))
    .filter(({ occasion }) => view === "all" || (view === "shown" ? occasion.active : !occasion.active))
    .filter(({ occasion }) => !query.trim() || occasion.name.toLowerCase().includes(query.trim().toLowerCase()));

  const views: { value: View; label: string; count: number }[] = [
    { value: "all", label: "All", count: list.length },
    { value: "shown", label: "Shown", count: shownCount },
    { value: "hidden", label: "Hidden", count: hiddenCount },
  ];

  return (
    <Dialog
      open
      onClose={onClose}
      title="Bundle occasions"
      description="The filters shoppers see on the storefront's bundles page, in this order."
      className="max-w-lg"
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-3">
        {canWrite ? (
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              onChange={(event) => {
                setNewName(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitNew();
              }}
              aria-label="New occasion"
              placeholder="Add an occasion, e.g. Haldi"
              className="min-w-0 flex-1"
              disabled={busy}
            />
            <Button onClick={submitNew} disabled={busy}>
              {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              Add
            </Button>
          </div>
        ) : null}

        {error ? <Alert tone="error" title={error} /> : null}
        {occasions.isError ? (
          <Alert
            tone="error"
            title={occasions.error instanceof Error ? occasions.error.message : "Could not load the occasions."}
          />
        ) : null}

        {occasions.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : null}

        {list.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1 basis-40">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search occasions"
                  aria-label="Search occasions"
                  className="h-9 w-full rounded-md border border-border bg-background pr-3 pl-8 text-sm outline-none transition-colors hover:border-primary/40 focus:border-primary focus-visible:ring-2 focus-visible:ring-ring/50"
                />
              </div>
              <div role="group" aria-label="Show" className="inline-flex rounded-md border border-border bg-card p-0.5">
                {views.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setView(option.value)}
                    aria-pressed={view === option.value}
                    className={cn(
                      "h-8 rounded px-2.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                      view === option.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {option.label} <span className="text-[0.7rem] tabular opacity-70">{option.count}</span>
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              <strong className="font-medium text-foreground tabular">{shownCount}</strong> shown on the storefront
              {hiddenCount > 0 ? (
                <>
                  {" · "}
                  <span className="tabular">{hiddenCount}</span> hidden (kept on their bundles, just not offered as a
                  filter)
                </>
              ) : null}
              .
            </p>
          </>
        ) : null}

        {rows.length > 0 ? (
          <ul className="max-h-[48vh] divide-y divide-border overflow-y-auto rounded-md border border-border">
            {rows.map(({ occasion, index }) => {
              const editing = renaming?.id === occasion.id;
              return (
                <li key={occasion.id} className="flex items-center gap-2 px-2 py-2">
                  {canWrite && !filtered ? (
                    <div className="flex shrink-0 flex-col">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        onClick={() => move(index, -1)}
                        disabled={busy || index === 0}
                        aria-label={`Move ${occasion.name} up`}
                        title="Move up"
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        onClick={() => move(index, 1)}
                        disabled={busy || index === list.length - 1}
                        aria-label={`Move ${occasion.name} down`}
                        title="Move down"
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                    </div>
                  ) : null}

                  {editing ? (
                    <Input
                      value={renaming.name}
                      onChange={(event) => setRenaming({ id: occasion.id, name: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") submitRename();
                        if (event.key === "Escape") {
                          event.stopPropagation();
                          setRenaming(null);
                        }
                      }}
                      aria-label={`New name for ${occasion.name}`}
                      className="h-8 min-w-0 flex-1"
                      autoFocus
                      disabled={busy}
                    />
                  ) : (
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm font-medium", !occasion.active && "text-muted-foreground")}>
                        {occasion.name}
                      </p>
                      <p className="text-xs text-muted-foreground tabular">
                        {occasion.bundleCount === 0
                          ? "Not used by any bundle"
                          : `${occasion.bundleCount} ${occasion.bundleCount === 1 ? "bundle" : "bundles"}`}
                      </p>
                    </div>
                  )}

                  {canWrite && editing ? (
                    <div className="flex shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={submitRename}
                        disabled={busy}
                        aria-label={`Save name for ${occasion.name}`}
                        title="Save"
                      >
                        {rename.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => setRenaming(null)}
                        disabled={busy}
                        aria-label="Cancel rename"
                        title="Cancel"
                      >
                        <X />
                      </Button>
                    </div>
                  ) : null}

                  {!editing ? (
                    canWrite ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggle.mutate(occasion)}
                          disabled={busy}
                          aria-label={`${occasion.name} is ${occasion.active ? "shown" : "hidden"} on the storefront. ${occasion.active ? "Hide" : "Show"} it`}
                          title={occasion.active ? "Click to hide on the storefront" : "Click to show on the storefront"}
                          className={cn(
                            "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                            occasion.active
                              ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                              : "border-border bg-muted text-muted-foreground hover:bg-muted/70",
                          )}
                        >
                          {occasion.active ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                          {occasion.active ? "Shown" : "Hidden"}
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => {
                            setError(null);
                            setRenaming({ id: occasion.id, name: occasion.name });
                          }}
                          disabled={busy}
                          aria-label={`Rename ${occasion.name}`}
                          title="Rename"
                        >
                          <Pencil />
                        </Button>
                      </div>
                    ) : (
                      <Badge className="shrink-0">{occasion.active ? "Shown" : "Hidden"}</Badge>
                    )
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}

        {!occasions.isPending && !occasions.isError && list.length > 0 && rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-5 text-center text-sm text-muted-foreground">
            No occasions match.
          </p>
        ) : null}

        {!occasions.isPending && !occasions.isError && !list.length ? (
          <p className="text-sm text-muted-foreground">No occasions yet.</p>
        ) : null}
      </div>
    </Dialog>
  );
}

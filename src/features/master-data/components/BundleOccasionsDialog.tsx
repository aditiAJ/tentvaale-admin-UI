"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Loader2, Pencil, Plus, X } from "lucide-react";
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

  return (
    <Dialog
      open
      onClose={onClose}
      title="Bundle occasions"
      description="The storefront's bundle filters, in the order it shows them."
      className="max-w-lg"
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-3">
        {error ? <Alert tone="error" title={error} /> : null}
        {occasions.isError ? (
          <Alert
            tone="error"
            title={
              occasions.error instanceof Error
                ? occasions.error.message
                : "Could not load the occasions."
            }
          />
        ) : null}

        {occasions.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        ) : null}

        {list.length ? (
          <ul className="divide-y divide-border rounded-md border border-border">
            {list.map((occasion, index) => {
              const editing = renaming?.id === occasion.id;
              return (
                <li key={occasion.id} className="flex items-center gap-2 px-2 py-1.5">
                  {canWrite ? (
                    <div className="flex">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => move(index, -1)}
                        disabled={busy || index === 0}
                        aria-label={`Move ${occasion.name} up`}
                        title="Move up"
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => move(index, 1)}
                        disabled={busy || index === list.length - 1}
                        aria-label={`Move ${occasion.name} down`}
                        title="Move down"
                      >
                        <ArrowDown />
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
                      <span className={occasion.active ? "text-sm" : "text-sm text-muted-foreground"}>
                        {occasion.name}
                      </span>
                      <span className="tabular ml-2 text-xs text-muted-foreground">
                        {occasion.bundleCount} {occasion.bundleCount === 1 ? "bundle" : "bundles"}
                      </span>
                      {occasion.active ? null : <Badge className="ml-2 align-middle">Hidden</Badge>}
                    </div>
                  )}

                  {canWrite && editing ? (
                    <div className="flex">
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

                  {canWrite && !editing ? (
                    <div className="flex">
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => toggle.mutate(occasion)}
                        disabled={busy}
                        aria-label={`${occasion.active ? "Hide" : "Show"} ${occasion.name} on the storefront`}
                        title={occasion.active ? "Hide on storefront" : "Show on storefront"}
                      >
                        {occasion.active ? <EyeOff /> : <Eye />}
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}

        {!occasions.isPending && !occasions.isError && !list.length ? (
          <p className="text-sm text-muted-foreground">No occasions yet.</p>
        ) : null}

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
              placeholder="New occasion"
              className="min-w-0 flex-1"
              disabled={busy}
            />
            <Button variant="outline" onClick={submitNew} disabled={busy}>
              {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              Add occasion
            </Button>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}

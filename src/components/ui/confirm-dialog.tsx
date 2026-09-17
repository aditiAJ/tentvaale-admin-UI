"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/services/api-client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

/**
 * "Are you sure?" for one irreversible action.
 *
 * It owns the mutation rather than taking a callback, because the thing every
 * one of these has to get right is the same: stay open on failure and show the
 * server's own words. A refusal here is usually a rule the record could not
 * have known about — a warehouse that is still referenced, a category that is
 * already inactive — and closing the dialog would throw that sentence away.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  destructive = true,
  fallbackError,
  action,
  onDone,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  /** Shown when the failure was not an ApiError with a message for the user. */
  fallbackError: string;
  action: () => Promise<unknown>;
  onDone: () => void;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: action,
    onSuccess: () => onDone(),
    onError: (mutationError) =>
      setError(mutationError instanceof ApiError ? mutationError.message : fallbackError),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={mutation.isPending}
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
          >
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </>
      }
    >
      {error ? <Alert tone="error" title={error} /> : null}
    </Dialog>
  );
}

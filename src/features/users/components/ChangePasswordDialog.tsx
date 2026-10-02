"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { changeOwnPassword } from "@/features/users/api";
import { ApiError } from "@/services/api-client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

/**
 * The signed-in user changing their own password. It asks for the current one, so a screen left
 * open cannot be used to take over the account; an administrator who needs to unlock someone else
 * uses Reset on the Users screen instead.
 *
 * Mounted only while open, so each use starts from empty fields.
 */
export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => changeOwnPassword(current, next),
    onSuccess: () => {
      toast.success("Your password was changed");
      onClose();
    },
    onError: (mutationError) =>
      setError(
        mutationError instanceof ApiError ? mutationError.message : "Could not change the password.",
      ),
  });

  // Checked here against the backend's own rules so the request is not sent just to come back refused.
  const tooShort = next.length > 0 && next.length < 12;
  const mismatch = again.length > 0 && again !== next;
  const ready = current.length > 0 && next.length >= 12 && again === next;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Change my password"
      description="You stay signed in. Use the new password next time you sign in."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            disabled={!ready || mutation.isPending}
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
          >
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            Change password
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <Alert tone="error" title={error} /> : null}

        <Field label="Current password" required>
          {(props) => (
            <Input
              {...props}
              type="password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              autoComplete="current-password"
            />
          )}
        </Field>

        <Field label="New password" required error={tooShort ? "At least 12 characters" : undefined}>
          {(props) => (
            <Input
              {...props}
              type="password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
              autoComplete="new-password"
            />
          )}
        </Field>

        <Field
          label="New password again"
          required
          error={mismatch ? "The two passwords are not the same" : undefined}
        >
          {(props) => (
            <Input
              {...props}
              type="password"
              value={again}
              onChange={(event) => setAgain(event.target.value)}
              autoComplete="new-password"
            />
          )}
        </Field>
      </div>
    </Dialog>
  );
}

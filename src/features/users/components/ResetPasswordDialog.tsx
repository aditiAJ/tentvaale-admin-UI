"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { resetUserPassword } from "@/features/users/api";
import { generatePassword } from "@/features/users/components/password";
import type { AdminUserView } from "@/features/users/types";
import { ApiError } from "@/services/api-client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

interface Props {
  user: AdminUserView;
  onClose: () => void;
}

/**
 * Mounted only while a user is selected, so each reset starts from an empty
 * field without an effect having to clear the previous one.
 */
export function ResetPasswordDialog({ user, onClose }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (value: string) => resetUserPassword(user.id, value),
    onSuccess: () => {
      toast.success(`Password reset for ${user.username}`, {
        description: "Share it securely — it is not recoverable from here.",
      });
      onClose();
    },
    onError: (mutationError) =>
      setError(
        mutationError instanceof ApiError ? mutationError.message : "Could not reset the password.",
      ),
  });

  // Validated client-side against the backend's own @Size(min = 12) so the
  // request is not sent just to come back a 400.
  const tooShort = password.length > 0 && password.length < 12;

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Reset password for ${user.username}`}
      description="An administrative reset. The user is not notified by the system."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setError(null);
              mutation.mutate(password);
            }}
            disabled={mutation.isPending || password.length < 12}
          >
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            Reset password
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <Alert tone="error" title={error} /> : null}

        <Field
          label="New password"
          required
          error={tooShort ? "At least 12 characters" : undefined}
          hint="Copy it before closing this dialog — it cannot be shown again."
        >
          {(props) => (
            <div className="flex gap-2">
              <Input
                {...props}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setPassword(generatePassword())}
              >
                <Sparkles />
                Generate
              </Button>
            </div>
          )}
        </Field>
      </div>
    </Dialog>
  );
}

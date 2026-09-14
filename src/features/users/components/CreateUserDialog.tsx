"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createUser, userKeys } from "@/features/users/api";
import { generatePassword } from "@/features/users/components/password";
import { ApiError } from "@/services/api-client";
import { ROLES, ROLE_DESCRIPTIONS, type Role } from "@/services/permissions";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

// Mirrors the backend's CreateAdminUserRequest constraints exactly, so a
// rejection is shown beside the field rather than as a 400 after a round trip.
const schema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Username is required")
    .max(100, "Maximum 100 characters")
    .regex(/^[A-Za-z0-9._-]+$/, "Letters, digits, dot, underscore and hyphen only"),
  email: z.email("Enter a valid email address").max(255, "Maximum 255 characters"),
  password: z
    .string()
    .min(12, "At least 12 characters")
    .max(100, "Maximum 100 characters"),
  role: z.enum(ROLES),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { username: "", email: "", password: "", role: "SALES" };

/** Mounted only while open, so a fresh mount is what clears the form. */
export function CreateUserDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  // The hint under the select has to follow the chosen role. RHF's watch()
  // returns a function the React Compiler refuses to memoize, which opts this
  // whole component out of compilation, so the selection is tracked locally and
  // RHF's own onChange is chained rather than replaced.
  const [role, setRole] = useState<Role>(EMPTY.role);
  const { onChange: registeredRoleChange, ...roleField } = register("role");

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      toast.success(`${user.username} created`, {
        description: "Share the password securely — it cannot be retrieved later.",
      });
      onClose();
    },
    onError: (error) =>
      setFormError(error instanceof ApiError ? error.message : "Could not create the user."),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="New back-office user"
      description="Created inside your own company. Roles decide what they can reach."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button form="create-user" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            Create user
          </Button>
        </>
      }
    >
      <form
        id="create-user"
        onSubmit={handleSubmit((values) => {
          setFormError(null);
          mutation.mutate(values);
        })}
        className="space-y-4"
        noValidate
      >
        {formError ? <Alert tone="error" title={formError} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Username" required error={errors.username?.message}>
            {(props) => <Input {...props} {...register("username")} placeholder="asha.k" />}
          </Field>

          <Field label="Email" required error={errors.email?.message}>
            {(props) => (
              <Input {...props} {...register("email")} type="email" placeholder="asha@example.com" />
            )}
          </Field>
        </div>

        <Field
          label="Temporary password"
          required
          error={errors.password?.message}
          hint="At least 12 characters. Shown only now — the user should change it after signing in."
        >
          {(props) => (
            <div className="flex gap-2">
              <Input {...props} {...register("password")} autoComplete="new-password" />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setValue("password", generatePassword(), { shouldValidate: true })
                }
              >
                <Sparkles />
                Generate
              </Button>
            </div>
          )}
        </Field>

        <Field label="Role" required error={errors.role?.message} hint={ROLE_DESCRIPTIONS[role]}>
          {(props) => (
            <Select
              {...props}
              {...roleField}
              onChange={(event) => {
                void registeredRoleChange(event);
                setRole(event.target.value as Role);
              }}
            >
              {ROLES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </form>
    </Dialog>
  );
}

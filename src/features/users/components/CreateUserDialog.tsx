"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { changeUserAccess, createUser, getAccessOptions, userKeys } from "@/features/users/api";
import { ROLE_ORDER, changesFromDefault } from "@/features/users/access";
import { AccessBoxes, AccessHeadings } from "@/features/users/components/AccessBoxes";
import { ROLE_STYLE } from "@/features/users/components/roleStyle";
import { generatePassword } from "@/features/users/components/password";
import type { AccessOptions, AdminUserView } from "@/features/users/types";
import { ApiError } from "@/services/api-client";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type Permission, type Role } from "@/services/permissions";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
});

type AccountValues = z.infer<typeof schema>;

const FORM = "user-access";

/**
 * "New user" and "Edit access": the same form, where an Administrator gives a person their job title and ticks what
 * they may do. Mounted only while open, so a fresh mount is what clears the form.
 */
export function UserDialog({ user, onClose }: { user?: AdminUserView; onClose: () => void }) {
  const options = useQuery({
    queryKey: userKeys.accessOptions,
    queryFn: ({ signal }) => getAccessOptions(signal),
    staleTime: 5 * 60_000,
  });

  // The form starts from the list of boxes, so it is only drawn once that has arrived.
  if (!options.data) {
    return (
      <Dialog open onClose={onClose} title={user ? `Edit access: ${user.username}` : "New back-office user"}>
        {options.isError ? (
          <Alert tone="error" title="Could not load the list of access. Close this and try again." />
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </p>
        )}
      </Dialog>
    );
  }
  return <UserForm user={user} options={options.data} onClose={onClose} />;
}

function UserForm({ user, options, onClose }: { user?: AdminUserView; options: AccessOptions; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const allBoxes = options.modules.flatMap((m) => m.boxes.map((b) => b.permission));
  const defaultsOf = (role: Role) => new Set<Permission>(options.roleDefaults[role]);
  const [role, setRole] = useState<Role>(user?.role ?? "SALES");
  const [selected, setSelected] = useState<Set<Permission>>(() =>
    user ? new Set(user.permissions.filter((p) => allBoxes.includes(p))) : defaultsOf("SALES"),
  );
  /** True once a box was ticked or unticked by hand, so choosing another role must not silently discard it. */
  const [touched, setTouched] = useState(Boolean(user));
  const isAdmin = role === "ADMIN";
  const count = isAdmin ? allBoxes.length : selected.size;
  const usual = defaultsOf(role);
  const changes = changesFromDefault(selected, options.roleDefaults[role]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<AccountValues>({
    resolver: zodResolver(schema),
    // Editing access never changes the account's details; these only satisfy the validation.
    defaultValues: user
      ? { username: user.username, email: user.email, password: "not-changed-here" }
      : { username: "", email: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: AccountValues) => {
      const permissions = isAdmin ? [] : [...selected];
      return user
        ? changeUserAccess(user.id, role, permissions)
        : createUser({ ...values, role, permissions: isAdmin ? undefined : permissions });
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      toast.success(user ? `Access saved for ${saved.username}` : `${saved.username} created`, {
        description: user
          ? "They are asked to sign in again on their next action."
          : "Share the password securely — it cannot be retrieved later.",
      });
      onClose();
    },
    onError: (error) =>
      setFormError(error instanceof ApiError ? error.message : "Could not save the user."),
  });

  const edit = (next: Set<Permission>) => {
    setSelected(next);
    setTouched(true);
  };

  const chooseRole = (next: Role) => {
    if (next !== "ADMIN" && role !== next && touched
      && !window.confirm(`Replace the ticks with what a ${ROLE_LABELS[next]} starts with?`)) {
      return;
    }
    setRole(next);
    if (next !== "ADMIN") {
      setSelected(defaultsOf(next));
      setTouched(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      className="flex max-h-[calc(100dvh-2rem)] max-w-5xl flex-col"
      bodyClassName="min-h-0 flex-1 overflow-y-auto p-0"
      title={user ? `Edit access: ${user.username}` : "New back-office user"}
      description="The role fills in the usual ticks. Tick or untick anything for this person."
      footer={
        <>
          <p className="mr-auto self-center text-xs text-muted-foreground" aria-live="polite">
            {isAdmin ? "Full access" : count === 0 ? "Tick at least one box." : `${count} of ${allBoxes.length} ticked`}
          </p>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button form={FORM} type="submit" disabled={mutation.isPending || count === 0}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            {user ? "Save access" : "Create user"}
          </Button>
        </>
      }
    >
      <form
        id={FORM}
        onSubmit={handleSubmit((values) => {
          setFormError(null);
          mutation.mutate(values);
        })}
        noValidate
      >
        <div className="space-y-4 px-4 py-4">
          {formError ? <Alert tone="error" title={formError} /> : null}

          {user ? null : (
            <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1.25fr_1.5fr]">
              <Field label="Username" required error={errors.username?.message}>
                {(props) => <Input {...props} {...register("username")} placeholder="asha.k" />}
              </Field>

              <Field label="Email" required error={errors.email?.message}>
                {(props) => (
                  <Input {...props} {...register("email")} type="email" placeholder="asha@example.com" />
                )}
              </Field>

              <Field
                label="Temporary password"
                required
                error={errors.password?.message}
                hint="At least 12 characters."
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
            </div>
          )}

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold">Role</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {ROLE_ORDER.map((value) => {
                const { icon: Icon, summary } = ROLE_STYLE[value];
                const chosen = role === value;
                return (
                  <label
                    key={value}
                    className={cn(
                      "flex cursor-pointer flex-col gap-1.5 rounded-lg border p-2.5 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring/50",
                      chosen ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border bg-card hover:border-primary/50",
                    )}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={value}
                      checked={chosen}
                      onChange={() => chooseRole(value)}
                      className="sr-only"
                    />
                    <Icon className={cn("size-4", chosen ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                    <span className="text-sm leading-tight font-medium">{ROLE_LABELS[value]}</span>
                    <span className="text-xs leading-tight text-muted-foreground">{summary}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
          </fieldset>
        </div>

        {isAdmin ? (
          <div className="mx-4 mb-4 flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
            <ShieldCheck className="size-6 shrink-0 text-primary" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-semibold">An Admin always has full access</p>
              <p className="text-sm text-muted-foreground">
                All {allBoxes.length} permissions, including adding people and changing what they can do. There is nothing
                to tick.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Stays in view while the table scrolls: the count, the buttons and the column headings. */}
            <div className="sticky top-0 z-10 border-y border-border bg-card px-4">
            <div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="text-sm font-semibold">Access</h3>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">
                  {count} of {allBoxes.length}
                </span>
                <span className="text-xs text-muted-foreground">
                  {changes.added + changes.removed === 0
                    ? `Same as a ${ROLE_LABELS[role]} usually has`
                    : [changes.added ? `${changes.added} added` : null, changes.removed ? `${changes.removed} removed` : null]
                        .filter(Boolean)
                        .join(", ") + " compared with the role default"}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button type="button" variant="outline" size="sm" onClick={() => edit(new Set(allBoxes))}>
                  Select all
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => edit(new Set())}>
                  Clear
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={changes.added + changes.removed === 0}
                  onClick={() => {
                    setSelected(defaultsOf(role));
                    setTouched(false);
                  }}
                >
                  Reset to role default
                </Button>
              </div>
            </div>
              <div className="pb-2 empty:hidden max-md:hidden">
                <AccessHeadings />
              </div>
            </div>
            <div className="space-y-3 px-4 py-3">
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <TriangleAlert className="size-3.5 text-warning" aria-hidden="true" />
                  Sensitive: ends records, returns money or changes company settings
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-3 rounded-sm ring-2 ring-warning/60" aria-hidden="true" />
                  Changed from the role default
                </span>
                <span>Managing users is for Admins only.</span>
              </p>
              <AccessBoxes modules={options.modules} selected={selected} usual={usual} onChange={edit} />
            </div>
          </>
        )}
      </form>
    </Dialog>
  );
}

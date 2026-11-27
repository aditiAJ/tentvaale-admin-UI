"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, SlidersHorizontal, UserCheck, UserMinus, Users } from "lucide-react";
import { toast } from "sonner";
import {
  deactivateUser,
  getAccessOptions,
  listUsers,
  reactivateUser,
  userKeys,
} from "@/features/users/api";
import type { AdminUserView } from "@/features/users/types";
import { differsFromDefault, sortUsers } from "@/features/users/access";
import { ROLE_STYLE } from "@/features/users/components/roleStyle";
import { UserDialog } from "@/features/users/components/CreateUserDialog";
import { ResetPasswordDialog } from "@/features/users/components/ResetPasswordDialog";
import { useSession } from "@/features/auth";
import { ApiError } from "@/services/api-client";
import { ROLE_DESCRIPTIONS, roleLabel, type Permission } from "@/services/permissions";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TableWrapper, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const COLUMNS = 5;

export function UsersPage() {
  const { session, can } = useSession();
  const queryClient = useQueryClient();
  const canWrite = can("USER_WRITE");

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUserView | null>(null);
  // Kept stable: the dialog moves the focus whenever its close handler changes.
  const closeUserDialog = useCallback(() => {
    setCreating(false);
    setEditing(null);
  }, []);
  const [resetting, setResetting] = useState<AdminUserView | null>(null);
  const [deactivating, setDeactivating] = useState<AdminUserView | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: userKeys.all,
    queryFn: ({ signal }) => listUsers(signal),
  });

  /**
   * The backend refuses to demote or deactivate the last active ADMIN. Counting
   * them here lets the UI explain why the control is unavailable instead of
   * offering an action that comes back a 422 — the server check still stands,
   * this only moves the reason earlier.
   */
  const lastActiveAdminId = useMemo(() => {
    const admins = (data ?? []).filter((user) => user.active && user.role === "ADMIN");
    return admins.length === 1 ? admins[0].id : null;
  }, [data]);

  const onMutationError = (mutationError: unknown, fallback: string) =>
    toast.error(mutationError instanceof ApiError ? mutationError.message : fallback);

  const accessOptions = useQuery({
    queryKey: userKeys.accessOptions,
    queryFn: ({ signal }) => getAccessOptions(signal),
    staleTime: 5 * 60_000,
  });
  const allBoxes = useMemo(
    () => new Set<Permission>(accessOptions.data?.modules.flatMap((m) => m.boxes.map((b) => b.permission)) ?? []),
    [accessOptions.data],
  );
  const users = useMemo(() => sortUsers(data ?? []), [data]);
  const activeCount = users.filter((user) => user.active).length;
  const isChanged = (user: AdminUserView) =>
    user.role !== "ADMIN" && accessOptions.data !== undefined
    && differsFromDefault(user.permissions, accessOptions.data.roleDefaults[user.role], allBoxes);

  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => deactivateUser(userId),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      toast.success(`${user.username} deactivated`);
      setDeactivating(null);
    },
    onError: (mutationError) => onMutationError(mutationError, "Could not deactivate the user."),
  });

  const reactivateMutation = useMutation({
    mutationFn: (userId: string) => reactivateUser(userId),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      toast.success(`${user.username} is active again as ${roleLabel(user.role)}`);
    },
    onError: (mutationError) => onMutationError(mutationError, "Could not reactivate the user."),
  });

  function reasonAccessLocked(user: AdminUserView): string | null {
    if (!canWrite) return "You do not have permission to change access.";
    if (!user.active) return "Inactive users cannot be changed.";
    if (user.id === session?.userId) return "You cannot change your own access.";
    if (user.id === lastActiveAdminId) return "The only active ADMIN cannot be demoted.";
    return null;
  }

  function reasonDeactivateLocked(user: AdminUserView): string | null {
    if (!canWrite) return "You do not have permission to deactivate users.";
    if (!user.active) return "Already inactive.";
    if (user.id === session?.userId) return "You cannot deactivate your own account.";
    if (user.id === lastActiveAdminId) return "The only active ADMIN cannot be deactivated.";
    return null;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Users"
        description="Back-office accounts in your company. Each person can do what is ticked for them."
        actions={
          canWrite ? (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              New user
            </Button>
          ) : null
        }
      />

      <Card className="overflow-hidden">
        {users.length > 0 ? (
          <p className="border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
            {users.length} {users.length === 1 ? "user" : "users"}, {activeCount} active
          </p>
        ) : null}
        <TableWrapper>
          <Table>
            <THead className="bg-muted/50">
              <tr>
                <TH className="pl-4">User</TH>
                <TH>Role</TH>
                <TH>Access</TH>
                <TH>Status</TH>
                <TH className="pr-4 text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {isPending ? <TableSkeleton columns={COLUMNS} /> : null}

              {users.map((user) => {
                const accessLocked = reasonAccessLocked(user);
                const deactivateLocked = reasonDeactivateLocked(user);
                const isSelf = user.id === session?.userId;
                const isAdmin = user.role === "ADMIN";
                const RoleIcon = ROLE_STYLE[user.role]?.icon;
                const ticked = user.permissions.filter((p) => allBoxes.has(p)).length;

                return (
                  <TR key={user.id} className={user.active ? undefined : "opacity-60"}>
                    <TD className="py-3 pl-4">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold uppercase",
                            isAdmin ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
                          )}
                        >
                          {user.username.charAt(0)}
                        </span>
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 font-medium">
                            {user.username}
                            {isSelf ? <Badge variant="outline">You</Badge> : null}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TD>
                    <TD className="py-3">
                      <span
                        title={ROLE_DESCRIPTIONS[user.role]}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium whitespace-nowrap",
                          isAdmin ? "border-primary/40 bg-primary/10" : "border-border bg-card",
                        )}
                      >
                        {RoleIcon ? <RoleIcon className="size-3.5 text-primary" aria-hidden="true" /> : null}
                        {roleLabel(user.role)}
                      </span>
                    </TD>
                    <TD className="py-3">
                      {isAdmin ? (
                        <span className="text-sm font-medium">Full access</span>
                      ) : allBoxes.size === 0 ? (
                        <span className="text-muted-foreground">…</span>
                      ) : (
                        <div className="w-40 space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="tabular text-muted-foreground">
                              {ticked} of {allBoxes.size}
                            </span>
                            {isChanged(user) ? (
                              <Badge variant="warning" title="Ticks differ from what this role starts with">
                                Customised
                              </Badge>
                            ) : null}
                          </div>
                          <span className="block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                            <span className="block h-full rounded-full bg-primary" style={{ width: `${(ticked / allBoxes.size) * 100}%` }} />
                          </span>
                        </div>
                      )}
                    </TD>
                    <TD className="py-3">
                      {user.active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="default">Inactive</Badge>
                      )}
                    </TD>
                    <TD className="py-3 pr-4">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={accessLocked !== null}
                          title={accessLocked ?? undefined}
                          onClick={() => setEditing(user)}
                        >
                          <SlidersHorizontal />
                          Edit access
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!canWrite || !user.active}
                          title={canWrite ? "Reset password" : "You do not have permission to reset passwords."}
                          onClick={() => setResetting(user)}
                        >
                          <KeyRound />
                          Reset
                        </Button>
                        {user.active ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={deactivateLocked !== null}
                            title={deactivateLocked ?? undefined}
                            onClick={() => setDeactivating(user)}
                          >
                            <UserMinus />
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!canWrite || reactivateMutation.isPending}
                            title={canWrite ? undefined : "You do not have permission to reactivate users."}
                            onClick={() => reactivateMutation.mutate(user.id)}
                          >
                            <UserCheck />
                            Reactivate
                          </Button>
                        )}
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </TableWrapper>

        {isError ? (
          <EmptyState
            title="Could not load users"
            description={error instanceof Error ? error.message : undefined}
            action={
              <Button variant="outline" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        ) : null}

        {!isPending && !isError && (data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={<Users />}
            title="No users found"
            description="Only your own company's accounts are ever listed here."
          />
        ) : null}
      </Card>

      {creating || editing ? <UserDialog user={editing ?? undefined} onClose={closeUserDialog} /> : null}
      {resetting ? (
        <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />
      ) : null}

      <Dialog
        open={deactivating !== null}
        onClose={() => setDeactivating(null)}
        title={`Deactivate ${deactivating?.username ?? ""}?`}
        description="They lose access on their next request, because login and token checks both require an active account."
        footer={
          <>
            <Button variant="outline" onClick={() => setDeactivating(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deactivateMutation.isPending}
              onClick={() => deactivateMutation.mutate(deactivating!.id)}
            >
              Deactivate
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          You can bring them back later with Reactivate; they keep their role and password.
        </p>
      </Dialog>
    </div>
  );
}

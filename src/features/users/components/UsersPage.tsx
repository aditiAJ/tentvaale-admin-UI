"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, UserMinus, Users } from "lucide-react";
import { toast } from "sonner";
import { changeUserRole, deactivateUser, listUsers, userKeys } from "@/features/users/api";
import type { AdminUserView } from "@/features/users/types";
import { CreateUserDialog } from "@/features/users/components/CreateUserDialog";
import { ResetPasswordDialog } from "@/features/users/components/ResetPasswordDialog";
import { useSession } from "@/features/auth";
import { ApiError } from "@/services/api-client";
import { ROLES, ROLE_DESCRIPTIONS, type Role } from "@/services/permissions";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
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

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) => changeUserRole(userId, role),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      toast.success(`${user.username} is now ${user.role}`);
    },
    onError: (mutationError) => onMutationError(mutationError, "Could not change the role."),
  });

  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => deactivateUser(userId),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      toast.success(`${user.username} deactivated`);
      setDeactivating(null);
    },
    onError: (mutationError) => onMutationError(mutationError, "Could not deactivate the user."),
  });

  function reasonRoleLocked(user: AdminUserView): string | null {
    if (!canWrite) return "You do not have permission to change roles.";
    if (!user.active) return "Inactive users cannot be changed.";
    if (user.id === session?.userId) return "You cannot change your own role.";
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
        description="Back-office accounts in your company. Roles grant permissions; endpoints check permissions, never roles."
        actions={
          canWrite ? (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              New user
            </Button>
          ) : null
        }
      />

      <Alert tone="info" title="Deactivation is one-way from here">
        Users are deactivated rather than deleted, because audit columns on other records reference
        them. There is no reactivate endpoint yet, so an account switched off here has to be
        restored in the database.
      </Alert>

      <Card>
        <TableWrapper>
          <Table>
            <THead>
              <tr>
                <TH>Username</TH>
                <TH>Email</TH>
                <TH>Role</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {isPending ? <TableSkeleton columns={COLUMNS} /> : null}

              {(data ?? []).map((user) => {
                const roleLocked = reasonRoleLocked(user);
                const deactivateLocked = reasonDeactivateLocked(user);
                const isSelf = user.id === session?.userId;

                return (
                  <TR key={user.id} className={user.active ? undefined : "opacity-60"}>
                    <TD>
                      <span className="font-medium">{user.username}</span>
                      {isSelf ? (
                        <Badge variant="outline" className="ml-2">
                          You
                        </Badge>
                      ) : null}
                    </TD>
                    <TD className="text-muted-foreground">{user.email}</TD>
                    <TD>
                      <Select
                        aria-label={`Role for ${user.username}`}
                        value={user.role}
                        disabled={roleLocked !== null || roleMutation.isPending}
                        title={roleLocked ?? ROLE_DESCRIPTIONS[user.role]}
                        onChange={(event) =>
                          roleMutation.mutate({
                            userId: user.id,
                            role: event.target.value as Role,
                          })
                        }
                        className="h-8 w-36"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </Select>
                    </TD>
                    <TD>
                      {user.active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="default">Inactive</Badge>
                      )}
                    </TD>
                    <TD>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!canWrite || !user.active}
                          title={canWrite ? undefined : "You do not have permission to reset passwords."}
                          onClick={() => setResetting(user)}
                        >
                          <KeyRound />
                          Reset
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deactivateLocked !== null}
                          title={deactivateLocked ?? undefined}
                          onClick={() => setDeactivating(user)}
                        >
                          <UserMinus />
                          Deactivate
                        </Button>
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

      {creating ? <CreateUserDialog onClose={() => setCreating(false)} /> : null}
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
          This cannot be undone from the back office — there is no reactivate endpoint.
        </p>
      </Dialog>
    </div>
  );
}

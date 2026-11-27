import { apiFetch } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";
import {
  mockChangeUserAccess,
  mockGetAccessOptions,
  mockChangeOwnPassword,
  mockCreateUser,
  mockDeactivateUser,
  mockListUsers,
  mockReactivateUser,
  mockResetUserPassword,
} from "@/mock-data/store";
import type { Permission, Role } from "@/services/permissions";
import type { AccessOptions, AdminUserView, CreateAdminUserRequest } from "@/features/users/types";

/** The backend sends the company as a number; the screens treat every id as a string. */
type WireUser = Omit<AdminUserView, "companyId"> & { companyId: number | string };

function fromWire(user: WireUser): AdminUserView {
  return { ...user, companyId: String(user.companyId) };
}

export async function listUsers(signal?: AbortSignal): Promise<AdminUserView[]> {
  if (IS_MOCK) return mockListUsers();
  return (await apiFetch<WireUser[]>("/admin/users", { signal })).map(fromWire);
}

export async function createUser(request: CreateAdminUserRequest): Promise<AdminUserView> {
  if (IS_MOCK) return mockCreateUser(request);
  return fromWire(await apiFetch<WireUser>("/admin/users", { method: "POST", body: request }));
}

/**
 * Changes a user's job title and ticked boxes together. It takes effect on their next request, which asks them to sign
 * in again.
 */
export async function changeUserAccess(userId: string, role: Role, permissions: Permission[]): Promise<AdminUserView> {
  if (IS_MOCK) return mockChangeUserAccess(userId, role, permissions);
  return fromWire(
    await apiFetch<WireUser>(`/admin/users/${userId}/access`, { method: "PUT", body: { role, permissions } }),
  );
}

export function getAccessOptions(signal?: AbortSignal): Promise<AccessOptions> {
  if (IS_MOCK) return mockGetAccessOptions();
  return apiFetch<AccessOptions>("/admin/users/access-options", { signal });
}

/**
 * Deactivation, not deletion — audit columns on other records reference users. The user is locked
 * out at once: login fails and the token they hold is refused.
 */
export async function deactivateUser(userId: string): Promise<AdminUserView> {
  if (IS_MOCK) return mockDeactivateUser(userId);
  return fromWire(await apiFetch<WireUser>(`/admin/users/${userId}/deactivate`, { method: "POST" }));
}

/** Brings a deactivated user back with the role and password they had. */
export async function reactivateUser(userId: string): Promise<AdminUserView> {
  if (IS_MOCK) return mockReactivateUser(userId);
  return fromWire(await apiFetch<WireUser>(`/admin/users/${userId}/reactivate`, { method: "POST" }));
}

/**
 * The signed-in user changes their own password. 422 if the current one is wrong or the new one is
 * the same; 400 if the new one is under 12 characters. Returns 204 No Content.
 */
export function changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
  if (IS_MOCK) return mockChangeOwnPassword(currentPassword, newPassword);
  return apiFetch<void>("/admin/users/me/password", {
    method: "POST",
    body: { currentPassword, newPassword },
  });
}

/** Returns 204 No Content. */
export function resetUserPassword(userId: string, password: string): Promise<void> {
  if (IS_MOCK) return mockResetUserPassword(userId, password);
  return apiFetch<void>(`/admin/users/${userId}/reset-password`, {
    method: "POST",
    body: { password },
  });
}

export const userKeys = {
  all: ["users"] as const,
  accessOptions: ["users", "access-options"] as const,
};

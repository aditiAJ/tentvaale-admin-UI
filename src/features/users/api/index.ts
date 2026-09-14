import { apiFetch } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";
import {
  mockChangeUserRole,
  mockCreateUser,
  mockDeactivateUser,
  mockListUsers,
  mockResetUserPassword,
} from "@/mock-data/store";
import type { Role } from "@/services/permissions";
import type { AdminUserView, CreateAdminUserRequest } from "@/features/users/types";

export function listUsers(signal?: AbortSignal): Promise<AdminUserView[]> {
  if (IS_MOCK) return mockListUsers();
  return apiFetch<AdminUserView[]>("/admin/users", { signal });
}

export function createUser(request: CreateAdminUserRequest): Promise<AdminUserView> {
  if (IS_MOCK) return mockCreateUser(request);
  return apiFetch<AdminUserView>("/admin/users", { method: "POST", body: request });
}

export function changeUserRole(userId: string, role: Role): Promise<AdminUserView> {
  if (IS_MOCK) return mockChangeUserRole(userId, role);
  return apiFetch<AdminUserView>(`/admin/users/${userId}/role`, {
    method: "POST",
    body: { role },
  });
}

/** Deactivation, not deletion — audit columns on other records reference users. */
export function deactivateUser(userId: string): Promise<AdminUserView> {
  if (IS_MOCK) return mockDeactivateUser(userId);
  return apiFetch<AdminUserView>(`/admin/users/${userId}/deactivate`, { method: "POST" });
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
};

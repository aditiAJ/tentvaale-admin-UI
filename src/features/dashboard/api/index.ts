import { apiFetch } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";
import { mockGetDashboard } from "@/mock-data/store";
import type { AdminDashboardView } from "@/features/dashboard/types";

export function getDashboard(signal?: AbortSignal): Promise<AdminDashboardView> {
  if (IS_MOCK) return mockGetDashboard();
  return apiFetch<AdminDashboardView>("/admin/reporting/dashboard", { signal });
}

export const dashboardKeys = {
  all: ["reporting", "dashboard"] as const,
};

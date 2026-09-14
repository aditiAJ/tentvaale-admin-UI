import { apiFetch } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";
import { mockListNotifications, mockListNotificationsBySubject } from "@/mock-data/store";
import type { NotificationLogView } from "@/features/notifications/types";

/** Most recent attempts for this company, newest first, capped by `limit`. */
export function listNotifications(limit: number, signal?: AbortSignal) {
  if (IS_MOCK) return mockListNotifications(limit);
  return apiFetch<NotificationLogView[]>(`/admin/notifications/log?limit=${limit}`, { signal });
}

/** Every attempt tied to one subject reference — the audit trail for a document. */
export function listNotificationsBySubject(subjectReference: string, signal?: AbortSignal) {
  if (IS_MOCK) return mockListNotificationsBySubject(subjectReference);
  return apiFetch<NotificationLogView[]>(
    `/admin/notifications/log/by-subject?subjectReference=${encodeURIComponent(subjectReference)}`,
    { signal },
  );
}

export const notificationKeys = {
  recent: (limit: number) => ["notifications", "recent", limit] as const,
  bySubject: (subject: string) => ["notifications", "by-subject", subject] as const,
};

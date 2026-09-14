/** Mirrors com.tentvaale.notification.api.NotificationChannel. */
export const CHANNELS = ["EMAIL", "WHATSAPP"] as const;
export type NotificationChannel = (typeof CHANNELS)[number];

/** Mirrors com.tentvaale.notification.api.DeliveryStatus. */
export const DELIVERY_STATUSES = ["PENDING", "SENT", "FAILED", "SKIPPED"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const DELIVERY_STATUS_MEANING: Record<DeliveryStatus, string> = {
  PENDING: "Queued but not yet handed to a provider.",
  SENT: "Accepted by the provider.",
  FAILED: "The provider rejected it, or the attempt errored.",
  SKIPPED: "Not attempted — the channel is switched off, or there was no address.",
};

/**
 * One delivery attempt. Mirrors com.tentvaale.notification.api.NotificationLogView.
 *
 * `failureReason` is optional rather than nullable because the backend is
 * configured with Jackson's non_null inclusion, so the field is absent from the
 * JSON entirely when there is nothing to report — not present as null.
 *
 * `subjectReference` is free text (a quotation or order number) so the
 * notification module needs no typed dependency on the modules that trigger
 * messages. That is also why it cannot be turned into a link here.
 */
export interface NotificationLogView {
  id: string;
  companyId: string;
  channel: NotificationChannel;
  templateKey: string;
  recipient: string;
  subjectReference: string;
  status: DeliveryStatus;
  failureReason?: string;
  /** ISO-8601 instant. */
  attemptedAt: string;
}

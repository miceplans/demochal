// Postgres LISTEN/NOTIFY channel used to fan a committed notification out to every API
// instance. pg_notify runs inside the insert transaction, so it is delivered only on commit.
export const NOTIFICATION_CREATED_CHANNEL = 'notification_created';

// Deliberately id-only: no notification payload or PII travels over NOTIFY (8000-byte limit).
export interface NotificationCreatedEvent {
  userId: string;
  notificationId: string;
}

export function parseNotificationCreatedEvent(
  raw: string | undefined,
): NotificationCreatedEvent | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<NotificationCreatedEvent>;
    if (typeof value.userId === 'string' && typeof value.notificationId === 'string') {
      return { userId: value.userId, notificationId: value.notificationId };
    }
  } catch {
    // fall through — malformed payloads are ignored
  }
  return null;
}

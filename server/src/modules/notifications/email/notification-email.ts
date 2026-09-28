import { env } from '../../../config/env.js';

// Outbox event type relayed to SQS_EMAILS_QUEUE_URL by worker.ts.
export const NOTIFICATION_EMAIL_EVENT = 'notification.email';

// Service (transactional) emails only — decided in #124. Marketing mail,
// unsubscribe links and consent are intentionally out of scope.
export const EMAIL_NOTIFICATION_TYPES: ReadonlySet<string> = new Set([
  'verification.result',
  'team_matching',
]);

/**
 * Outbox payload. Only the notification id travels through the queue: the
 * worker re-reads the notification and the recipient's `users.email` from the
 * DB, so no email address is ever duplicated into outbox rows, SQS or logs.
 */
export interface NotificationEmailPayload {
  notificationId: string;
}

/** SQS body produced by `OutboxRelayService.relay(..., { includeEventId: true })`. */
export interface NotificationEmailJobMessage {
  eventId: string;
  payload: NotificationEmailPayload;
}

/**
 * Both values must be set for email delivery. When either is missing (local
 * dev, or before SES domain verification is done) no email outbox rows are
 * written, so enabling SES later does not flush a backlog of stale emails.
 */
export function isEmailDeliveryConfigured(): boolean {
  return Boolean(env.sesFromEmail && env.sqsEmailsQueueUrl);
}

export function parseNotificationEmailJob(raw: unknown): NotificationEmailJobMessage | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { eventId, payload } = raw as { eventId?: unknown; payload?: unknown };
  if (typeof eventId !== 'string' || typeof payload !== 'object' || payload === null) return null;
  const { notificationId } = payload as { notificationId?: unknown };
  if (typeof notificationId !== 'string') return null;
  return { eventId, payload: { notificationId } };
}

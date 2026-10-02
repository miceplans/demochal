import { env } from '../../../config/env.js';

// Outbox event type relayed to SQS_EMAILS_QUEUE_URL by worker.ts (same queue as
// notification emails; the consumer tells them apart by payload shape).
export const SUPPORT_EMAIL_EVENT = 'support.email.send';

/**
 * Outbox payload. Only the id of the already-persisted `email_messages` row
 * travels through outbox/SQS: the worker re-reads recipient, subject and body
 * from the DB, so no address or body is duplicated into outbox rows, SQS or logs.
 */
export interface SupportEmailPayload {
  emailMessageId: string;
}

/** SQS body produced by `OutboxRelayService.relay(..., { includeEventId: true })`. */
export interface SupportEmailJobMessage {
  eventId: string;
  payload: SupportEmailPayload;
}

/** The worker relays/sends support mail only when the support sender and the queue are set. */
export function isSupportEmailDeliveryConfigured(): boolean {
  return Boolean(env.sesSupportFromEmail && env.sqsEmailsQueueUrl);
}

export function parseSupportEmailJob(raw: unknown): SupportEmailJobMessage | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { eventId, payload } = raw as { eventId?: unknown; payload?: unknown };
  if (typeof eventId !== 'string' || typeof payload !== 'object' || payload === null) return null;
  const { emailMessageId } = payload as { emailMessageId?: unknown };
  if (typeof emailMessageId !== 'string') return null;
  return { eventId, payload: { emailMessageId } };
}

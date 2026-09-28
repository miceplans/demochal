import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, lt, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../../db/drizzle.provider.js';
import { emailSendStates, notifications, users } from '../../../db/schema.js';
import { env } from '../../../config/env.js';
import type { NotificationEmailJobMessage } from './notification-email.js';
import { renderNotificationEmail } from './notification-email.templates.js';
import { SesEmailClient } from './ses-email.client.js';

export type NotificationEmailOutcome =
  | 'sent'
  | 'already_sent'
  | 'not_configured'
  | 'notification_missing'
  | 'recipient_missing'
  | 'unsupported_type';

// A 'sending' claim older than this is treated as abandoned by a crashed
// worker and may be taken over. Must exceed one SES call by a wide margin.
export const EMAIL_SEND_LEASE_MS = 5 * 60_000;
// claimed_at is always written and compared with the DB clock (now()), so the
// lease is immune to worker clock skew and to the timestamp column's time zone.
const leaseCutoff = sql`now() - make_interval(secs => ${EMAIL_SEND_LEASE_MS / 1000})`;

/** Thrown when another delivery of the same event holds a live claim. */
export class EmailSendInFlightError extends Error {
  override readonly name = 'EmailSendInFlightError';
}

type ClaimResult = 'claimed' | 'sent' | 'in_flight';

// Consumed by worker.ts's email queue poll loop — never invoked over HTTP.
// Returning normally means "ack the message"; throwing leaves it on the queue
// for SQS retry and, after maxReceiveCount, the DLQ.
@Injectable()
export class NotificationEmailProcessorService {
  private readonly logger = new Logger(NotificationEmailProcessorService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly sesEmailClient: SesEmailClient,
  ) {}

  async process(message: NotificationEmailJobMessage): Promise<NotificationEmailOutcome> {
    if (!this.sesEmailClient.isConfigured()) return 'not_configured';

    const [notification] = await this.db
      .select()
      .from(notifications)
      .where(eq(notifications.id, message.payload.notificationId))
      .limit(1);
    if (!notification) {
      this.logger.warn(`Email event ${message.eventId}: notification not found, skipping`);
      return 'notification_missing';
    }

    const [recipient] = await this.db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, notification.userId))
      .limit(1);
    if (!recipient?.email) {
      // Log ids only — never the address itself.
      this.logger.warn(`Email event ${message.eventId}: recipient has no email, skipping`);
      return 'recipient_missing';
    }

    const rendered = renderNotificationEmail(
      notification.type,
      (notification.payload ?? {}) as Record<string, unknown>,
      env.frontendOrigins[0] ?? 'http://localhost:3000',
    );
    if (!rendered) {
      this.logger.warn(`Email event ${message.eventId}: unsupported type ${notification.type}`);
      return 'unsupported_type';
    }

    // Idempotency: SQS is at-least-once and relays can double-send, so the
    // event is claimed atomically before SES is called. Only the claim holder
    // sends; a crash after SES accepts but before 'sent' is recorded can still
    // resend once after the lease expires (accepted at-least-once trade-off).
    const claim = await this.claim(message.eventId);
    if (claim === 'sent') return 'already_sent';
    if (claim === 'in_flight') {
      // Not acked: SQS redelivers after the visibility timeout, by which time
      // the other attempt has either finished ('sent') or released its claim.
      throw new EmailSendInFlightError(`Email event ${message.eventId} is being sent elsewhere`);
    }

    try {
      await this.sesEmailClient.send({ to: recipient.email, ...rendered });
    } catch (error) {
      // SES error messages can echo the recipient address, so only the error
      // name is logged. Rethrow so the message is retried / dead-lettered.
      const name = error instanceof Error ? error.name : 'UnknownError';
      this.logger.error(`Email event ${message.eventId}: SES send failed (${name}), will retry`);
      await this.releaseClaim(message.eventId);
      throw error;
    }

    await this.db
      .update(emailSendStates)
      .set({ status: 'sent', sentAt: sql`now()` })
      .where(eq(emailSendStates.outboxEventId, message.eventId));
    return 'sent';
  }

  private async claim(eventId: string): Promise<ClaimResult> {
    const [inserted] = await this.db
      .insert(emailSendStates)
      .values({ outboxEventId: eventId, status: 'sending', claimedAt: sql`now()` })
      .onConflictDoNothing({ target: emailSendStates.outboxEventId })
      .returning({ id: emailSendStates.id });
    if (inserted) return 'claimed';

    // Row exists: take over only an abandoned 'sending' claim. The conditional
    // UPDATE is atomic, so at most one delivery wins a stale lease.
    const [takenOver] = await this.db
      .update(emailSendStates)
      .set({ claimedAt: sql`now()` })
      .where(
        and(
          eq(emailSendStates.outboxEventId, eventId),
          eq(emailSendStates.status, 'sending'),
          lt(emailSendStates.claimedAt, leaseCutoff),
        ),
      )
      .returning({ id: emailSendStates.id });
    if (takenOver) return 'claimed';

    const [existing] = await this.db
      .select({ status: emailSendStates.status })
      .from(emailSendStates)
      .where(eq(emailSendStates.outboxEventId, eventId))
      .limit(1);
    return existing?.status === 'sent' ? 'sent' : 'in_flight';
  }

  private async releaseClaim(eventId: string): Promise<void> {
    try {
      await this.db
        .delete(emailSendStates)
        .where(
          and(eq(emailSendStates.outboxEventId, eventId), eq(emailSendStates.status, 'sending')),
        );
    } catch {
      // Best effort: an unreleased claim simply expires after the lease.
      this.logger.warn(`Email event ${eventId}: failed to release send claim`);
    }
  }
}

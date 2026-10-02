import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../../db/drizzle.provider.js';
import { notifications, users } from '../../../db/schema.js';
import { env } from '../../../config/env.js';
import type { NotificationEmailJobMessage } from './notification-email.js';
import { renderNotificationEmail } from './notification-email.templates.js';
import {
  claimEmailSend,
  EMAIL_SEND_LEASE_MS,
  EmailSendInFlightError,
  markEmailSent,
  releaseEmailSendClaim,
} from './email-send-claim.js';
import { SesEmailClient } from './ses-email.client.js';

export { EMAIL_SEND_LEASE_MS, EmailSendInFlightError };

export type NotificationEmailOutcome =
  | 'sent'
  | 'already_sent'
  | 'not_configured'
  | 'notification_missing'
  | 'recipient_missing'
  | 'unsupported_type';

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
    const claim = await claimEmailSend(this.db, message.eventId);
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
      if (!(await releaseEmailSendClaim(this.db, message.eventId))) {
        this.logger.warn(`Email event ${message.eventId}: failed to release send claim`);
      }
      throw error;
    }

    await markEmailSent(this.db, message.eventId);
    return 'sent';
  }
}

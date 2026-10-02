import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../../db/drizzle.provider.js';
import { emailMessages } from '../../../db/schema.js';
import {
  claimEmailSend,
  EmailSendInFlightError,
  markEmailSent,
  releaseEmailSendClaim,
} from './email-send-claim.js';
import { SesEmailClient } from './ses-email.client.js';
import type { SupportEmailJobMessage } from './support-email.js';

export type SupportEmailOutcome =
  'sent' | 'already_sent' | 'not_configured' | 'message_missing' | 'recipient_missing';

const escapeHtml = (text: string) =>
  text.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]!);
const bracket = (value: string) => `<${value.replace(/^<|>$/g, '')}>`;

/**
 * Worker-side sender for admin support mail. The API only persists the
 * outbound `email_messages` row (delivery_status QUEUED) and an outbox event in
 * one transaction; this service sends it through SES from the worker, keyed on
 * the outbox event id like the notification email processor. Consumed by
 * worker.ts's email queue loop — never invoked over HTTP. Returning normally
 * means "ack the message"; throwing leaves it on the queue for SQS retry and,
 * after maxReceiveCount, the DLQ.
 */
@Injectable()
export class SupportEmailService {
  private readonly logger = new Logger(SupportEmailService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly sesEmailClient: SesEmailClient,
  ) {}

  async process(message: SupportEmailJobMessage): Promise<SupportEmailOutcome> {
    // Throw (not ack) so a message is not lost if config is removed after relay.
    if (!this.sesEmailClient.isConfigured('support')) {
      throw new Error('Support email sender is not configured');
    }

    const [row] = await this.db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.id, message.payload.emailMessageId))
      .limit(1);
    if (!row) {
      this.logger.warn(`Support email event ${message.eventId}: message not found, skipping`);
      return 'message_missing';
    }
    if (row.deliveryStatus === 'SENT') return 'already_sent';
    const to = row.toAddresses[0];
    if (!to || !row.messageId) {
      // Log ids only — never the address itself.
      this.logger.warn(`Support email event ${message.eventId}: recipient/message-id missing`);
      return 'recipient_missing';
    }

    const claim = await claimEmailSend(this.db, message.eventId);
    if (claim === 'sent') return 'already_sent';
    if (claim === 'in_flight') {
      throw new EmailSendInFlightError(
        `Support email event ${message.eventId} is being sent elsewhere`,
      );
    }

    const text = row.textBody ?? '';
    const references = row.references?.split(/\s+/).filter(Boolean).map(bracket).join(' ');
    let sesMessageId: string | undefined;
    try {
      ({ sesMessageId } = await this.sesEmailClient.sendSupportEmail({
        to,
        subject: row.subject ?? '',
        text,
        html: row.htmlBody || `<pre>${escapeHtml(text)}</pre>`,
        messageId: bracket(row.messageId),
        inReplyTo: row.inReplyTo ? bracket(row.inReplyTo) : undefined,
        references: references || undefined,
      }));
    } catch (error) {
      // SES error messages can echo the recipient address, so only the error
      // name is logged. Rethrow so the message is retried / dead-lettered.
      const name = error instanceof Error ? error.name : 'UnknownError';
      this.logger.error(`Support email event ${message.eventId}: SES send failed (${name})`);
      if (!(await releaseEmailSendClaim(this.db, message.eventId))) {
        this.logger.warn(`Support email event ${message.eventId}: failed to release send claim`);
      }
      throw error;
    }

    await this.db
      .update(emailMessages)
      .set({ deliveryStatus: 'SENT', sentAt: sql`now()`, sesMessageId })
      .where(eq(emailMessages.id, row.id));
    await markEmailSent(this.db, message.eventId);
    return 'sent';
  }
}

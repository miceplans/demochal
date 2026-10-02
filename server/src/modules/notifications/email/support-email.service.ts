import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../../db/drizzle.provider.js';
import { emailMessages } from '../../../db/schema.js';
import { env } from '../../../config/env.js';
import { SesEmailClient } from './ses-email.client.js';

export interface SupportEmailRequest {
  threadId: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  inReplyTo?: string;
  references?: string;
}

export interface SupportEmailResult {
  messageId: string;
  sesMessageId?: string;
}

/**
 * Internal support-mail contract for the future admin API. The send is kept
 * on the existing worker SES adapter, and the accepted outbound message is
 * recorded with the same thread/header identifiers used by inbound mail.
 */
@Injectable()
export class SupportEmailService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly sesEmailClient: SesEmailClient,
  ) {}

  async sendSupportEmail(request: SupportEmailRequest): Promise<SupportEmailResult> {
    if (!this.sesEmailClient.isConfigured('support')) {
      throw new Error('Support email sender is not configured');
    }
    const messageId = `<${randomUUID()}@semochall.com>`;
    const result = await this.sesEmailClient.sendSupportEmail({
      to: request.to,
      subject: request.subject,
      text: request.text,
      html: request.html,
      messageId,
      inReplyTo: request.inReplyTo,
      references: request.references,
    });

    await this.db.insert(emailMessages).values({
      threadId: request.threadId,
      direction: 'OUTBOUND',
      messageId,
      sesMessageId: result.sesMessageId,
      inReplyTo: request.inReplyTo,
      references: request.references,
      fromAddress: env.sesSupportFromEmail,
      toAddresses: [request.to],
      ccAddresses: [],
      subject: request.subject,
      textBody: request.text,
      htmlBody: request.html,
      deliveryStatus: 'SENT',
      sentAt: sql`now()`,
    });

    return { messageId, sesMessageId: result.sesMessageId };
  }
}

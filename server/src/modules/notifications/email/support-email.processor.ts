import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { env } from '../../../config/env.js';
import { DRIZZLE, type Database } from '../../../db/drizzle.provider.js';
import { emailMessages } from '../../../db/schema.js';
import { SesEmailClient } from './ses-email.client.js';
import type { SupportEmailJobMessage } from './support-email.js';

@Injectable()
export class SupportEmailProcessorService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly ses: SesEmailClient,
  ) {}

  async process(job: SupportEmailJobMessage) {
    const [message] = await this.db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.id, job.payload.messageId))
      .limit(1);
    if (!message || message.deliveryStatus === 'SENT') return 'already_sent';
    if (message.deliveryStatus !== 'QUEUED') return 'not_deliverable';

    const [claimed] = await this.db
      .update(emailMessages)
      .set({ deliveryStatus: 'SENDING' })
      .where(and(eq(emailMessages.id, message.id), eq(emailMessages.deliveryStatus, 'QUEUED')))
      .returning({ id: emailMessages.id });
    if (!claimed) return 'already_claimed';

    try {
      const result = await this.ses.sendSupportEmail({
        to: message.toAddresses[0] ?? '',
        subject: message.subject ?? '',
        text: message.textBody ?? '',
        html: message.htmlBody ?? `<pre>${message.textBody ?? ''}</pre>`,
        inReplyTo: message.inReplyTo ? `<${message.inReplyTo.replace(/^<|>$/g, '')}>` : undefined,
        references: message.references
          ?.split(/\s+/)
          .filter(Boolean)
          .map((value) => `<${value.replace(/^<|>$/g, '')}>`)
          .join(' '),
      });
      await this.db
        .update(emailMessages)
        .set({
          deliveryStatus: 'SENT',
          sesMessageId: result.sesMessageId,
          // SES가 Message-ID를 직접 부여하므로(커스텀 헤더 불가) 실제 헤더 값으로 갱신해야
          // 고객 답장의 In-Reply-To로 스레드가 이어진다.
          ...(result.sesMessageId
            ? { messageId: `<${result.sesMessageId}@${env.awsRegion}.amazonses.com>` }
            : {}),
        })
        .where(eq(emailMessages.id, message.id));
      return 'sent';
    } catch (error) {
      await this.db
        .update(emailMessages)
        .set({ deliveryStatus: 'FAILED' })
        .where(eq(emailMessages.id, message.id));
      throw error;
    }
  }
}

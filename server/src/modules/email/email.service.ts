import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { emailAttachments, emailMessages, emailThreads } from '../../db/schema.js';
import { OutboxService } from '../../outbox/outbox.service.js';
import {
  SUPPORT_EMAIL_EVENT,
  type SupportEmailPayload,
} from '../notifications/email/support-email.js';
import {
  normalizeMessageId,
  resolveThreadId,
  safeHeader,
  SUPPORT_EMAIL,
  type InboundEmail,
} from './email.types.js';

const statuses = ['open', 'pending', 'resolved'] as const;

@Injectable()
export class EmailService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly outboxService: OutboxService,
  ) {}

  async listThreads(query?: { q?: string; status?: string }) {
    if (query?.status && !statuses.includes(query.status as (typeof statuses)[number])) {
      throw new BadRequestException('유효하지 않은 메일 상태입니다.');
    }
    const threads = await this.db.select().from(emailThreads).orderBy(desc(emailThreads.updatedAt));
    const messages = await this.db
      .select()
      .from(emailMessages)
      .orderBy(desc(emailMessages.createdAt));
    const q = query?.q?.trim().toLocaleLowerCase('ko-KR');
    return threads
      .filter((thread) => !query?.status || thread.status === query.status)
      .map((thread) => {
        const threadMessages = messages.filter((message) => message.threadId === thread.id);
        const latest = threadMessages[0];
        const inbound = threadMessages.find((message) => message.direction === 'INBOUND');
        return {
          ...thread,
          customerEmail: inbound?.fromAddress ?? latest?.toAddresses?.[0] ?? '',
          lastMessage: latest?.textBody ?? latest?.htmlBody ?? '',
          lastMessageAt: latest?.sentAt ?? latest?.receivedAt ?? thread.updatedAt,
        };
      })
      .filter(
        (thread) =>
          !q ||
          thread.subject?.toLocaleLowerCase('ko-KR').includes(q) ||
          thread.customerEmail.toLocaleLowerCase('ko-KR').includes(q),
      );
  }

  async getThread(id: string) {
    const [thread] = await this.db
      .select()
      .from(emailThreads)
      .where(eq(emailThreads.id, id))
      .limit(1);
    if (!thread) throw new NotFoundException('메일 thread를 찾을 수 없습니다.');
    const messages = await this.db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.threadId, id))
      .orderBy(emailMessages.createdAt);
    const allAttachments = messages.length
      ? (
          await Promise.all(
            messages.map((message) =>
              this.db
                .select()
                .from(emailAttachments)
                .where(eq(emailAttachments.messageId, message.id)),
            ),
          )
        ).flat()
      : [];
    return {
      ...thread,
      messages: messages.map((message) => ({
        ...message,
        direction: message.direction.toLowerCase(),
        references: message.references ? message.references.split(/\s+/).filter(Boolean) : [],
        attachments: allAttachments.filter((attachment) => attachment.messageId === message.id),
      })),
    };
  }

  async ingestInbound(email: InboundEmail) {
    const messageId = normalizeMessageId(email.messageId);
    if (!messageId || !email.from || !email.to)
      throw new BadRequestException('inbound 메일 계약이 올바르지 않습니다.');
    const [duplicate] = await this.db
      .select({ id: emailMessages.id })
      .from(emailMessages)
      .where(eq(emailMessages.messageId, messageId))
      .limit(1);
    if (duplicate) return { duplicate: true, messageId };
    const linkIds = [email.inReplyTo, ...email.references]
      .filter(Boolean)
      .map((value) => normalizeMessageId(value!));
    const existingMessages = await this.db.select().from(emailMessages);
    const threads = await this.db.select().from(emailThreads);
    const threadId = resolveThreadId(email, existingMessages, threads);
    const sentAt = new Date(email.sentAt);
    if (Number.isNaN(sentAt.getTime()))
      throw new BadRequestException('sentAt이 올바른 날짜가 아닙니다.');
    return this.db.transaction(async (tx) => {
      const [thread] = threadId
        ? await tx
            .update(emailThreads)
            .set({ updatedAt: sentAt })
            .where(eq(emailThreads.id, threadId))
            .returning()
        : await tx
            .insert(emailThreads)
            .values({ subject: safeHeader(email.subject) })
            .returning();
      if (!thread) throw new NotFoundException('메일 thread를 생성할 수 없습니다.');
      const [message] = await tx
        .insert(emailMessages)
        .values({
          threadId: thread.id,
          direction: 'INBOUND',
          messageId,
          inReplyTo: email.inReplyTo ? normalizeMessageId(email.inReplyTo) : null,
          references: linkIds.join(' '),
          fromAddress: safeHeader(email.from),
          toAddresses: [safeHeader(email.to)],
          subject: safeHeader(email.subject),
          textBody: email.text || null,
          htmlBody: email.html || null,
          deliveryStatus: 'RECEIVED',
          receivedAt: sentAt,
          sentAt,
        })
        .returning();
      if (!message) throw new NotFoundException('메일 메시지를 저장할 수 없습니다.');
      if (email.attachments?.length)
        await tx.insert(emailAttachments).values(
          email.attachments.map((attachment) => ({
            messageId: message.id,
            filename: attachment.filename,
            contentType: attachment.contentType,
            sizeBytes: attachment.size,
          })),
        );
      return { duplicate: false, threadId: thread.id, messageId };
    });
  }

  /**
   * Outbox 패턴: 발송은 API가 아니라 worker가 한다. 여기서는 아웃바운드 메시지 행(QUEUED)과
   * outbox 이벤트를 한 트랜잭션으로 기록하므로, 둘은 함께 커밋되거나 함께 롤백된다.
   */
  private async queueOutbound(
    tx: Database,
    values: Omit<typeof emailMessages.$inferInsert, 'direction' | 'fromAddress' | 'deliveryStatus'>,
  ) {
    const [message] = await tx
      .insert(emailMessages)
      .values({
        ...values,
        direction: 'OUTBOUND',
        fromAddress: SUPPORT_EMAIL,
        deliveryStatus: 'QUEUED',
      })
      .returning();
    if (!message) throw new NotFoundException('메일 메시지를 저장할 수 없습니다.');
    const payload: SupportEmailPayload = { emailMessageId: message.id };
    await this.outboxService.enqueue(tx, SUPPORT_EMAIL_EVENT, payload);
    return message;
  }

  async sendReply(threadId: string, text: string, html: string) {
    const thread = await this.getThread(threadId);
    const lastInbound = [...thread.messages]
      .reverse()
      .find((message) => message.direction === 'inbound');
    if (!lastInbound || !lastInbound.messageId)
      throw new BadRequestException('답장할 inbound 메일이 없습니다.');
    const messageId = normalizeMessageId(`${randomUUID()}@semochall.com`);
    const references = [...new Set([...lastInbound.references, lastInbound.messageId])];
    const subject = thread.subject?.startsWith('Re:')
      ? thread.subject
      : `Re: ${thread.subject ?? '(제목 없음)'}`;
    const queuedAt = new Date();
    return this.db.transaction(async (tx) => {
      const message = await this.queueOutbound(tx, {
        threadId,
        messageId,
        inReplyTo: lastInbound.messageId,
        references: references.join(' '),
        toAddresses: [lastInbound.fromAddress],
        subject,
        textBody: text,
        htmlBody: html || null,
      });
      await tx
        .update(emailThreads)
        .set({ updatedAt: queuedAt })
        .where(eq(emailThreads.id, threadId));
      return message;
    });
  }

  async sendNewEmail(to: string, subject: string, text: string, html: string) {
    const cleanTo = safeHeader(to);
    const cleanSubject = safeHeader(subject);
    const messageId = normalizeMessageId(`${randomUUID()}@semochall.com`);
    const queuedAt = new Date();

    return this.db.transaction(async (tx) => {
      const [thread] = await tx
        .insert(emailThreads)
        .values({
          subject: cleanSubject,
          status: 'pending',
          createdAt: queuedAt,
          updatedAt: queuedAt,
        })
        .returning();
      if (!thread) throw new NotFoundException('메일 thread를 생성할 수 없습니다.');
      return this.queueOutbound(tx, {
        threadId: thread.id,
        messageId,
        toAddresses: [cleanTo],
        subject: cleanSubject,
        textBody: text,
        htmlBody: html || null,
      });
    });
  }
}

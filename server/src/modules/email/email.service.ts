import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { emailAttachments, emailMessages, emailThreads } from '../../db/schema.js';
import { OutboxService } from '../../outbox/outbox.service.js';
import { SUPPORT_EMAIL_EVENT } from '../notifications/email/support-email.js';
import {
  normalizeMessageId,
  resolveThreadId,
  safeHeader,
  SUPPORT_EMAIL,
  type InboundEmail,
} from './email.types.js';

const statuses = ['open', 'pending', 'resolved'] as const;
type EmailMessageRow = typeof emailMessages.$inferSelect;

function resolveCustomerEmail(
  inbound: Pick<EmailMessageRow, 'fromAddress'> | undefined,
  latest: Pick<EmailMessageRow, 'toAddresses'> | undefined,
) {
  return inbound?.fromAddress ?? latest?.toAddresses?.[0] ?? '';
}

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
    const threads = await this.db
      .select()
      .from(emailThreads)
      .where(query?.status ? eq(emailThreads.status, query.status) : undefined)
      .orderBy(desc(emailThreads.updatedAt));
    const latestMessages = await this.db
      .selectDistinctOn([emailMessages.threadId])
      .from(emailMessages)
      .orderBy(emailMessages.threadId, desc(emailMessages.createdAt));
    const inboundMessages = await this.db
      .selectDistinctOn([emailMessages.threadId])
      .from(emailMessages)
      .where(eq(emailMessages.direction, 'INBOUND'))
      .orderBy(emailMessages.threadId, desc(emailMessages.createdAt));
    const latestByThread = new Map(latestMessages.map((message) => [message.threadId, message]));
    const inboundByThread = new Map(inboundMessages.map((message) => [message.threadId, message]));
    const q = query?.q?.trim().toLocaleLowerCase('ko-KR');
    return threads
      .map((thread) => {
        const latest = latestByThread.get(thread.id);
        const inbound = inboundByThread.get(thread.id);
        return {
          ...thread,
          customerEmail: resolveCustomerEmail(inbound, latest),
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
    const latestMessage = messages.at(-1);
    const lastInbound = [...messages].reverse().find((message) => message.direction === 'INBOUND');
    const allAttachments = messages.length
      ? await this.db
          .select()
          .from(emailAttachments)
          .where(
            inArray(
              emailAttachments.messageId,
              messages.map((message) => message.id),
            ),
          )
      : [];
    return {
      ...thread,
      customerEmail: resolveCustomerEmail(lastInbound, latestMessage),
      messages: messages.map((message) => ({
        ...message,
        direction: message.direction.toLowerCase(),
        references: message.references ? message.references.split(/\s+/).filter(Boolean) : [],
        attachments: allAttachments.filter((attachment) => attachment.messageId === message.id),
      })),
    };
  }

  async updateThreadStatus(id: string, status: (typeof statuses)[number]) {
    const [thread] = await this.db
      .update(emailThreads)
      .set({ status, updatedAt: new Date() })
      .where(eq(emailThreads.id, id))
      .returning();
    if (!thread) throw new NotFoundException('메일 thread를 찾을 수 없습니다.');
    return thread;
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
    const threadId = resolveThreadId(email, existingMessages);
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

  async sendReply(threadId: string, text: string, html: string) {
    const thread = await this.getThread(threadId);
    const lastInbound = [...thread.messages]
      .reverse()
      .find((message) => message.direction === 'inbound');
    if (!lastInbound || !lastInbound.messageId)
      throw new BadRequestException('답장할 inbound 메일이 없습니다.');
    const messageId = `<${randomUUID()}@semochall.com>`;
    const references = [...new Set([...lastInbound.references, lastInbound.messageId])];
    const subject = thread.subject?.startsWith('Re:')
      ? thread.subject
      : `Re: ${thread.subject ?? '(제목 없음)'}`;
    const sentAt = new Date();
    return this.db.transaction(async (tx) => {
      const [message] = await tx
        .insert(emailMessages)
        .values({
          threadId,
          direction: 'OUTBOUND',
          messageId,
          inReplyTo: lastInbound.messageId,
          references: references.join(' '),
          fromAddress: SUPPORT_EMAIL,
          toAddresses: [lastInbound.fromAddress],
          subject,
          textBody: text,
          htmlBody: html || null,
          deliveryStatus: 'QUEUED',
          sentAt,
        })
        .returning();
      if (!message) throw new NotFoundException('메일 메시지를 저장할 수 없습니다.');
      await tx.update(emailThreads).set({ updatedAt: sentAt }).where(eq(emailThreads.id, threadId));
      await this.outboxService.enqueue(tx, SUPPORT_EMAIL_EVENT, { messageId: message.id });
      return this.serializeMessage(message);
    });
  }

  async sendNewEmail(to: string, subject: string, text: string, html: string) {
    const cleanTo = safeHeader(to);
    const cleanSubject = safeHeader(subject);
    const messageId = `<${randomUUID()}@semochall.com>`;
    const sentAt = new Date();
    return this.db.transaction(async (tx) => {
      const [thread] = await tx
        .insert(emailThreads)
        .values({ subject: cleanSubject, status: 'pending', createdAt: sentAt, updatedAt: sentAt })
        .returning();
      if (!thread) throw new NotFoundException('메일 thread를 생성할 수 없습니다.');
      const [message] = await tx
        .insert(emailMessages)
        .values({
          threadId: thread.id,
          direction: 'OUTBOUND',
          messageId: normalizeMessageId(messageId),
          fromAddress: SUPPORT_EMAIL,
          toAddresses: [cleanTo],
          subject: cleanSubject,
          textBody: text,
          htmlBody: html || null,
          deliveryStatus: 'QUEUED',
          sentAt,
        })
        .returning();
      if (!message) throw new NotFoundException('메일 메시지를 저장할 수 없습니다.');
      await this.outboxService.enqueue(tx, SUPPORT_EMAIL_EVENT, { messageId: message.id });
      return this.serializeMessage(message);
    });
  }

  private serializeMessage(message: typeof emailMessages.$inferSelect) {
    return {
      id: message.id,
      direction: message.direction.toLowerCase(),
      messageId: message.messageId,
      fromAddress: message.fromAddress,
      toAddresses: message.toAddresses,
      subject: message.subject,
      textBody: message.textBody,
      htmlBody: message.htmlBody,
      sentAt: message.sentAt,
      receivedAt: message.receivedAt,
      references: message.references?.split(/\s+/).filter(Boolean) ?? [],
      attachments: [],
    };
  }
}

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emailMessages, emailThreads } from '../../db/schema.js';
import { SUPPORT_EMAIL_EVENT } from '../notifications/email/support-email.js';
import { EmailService } from './email.service.js';

describe('EmailService outbound mail (Outbox)', () => {
  let inserts: { table: unknown; values: Record<string, unknown> }[];
  let tx: Record<string, ReturnType<typeof vi.fn>>;
  let db: Record<string, ReturnType<typeof vi.fn>>;
  let outbox: { enqueue: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    inserts = [];
    tx = {
      insert: vi.fn((table: unknown) => ({
        values: (values: Record<string, unknown>) => {
          inserts.push({ table, values });
          return {
            returning: () =>
              Promise.resolve([{ id: table === emailThreads ? 'thread-1' : 'row-1', ...values }]),
          };
        },
      })),
      update: vi.fn(() => ({ set: () => ({ where: vi.fn().mockResolvedValue(undefined) }) })),
    };
    db = { transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) };
    outbox = { enqueue: vi.fn().mockResolvedValue(undefined) };
  });

  const service = () => new EmailService(db as never, outbox as never);

  it('sendNewEmail stores a QUEUED row and enqueues the outbox event in one transaction', async () => {
    const message = await service().sendNewEmail('to@example.com', '제목\r\n', '본문', '');

    expect(db.transaction).toHaveBeenCalledTimes(1);
    const row = inserts.find((i) => i.table === emailMessages)!.values;
    expect(row).toMatchObject({
      direction: 'OUTBOUND',
      deliveryStatus: 'QUEUED',
      toAddresses: ['to@example.com'],
      subject: '제목',
      htmlBody: null,
    });
    expect(row.sentAt).toBeUndefined();
    expect(outbox.enqueue).toHaveBeenCalledWith(tx, SUPPORT_EMAIL_EVENT, {
      emailMessageId: message.id,
    });
  });

  it('sendReply queues a threaded reply to the last inbound message', async () => {
    const svc = service();
    vi.spyOn(svc, 'getThread').mockResolvedValue({
      id: 'thread-1',
      subject: '문의',
      messages: [
        {
          direction: 'inbound',
          messageId: 'customer-1@example.com',
          references: ['root@example.com'],
          fromAddress: 'customer@example.com',
        },
      ],
    } as never);

    await svc.sendReply('thread-1', '답변', '<p>답변</p>');

    const row = inserts.find((i) => i.table === emailMessages)!.values;
    expect(row).toMatchObject({
      threadId: 'thread-1',
      deliveryStatus: 'QUEUED',
      subject: 'Re: 문의',
      inReplyTo: 'customer-1@example.com',
      references: 'root@example.com customer-1@example.com',
      toAddresses: ['customer@example.com'],
    });
    expect(String(row.messageId)).toMatch(/^[^<>]+@semochall\.com$/);
    expect(outbox.enqueue).toHaveBeenCalledWith(tx, SUPPORT_EMAIL_EVENT, {
      emailMessageId: 'row-1',
    });
    expect(tx.update).toHaveBeenCalledWith(emailThreads);
  });

  it('propagates an enqueue failure so the surrounding transaction rolls back', async () => {
    outbox.enqueue.mockRejectedValue(new Error('db down'));
    await expect(service().sendNewEmail('to@example.com', 's', 't', '')).rejects.toThrow('db down');
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });
});

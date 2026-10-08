import { describe, expect, it, vi } from 'vitest';
import { EmailService } from './email.service.js';

function createDatabase(results: unknown[]) {
  let index = 0;
  return {
    select: vi.fn(() => {
      const result = results[index++] ?? [];
      const builder = {
        from: vi.fn(() => builder),
        where: vi.fn(() => (index === 3 ? Promise.resolve(result) : builder)),
        limit: vi.fn(() => Promise.resolve(result)),
        orderBy: vi.fn(() => Promise.resolve(result)),
      };
      return builder;
    }),
  } as never;
}

function createService(results: unknown[]) {
  return new EmailService(createDatabase(results), {} as never);
}

const thread = {
  id: 'thread-1',
  subject: '문의',
  status: 'open',
  createdAt: new Date('2026-10-07T00:00:00.000Z'),
  updatedAt: new Date('2026-10-07T00:00:00.000Z'),
};

function message(overrides: Record<string, unknown>) {
  return {
    id: 'message-1',
    threadId: 'thread-1',
    direction: 'INBOUND',
    messageId: 'message-1@example.com',
    sesMessageId: null,
    inReplyTo: null,
    references: null,
    fromAddress: 'customer@example.com',
    toAddresses: ['help@semochall.com'],
    ccAddresses: [],
    subject: '문의',
    textBody: '도와주세요',
    htmlBody: null,
    s3ObjectKey: null,
    deliveryStatus: 'RECEIVED',
    sentAt: new Date('2026-10-07T00:00:00.000Z'),
    receivedAt: new Date('2026-10-07T00:00:00.000Z'),
    createdAt: new Date('2026-10-07T00:00:00.000Z'),
    ...overrides,
  };
}

describe('EmailService.getThread', () => {
  it('returns the sender address for an inbound thread', async () => {
    const service = createService([[thread], [message({})], []]);

    await expect(service.getThread('thread-1')).resolves.toMatchObject({
      customerEmail: 'customer@example.com',
    });
  });

  it('returns the recipient address for an outbound-only thread', async () => {
    const service = createService([
      [thread],
      [
        message({
          direction: 'OUTBOUND',
          fromAddress: 'help@semochall.com',
          toAddresses: ['recipient@example.com'],
        }),
      ],
      [],
    ]);

    await expect(service.getThread('thread-1')).resolves.toMatchObject({
      customerEmail: 'recipient@example.com',
    });
  });

  it('returns an empty address when the thread has no address', async () => {
    const service = createService([
      [thread],
      [message({ direction: 'OUTBOUND', toAddresses: [] })],
      [],
    ]);

    await expect(service.getThread('thread-1')).resolves.toMatchObject({ customerEmail: '' });
  });
});

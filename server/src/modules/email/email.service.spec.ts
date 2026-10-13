import { describe, expect, it, vi } from 'vitest';
import { emailMessages } from '../../db/schema.js';
import { EmailService } from './email.service.js';

/** inArray 호출을 기록해 스레드 후보 쿼리가 링크 헤더로 좁혀지는지 검증한다. */
const inArrayCalls = vi.hoisted(() => [] as Array<{ column: unknown; value: unknown }>);

vi.mock('drizzle-orm', async (importActual) => {
  const actual = await importActual<typeof import('drizzle-orm')>();
  return {
    ...actual,
    inArray: (column: unknown, value: unknown) => {
      inArrayCalls.push({ column, value });
      return { op: 'inArray', column, value };
    },
  };
});

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

describe('EmailService.ingestInbound', () => {
  const inbound = {
    messageId: '<new-1@example.com>',
    inReplyTo: '<reply-1@example.com>',
    references: ['<ref-2@example.com>'],
    from: 'customer@example.com',
    to: 'help@semochall.com',
    subject: '문의',
    text: '도와주세요',
    sentAt: '2026-10-13T00:00:00.000Z',
  };

  function createIngestDb(linked: Array<{ messageId: string | null; threadId: string }>) {
    const insertReturning = (rows: unknown[]) => ({
      values: () => ({ returning: async () => rows }),
    });
    const tx: any = {
      update: vi.fn(() => ({
        set: () => ({
          where: () => ({ returning: async () => [{ id: 'thread-9' }] }),
        }),
      })),
      // 첫 insert는 thread 생성, 두 번째는 message 저장이다.
      insert: vi
        .fn()
        .mockReturnValueOnce(insertReturning([{ id: 'thread-9' }]))
        .mockReturnValue(insertReturning([{ id: 'msg-1' }])),
    };
    // 첫 select는 messageId 중복 검사(.where().limit()), 이어지는 select는
    // 스레드 후보 조회(.where()를 await)다.
    const duplicateBuilder: any = {
      from: vi.fn(),
      where: vi.fn(),
      limit: vi.fn(() => Promise.resolve([])),
    };
    duplicateBuilder.from.mockReturnValue(duplicateBuilder);
    duplicateBuilder.where.mockReturnValue(duplicateBuilder);
    const linkedWhere = vi.fn(() => Promise.resolve(linked));
    const linkedBuilder: any = {
      from: vi.fn(() => linkedBuilder),
      where: linkedWhere,
    };
    const db: any = {
      select: vi
        .fn()
        .mockImplementationOnce(() => duplicateBuilder)
        .mockImplementation(() => linkedBuilder),
      transaction: vi.fn((cb: (txArg: unknown) => unknown) => cb(tx)),
    };
    return { db, tx, linkedWhere };
  }

  it('resolves the thread with a targeted query on the link headers only', async () => {
    const { db, tx, linkedWhere } = createIngestDb([
      { messageId: 'reply-1@example.com', threadId: 'thread-9' },
    ]);
    const service = new EmailService(db, {} as never);

    await expect(service.ingestInbound(inbound)).resolves.toEqual({
      duplicate: false,
      threadId: 'thread-9',
      messageId: 'new-1@example.com',
    });

    // 전체 테이블 스캔 대신 in-reply-to/references 정규화 값(±앵글 브래킷)으로만 조회한다.
    expect(inArrayCalls).toContainEqual({
      column: emailMessages.messageId,
      value: [
        'reply-1@example.com',
        '<reply-1@example.com>',
        'ref-2@example.com',
        '<ref-2@example.com>',
      ],
    });
    expect(linkedWhere).toHaveBeenCalled();
    expect(tx.update).toHaveBeenCalled();
    expect(tx.insert).toHaveBeenCalled();
  });

  it('creates a new thread when no link header matches and skips the candidate query', async () => {
    const { db, tx } = createIngestDb([]);
    const service = new EmailService(db, {} as never);
    inArrayCalls.length = 0;

    await expect(
      service.ingestInbound({ ...inbound, inReplyTo: undefined, references: [] }),
    ).resolves.toEqual({
      duplicate: false,
      threadId: 'thread-9',
      messageId: 'new-1@example.com',
    });

    expect(inArrayCalls).toHaveLength(0);
    // 기존 스레드가 없으므로 update 대신 신규 thread insert 경로다.
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.insert).toHaveBeenCalled();
  });

  it('acknowledges a duplicate messageId without touching threads or messages', async () => {
    const tx: any = { update: vi.fn(), insert: vi.fn() };
    const db: any = {
      select: vi.fn(() => {
        const builder: any = {
          from: vi.fn(),
          where: vi.fn(),
          limit: vi.fn(() => Promise.resolve([{ id: 'existing-msg' }])),
        };
        builder.from.mockReturnValue(builder);
        builder.where.mockReturnValue(builder);
        return builder;
      }),
      transaction: vi.fn(),
    };
    const service = new EmailService(db, {} as never);

    await expect(service.ingestInbound(inbound)).resolves.toEqual({
      duplicate: true,
      messageId: 'new-1@example.com',
    });
    expect(db.transaction).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
  });
});

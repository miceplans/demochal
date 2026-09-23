import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emailSendStates, notifications, users } from '../../../db/schema.js';
import {
  EmailSendInFlightError,
  NotificationEmailProcessorService,
} from './notification-email.processor.js';

const job = { eventId: 'event-1', payload: { notificationId: 'notification-1' } };
const notification = {
  id: 'notification-1',
  userId: 'user-1',
  type: 'verification.result',
  payload: { status: 'verified' },
};

interface StubRows {
  notification?: unknown[];
  recipient?: unknown[];
  /** Rows returned by the claim INSERT … ON CONFLICT DO NOTHING RETURNING. */
  claimInsert?: unknown[];
  /** Rows returned by the stale-lease takeover UPDATE … RETURNING. */
  takeover?: unknown[];
  /** Existing send-state row read after a lost claim. */
  existing?: unknown[];
}

// Answers each drizzle chain the processor uses so every step of the claim
// protocol can be controlled independently.
function createDbStub(rows: StubRows = {}) {
  const byTable = new Map<unknown, unknown[]>([
    [notifications, rows.notification ?? [notification]],
    [users, rows.recipient ?? [{ email: 'owner@example.com' }]],
    [emailSendStates, rows.existing ?? []],
  ]);
  const select = vi.fn(() => ({
    from: (table: unknown) => ({
      where: () => ({ limit: vi.fn().mockResolvedValue(byTable.get(table) ?? []) }),
    }),
  }));

  const insertValues = vi.fn(() => ({
    onConflictDoNothing: () => ({
      returning: vi.fn().mockResolvedValue(rows.claimInsert ?? [{ id: 'state-1' }]),
    }),
  }));
  const insert = vi.fn(() => ({ values: insertValues }));

  const updateSet = vi.fn(() => ({
    // Awaitable for the final 'sent' update, `.returning()` for the takeover.
    where: () =>
      Object.assign(Promise.resolve(undefined), {
        returning: vi.fn().mockResolvedValue(rows.takeover ?? []),
      }),
  }));
  const update = vi.fn(() => ({ set: updateSet }));

  const deleteWhere = vi.fn().mockResolvedValue(undefined);
  const del = vi.fn(() => ({ where: deleteWhere }));

  return {
    db: { select, insert, update, delete: del } as any,
    insertValues,
    updateSet,
    del,
  };
}

function createSes(configured = true) {
  return { isConfigured: vi.fn(() => configured), send: vi.fn().mockResolvedValue(undefined) };
}

describe('NotificationEmailProcessorService.process', () => {
  let ses: ReturnType<typeof createSes>;

  beforeEach(() => {
    ses = createSes();
  });

  it('claims the event, sends to the notification owner, then marks it sent', async () => {
    const { db, insertValues, updateSet } = createDbStub();
    const processor = new NotificationEmailProcessorService(db, ses as any);

    await expect(processor.process(job)).resolves.toBe('sent');

    expect(insertValues).toHaveBeenCalledWith({
      outboxEventId: 'event-1',
      status: 'sending',
      claimedAt: expect.anything(),
    });
    expect(ses.send).toHaveBeenCalledTimes(1);
    const email = ses.send.mock.calls[0]?.[0];
    expect(email.to).toBe('owner@example.com');
    expect(email.subject).toContain('사업자 인증이 승인되었습니다');
    expect(updateSet).toHaveBeenLastCalledWith({ status: 'sent', sentAt: expect.anything() });
  });

  it('acks a duplicate delivery of an already-sent event without calling SES', async () => {
    const { db } = createDbStub({ claimInsert: [], takeover: [], existing: [{ status: 'sent' }] });
    const processor = new NotificationEmailProcessorService(db, ses as any);

    await expect(processor.process(job)).resolves.toBe('already_sent');
    expect(ses.send).not.toHaveBeenCalled();
  });

  it('does not send (and does not ack) while another delivery holds a live claim', async () => {
    const { db } = createDbStub({
      claimInsert: [],
      takeover: [],
      existing: [{ status: 'sending' }],
    });
    const processor = new NotificationEmailProcessorService(db, ses as any);

    await expect(processor.process(job)).rejects.toBeInstanceOf(EmailSendInFlightError);
    expect(ses.send).not.toHaveBeenCalled();
  });

  it('takes over a stale claim left by a crashed worker and sends', async () => {
    const { db } = createDbStub({ claimInsert: [], takeover: [{ id: 'state-1' }] });
    const processor = new NotificationEmailProcessorService(db, ses as any);

    await expect(processor.process(job)).resolves.toBe('sent');
    expect(ses.send).toHaveBeenCalledTimes(1);
  });

  it('no-ops without touching the DB or SES when SES is not configured', async () => {
    const { db } = createDbStub();
    const processor = new NotificationEmailProcessorService(db, createSes(false) as any);

    await expect(processor.process(job)).resolves.toBe('not_configured');
    expect(db.select).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('releases the claim and rethrows on SES failure so SQS retries the message', async () => {
    const { db, del, updateSet } = createDbStub();
    ses.send.mockRejectedValue(
      Object.assign(new Error('owner@example.com rejected'), { name: 'MessageRejected' }),
    );
    const processor = new NotificationEmailProcessorService(db, ses as any);
    const logError = vi.spyOn((processor as any).logger, 'error').mockImplementation(() => {});

    await expect(processor.process(job)).rejects.toThrow('rejected');
    expect(del).toHaveBeenCalledWith(emailSendStates);
    expect(updateSet).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'sent' }));
    // The recipient address in the SES error must not reach the logs.
    expect(JSON.stringify(logError.mock.calls)).not.toContain('owner@example.com');
  });

  it('acks without claiming or sending when the recipient cannot be found', async () => {
    const { db } = createDbStub({ recipient: [] });
    const processor = new NotificationEmailProcessorService(db, ses as any);
    vi.spyOn((processor as any).logger, 'warn').mockImplementation(() => {});

    await expect(processor.process(job)).resolves.toBe('recipient_missing');
    expect(db.insert).not.toHaveBeenCalled();
    expect(ses.send).not.toHaveBeenCalled();
  });

  it('acks without sending when the notification no longer exists', async () => {
    const { db } = createDbStub({ notification: [] });
    const processor = new NotificationEmailProcessorService(db, ses as any);
    vi.spyOn((processor as any).logger, 'warn').mockImplementation(() => {});

    await expect(processor.process(job)).resolves.toBe('notification_missing');
    expect(ses.send).not.toHaveBeenCalled();
  });

  it('skips notification types that have no email template', async () => {
    const { db } = createDbStub({ notification: [{ ...notification, type: 'report.resolved' }] });
    const processor = new NotificationEmailProcessorService(db, ses as any);
    vi.spyOn((processor as any).logger, 'warn').mockImplementation(() => {});

    await expect(processor.process(job)).resolves.toBe('unsupported_type');
    expect(ses.send).not.toHaveBeenCalled();
  });
});

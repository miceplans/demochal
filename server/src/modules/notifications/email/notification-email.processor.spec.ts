import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emailSendStates, notifications, users } from '../../../db/schema.js';
import { NotificationEmailProcessorService } from './notification-email.processor.js';

const job = { eventId: 'event-1', payload: { notificationId: 'notification-1' } };
const notification = {
  id: 'notification-1',
  userId: 'user-1',
  type: 'verification.result',
  payload: { status: 'verified' },
};

// Answers `select().from(table).where().limit()` per table so each lookup in
// the processor can be controlled independently.
function createDbStub(rows: { sent?: unknown[]; notification?: unknown[]; recipient?: unknown[] }) {
  const byTable = new Map<unknown, unknown[]>([
    [emailSendStates, rows.sent ?? []],
    [notifications, rows.notification ?? [notification]],
    [users, rows.recipient ?? [{ email: 'owner@example.com' }]],
  ]);
  const select = vi.fn(() => ({
    from: (table: unknown) => ({
      where: () => ({ limit: vi.fn().mockResolvedValue(byTable.get(table) ?? []) }),
    }),
  }));
  const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn().mockReturnValue({ onConflictDoNothing });
  const insert = vi.fn().mockReturnValue({ values });
  return { db: { select, insert } as any, insert, values };
}

function createSes(configured = true) {
  return { isConfigured: vi.fn(() => configured), send: vi.fn().mockResolvedValue(undefined) };
}

describe('NotificationEmailProcessorService.process', () => {
  let ses: ReturnType<typeof createSes>;

  beforeEach(() => {
    ses = createSes();
  });

  it('sends the service email to the notification owner and records the send', async () => {
    const { db, insert, values } = createDbStub({});
    const processor = new NotificationEmailProcessorService(db, ses as any);

    await expect(processor.process(job)).resolves.toBe('sent');

    expect(ses.send).toHaveBeenCalledTimes(1);
    const email = ses.send.mock.calls[0]?.[0];
    expect(email.to).toBe('owner@example.com');
    expect(email.subject).toContain('사업자 인증이 승인되었습니다');
    expect(insert).toHaveBeenCalledWith(emailSendStates);
    expect(values).toHaveBeenCalledWith({ outboxEventId: 'event-1' });
  });

  it('does not send again for a duplicate delivery of an already-sent event', async () => {
    const { db, insert } = createDbStub({ sent: [{ id: 'state-1' }] });
    const processor = new NotificationEmailProcessorService(db, ses as any);

    await expect(processor.process(job)).resolves.toBe('already_sent');
    expect(ses.send).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('no-ops without touching the DB or SES when SES is not configured', async () => {
    const { db } = createDbStub({});
    const processor = new NotificationEmailProcessorService(db, createSes(false) as any);

    await expect(processor.process(job)).resolves.toBe('not_configured');
    expect(db.select).not.toHaveBeenCalled();
  });

  it('rethrows SES failures without recording a send, so SQS retries the message', async () => {
    const { db, insert } = createDbStub({});
    ses.send.mockRejectedValue(
      Object.assign(new Error('owner@example.com rejected'), {
        name: 'MessageRejected',
      }),
    );
    const processor = new NotificationEmailProcessorService(db, ses as any);
    const logError = vi.spyOn((processor as any).logger, 'error').mockImplementation(() => {});

    await expect(processor.process(job)).rejects.toThrow('rejected');
    expect(insert).not.toHaveBeenCalled();
    // The recipient address in the SES error must not reach the logs.
    expect(JSON.stringify(logError.mock.calls)).not.toContain('owner@example.com');
  });

  it('acks without sending when the recipient user or email cannot be found', async () => {
    const { db } = createDbStub({ recipient: [] });
    const processor = new NotificationEmailProcessorService(db, ses as any);
    vi.spyOn((processor as any).logger, 'warn').mockImplementation(() => {});

    await expect(processor.process(job)).resolves.toBe('recipient_missing');
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

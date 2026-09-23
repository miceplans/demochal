import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env.js';
import { NotificationsService } from './notifications.service.js';
import { NOTIFICATION_EMAIL_EVENT } from './email/notification-email.js';

function createDbStub(notification: { id: string } | undefined = { id: 'notification-1' }) {
  const returning = vi.fn().mockResolvedValue(notification ? [notification] : []);
  const values = vi.fn().mockReturnValue({ returning });
  const tx = { insert: vi.fn().mockReturnValue({ values }) };
  const db = { transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
  return { db, tx, values };
}

describe('NotificationsService.create', () => {
  const original = { from: env.sesFromEmail, queue: env.sqsEmailsQueueUrl };

  beforeEach(() => {
    env.sesFromEmail = 'no-reply@miceplans.com';
    env.sqsEmailsQueueUrl = 'https://sqs.example/emails';
  });

  afterEach(() => {
    env.sesFromEmail = original.from;
    env.sqsEmailsQueueUrl = original.queue;
  });

  it('writes the notification and the email outbox event in the same transaction', async () => {
    const { db, tx, values } = createDbStub();
    const outbox = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const service = new NotificationsService(db as any, outbox as any);

    const result = await service.create('user-1', 'verification.result', { status: 'verified' });

    expect(result).toEqual({ id: 'notification-1' });
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'verification.result',
      payload: { status: 'verified' },
    });
    expect(outbox.enqueue).toHaveBeenCalledWith(tx, NOTIFICATION_EMAIL_EVENT, {
      notificationId: 'notification-1',
    });
  });

  it('only carries the notification id in the email outbox payload (no address)', async () => {
    const { db } = createDbStub();
    const outbox = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const service = new NotificationsService(db as any, outbox as any);

    await service.create('user-1', 'team_matching', { teamId: 'team-1', status: 'accepted' });

    const payload = outbox.enqueue.mock.calls[0]?.[2];
    expect(Object.keys(payload)).toEqual(['notificationId']);
  });

  it('does not enqueue email for non-service notification types', async () => {
    const { db } = createDbStub();
    const outbox = { enqueue: vi.fn() };
    const service = new NotificationsService(db as any, outbox as any);

    await service.create('user-1', 'report.resolved', {});

    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it.each([
    ['SES_FROM_EMAIL', () => (env.sesFromEmail = '')],
    ['SQS_EMAILS_QUEUE_URL', () => (env.sqsEmailsQueueUrl = '')],
  ])('still creates the DB notification without email when %s is unset', async (_, unset) => {
    unset();
    const { db, values } = createDbStub();
    const outbox = { enqueue: vi.fn() };
    const service = new NotificationsService(db as any, outbox as any);

    await expect(service.create('user-1', 'verification.result', {})).resolves.toEqual({
      id: 'notification-1',
    });
    expect(values).toHaveBeenCalled();
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('propagates an outbox failure so the transaction rolls back the notification too', async () => {
    const { db } = createDbStub();
    const outbox = { enqueue: vi.fn().mockRejectedValue(new Error('insert failed')) };
    const service = new NotificationsService(db as any, outbox as any);

    await expect(service.create('user-1', 'verification.result', {})).rejects.toThrow(
      'insert failed',
    );
  });
});

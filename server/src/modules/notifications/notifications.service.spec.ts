import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env.js';
import { NotificationsService } from './notifications.service.js';
import { NOTIFICATION_EMAIL_EVENT } from './email/notification-email.js';

function createDbStub(
  notification: { id: string } | undefined = { id: 'notification-1' },
  settings?: Record<string, boolean> | null,
) {
  const returning = vi.fn().mockResolvedValue(notification ? [notification] : []);
  const values = vi.fn().mockReturnValue({ returning });
  const tx = { insert: vi.fn().mockReturnValue({ values }) };
  const limit = vi
    .fn()
    .mockResolvedValue(settings === null ? [] : [{ notificationSettings: settings ?? {} }]);
  const userWhere = vi.fn().mockReturnValue({ limit });
  const db = {
    transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: userWhere }) }),
  };
  return { db, tx, values };
}

describe('NotificationsService.create', () => {
  const original = { from: env.sesFromEmail, queue: env.sqsEmailsQueueUrl };

  beforeEach(() => {
    env.sesFromEmail = 'no-reply@semochall.com';
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

  describe('recipient notification settings', () => {
    it('skips insert and email when the applicant setting is off', async () => {
      const { db, tx, values } = createDbStub({ id: 'notification-1' }, { applicant: false });
      const outbox = { enqueue: vi.fn() };
      const service = new NotificationsService(db as any, outbox as any);

      const result = await service.create('user-1', 'team_matching', {
        teamId: 'team-1',
        applicantUserId: 'user-2',
      });

      expect(result).toBeNull();
      expect(db.transaction).not.toHaveBeenCalled();
      expect(tx.insert).not.toHaveBeenCalled();
      expect(values).not.toHaveBeenCalled();
      expect(outbox.enqueue).not.toHaveBeenCalled();
    });

    it('skips insert and email when the result setting is off', async () => {
      const { db, tx } = createDbStub({ id: 'notification-1' }, { result: false });
      const outbox = { enqueue: vi.fn() };
      const service = new NotificationsService(db as any, outbox as any);

      const result = await service.create('user-1', 'team_matching', {
        teamId: 'team-1',
        status: 'accepted',
      });

      expect(result).toBeNull();
      expect(tx.insert).not.toHaveBeenCalled();
      expect(outbox.enqueue).not.toHaveBeenCalled();
    });

    it('skips insert and email when the invite setting is off', async () => {
      const { db, tx } = createDbStub({ id: 'notification-1' }, { invite: false });
      const outbox = { enqueue: vi.fn() };
      const service = new NotificationsService(db as any, outbox as any);

      const result = await service.create('user-1', 'team_matching', {
        teamId: 'team-1',
        invitedUserId: 'user-2',
        memberId: 'member-1',
      });

      expect(result).toBeNull();
      expect(tx.insert).not.toHaveBeenCalled();
      expect(outbox.enqueue).not.toHaveBeenCalled();
    });

    it('skips insert and email when the invite_result setting is off', async () => {
      const { db, tx } = createDbStub({ id: 'notification-1' }, { invite_result: false });
      const outbox = { enqueue: vi.fn() };
      const service = new NotificationsService(db as any, outbox as any);

      const result = await service.create('user-1', 'team_matching', {
        teamId: 'team-1',
        applicantUserId: 'user-2',
        inviteAccepted: true,
      });

      expect(result).toBeNull();
      expect(tx.insert).not.toHaveBeenCalled();
      expect(outbox.enqueue).not.toHaveBeenCalled();
    });

    it('skips insert and email when the deadline setting is off', async () => {
      const { db, tx } = createDbStub({ id: 'notification-1' }, { deadline: false });
      const outbox = { enqueue: vi.fn() };
      const service = new NotificationsService(db as any, outbox as any);

      const result = await service.create('user-1', 'deadline', { challengeId: 'challenge-1' });

      expect(result).toBeNull();
      expect(tx.insert).not.toHaveBeenCalled();
      expect(outbox.enqueue).not.toHaveBeenCalled();
    });

    it('skips insert and email when the challenge setting is off', async () => {
      const { db, tx } = createDbStub({ id: 'notification-1' }, { challenge: false });
      const outbox = { enqueue: vi.fn() };
      const service = new NotificationsService(db as any, outbox as any);

      const result = await service.create('user-1', 'posting', {
        kind: 'interest_new',
        challengeId: 'challenge-1',
      });

      expect(result).toBeNull();
      expect(tx.insert).not.toHaveBeenCalled();
      expect(outbox.enqueue).not.toHaveBeenCalled();
    });

    it.each([
      ['the setting is on', { deadline: true }],
      ['no setting is configured', {}],
    ])('still creates deadline/posting notifications when %s', async (_, settings) => {
      const { db, values } = createDbStub({ id: 'notification-1' }, settings);
      const outbox = { enqueue: vi.fn().mockResolvedValue(undefined) };
      const service = new NotificationsService(db as any, outbox as any);

      await expect(
        service.create('user-1', 'deadline', { challengeId: 'challenge-1' }),
      ).resolves.toEqual({ id: 'notification-1' });
      await expect(
        service.create('user-1', 'posting', { kind: 'interest_new', challengeId: 'challenge-1' }),
      ).resolves.toEqual({ id: 'notification-1' });
      expect(values).toHaveBeenCalledTimes(2);
    });

    it.each([
      ['the setting is on', { applicant: true }],
      ['no setting is configured', {}],
      ['the user row is missing', null],
    ])('still creates the notification when %s', async (_, settings) => {
      const { db, values } = createDbStub({ id: 'notification-1' }, settings);
      const outbox = { enqueue: vi.fn().mockResolvedValue(undefined) };
      const service = new NotificationsService(db as any, outbox as any);

      const result = await service.create('user-1', 'team_matching', {
        teamId: 'team-1',
        applicantUserId: 'user-2',
      });

      expect(result).toEqual({ id: 'notification-1' });
      expect(values).toHaveBeenCalled();
    });

    it('always sends types without a settings mapping', async () => {
      const { db, values } = createDbStub({ id: 'notification-1' }, { result: false });
      const outbox = { enqueue: vi.fn().mockResolvedValue(undefined) };
      const service = new NotificationsService(db as any, outbox as any);

      const result = await service.create('user-1', 'verification.result', { status: 'verified' });

      expect(result).toEqual({ id: 'notification-1' });
      expect(values).toHaveBeenCalled();
    });
  });
});

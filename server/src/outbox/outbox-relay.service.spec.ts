import { describe, expect, it, vi } from 'vitest';
import { OutboxRelayService } from './outbox-relay.service.js';

function createDbStub(rows: Array<{ id: string; payload: unknown; attempts: number }>) {
  const limit = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn().mockReturnValue({ limit });
  const where = vi.fn().mockReturnValue({ orderBy });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });

  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set });

  const db: any = { select, update };
  return { db, set, updateWhere };
}

describe('OutboxRelayService.relay', () => {
  it('sends every pending row and marks each sent', async () => {
    const rows = [{ id: 'row-1', payload: { verificationId: 'verif-1' }, attempts: 0 }];
    const { db, set } = createDbStub(rows);
    const sqsService = { sendMessage: vi.fn().mockResolvedValue(undefined) };
    const service = new OutboxRelayService(db, sqsService as any);

    await service.relay('verification.submitted', 'https://sqs.example/queue');

    expect(sqsService.sendMessage).toHaveBeenCalledWith('https://sqs.example/queue', {
      verificationId: 'verif-1',
    });
    expect(set).toHaveBeenCalledWith({ status: 'sent', sentAt: expect.any(Date) });
  });

  it('wraps the payload with the outbox event id when includeEventId is set', async () => {
    const rows = [{ id: 'row-9', payload: { notificationId: 'n-1' }, attempts: 0 }];
    const { db } = createDbStub(rows);
    const sqsService = { sendMessage: vi.fn().mockResolvedValue(undefined) };
    const service = new OutboxRelayService(db, sqsService as any);

    await service.relay('notification.email', 'https://sqs.example/emails', 10, {
      includeEventId: true,
    });

    expect(sqsService.sendMessage).toHaveBeenCalledWith('https://sqs.example/emails', {
      eventId: 'row-9',
      payload: { notificationId: 'n-1' },
    });
  });

  it('does nothing when there are no pending rows', async () => {
    const { db } = createDbStub([]);
    const sqsService = { sendMessage: vi.fn() };
    const service = new OutboxRelayService(db, sqsService as any);

    await service.relay('verification.submitted', 'https://sqs.example/queue');

    expect(sqsService.sendMessage).not.toHaveBeenCalled();
  });

  it('bumps attempts and stays pending when the send fails', async () => {
    const rows = [{ id: 'row-1', payload: { verificationId: 'verif-1' }, attempts: 1 }];
    const { db, set } = createDbStub(rows);
    const sqsService = { sendMessage: vi.fn().mockRejectedValue(new Error('SQS unavailable')) };
    const service = new OutboxRelayService(db, sqsService as any);

    await service.relay('verification.submitted', 'https://sqs.example/queue');

    expect(set).toHaveBeenCalledWith({ attempts: 2, status: 'pending' });
  });

  it('marks a row failed once it hits the max attempt count', async () => {
    const rows = [{ id: 'row-1', payload: { verificationId: 'verif-1' }, attempts: 4 }];
    const { db, set } = createDbStub(rows);
    const sqsService = { sendMessage: vi.fn().mockRejectedValue(new Error('SQS unavailable')) };
    const service = new OutboxRelayService(db, sqsService as any);

    await service.relay('verification.submitted', 'https://sqs.example/queue');

    expect(set).toHaveBeenCalledWith({ attempts: 5, status: 'failed' });
  });
});

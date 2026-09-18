import { describe, expect, it, vi } from 'vitest';
import { VERIFICATION_SUBMITTED_EVENT, VerificationsService } from './verifications.service.js';

function createDbStub(insertedVerification: { id: string; status: string }) {
  const returning = vi.fn().mockResolvedValue([insertedVerification]);
  const values = vi.fn().mockReturnValue({ returning });
  const insert = vi.fn().mockReturnValue({ values });
  const db: any = { insert };
  db.transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db));
  return { db, insert, values };
}

describe('VerificationsService.submit', () => {
  it('checks file ownership, inserts the verification, and enqueues its job in the same transaction', async () => {
    const insertedVerification = { id: 'verif-1', status: 'pending' };
    const { db, insert } = createDbStub(insertedVerification);
    const outboxService = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const filesService = { assertOwnedReadyPrivate: vi.fn().mockResolvedValue(undefined) };
    const notificationsService = {};
    const service = new VerificationsService(
      db,
      outboxService as any,
      filesService as any,
      notificationsService as any,
    );

    const result = await service.submit(
      { businessId: 'biz-1', documentFileId: 'file-1' },
      'user-1',
    );

    expect(filesService.assertOwnedReadyPrivate).toHaveBeenCalledWith('file-1', 'user-1');
    expect(insert).toHaveBeenCalled();
    expect(outboxService.enqueue).toHaveBeenCalledWith(db, VERIFICATION_SUBMITTED_EVENT, {
      verificationId: 'verif-1',
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: 'verif-1',
        status: 'pending',
        displayStatus: '가승인',
        detailStatus: '인증 대기',
      }),
    );
  });

  it('does not insert a verification row when the file ownership check fails', async () => {
    const { db, insert } = createDbStub({ id: 'verif-1', status: 'pending' });
    const outboxService = { enqueue: vi.fn() };
    const filesService = {
      assertOwnedReadyPrivate: vi.fn().mockRejectedValue(new Error('not owned')),
    };
    const service = new VerificationsService(
      db,
      outboxService as any,
      filesService as any,
      {} as any,
    );

    await expect(
      service.submit({ businessId: 'biz-1', documentFileId: 'file-1' }, 'user-1'),
    ).rejects.toThrow('not owned');

    expect(insert).not.toHaveBeenCalled();
    expect(outboxService.enqueue).not.toHaveBeenCalled();
  });
});

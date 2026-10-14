import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { VERIFICATION_SUBMITTED_EVENT, VerificationsService } from './verifications.service.js';

function createDbStub(
  insertedVerification: { id: string; status: string },
  businessOwner: string | null = 'user-1',
) {
  const returning = vi.fn().mockResolvedValue([insertedVerification]);
  const values = vi.fn().mockReturnValue({ returning });
  const insert = vi.fn().mockReturnValue({ values });
  const limit = vi.fn().mockResolvedValue(businessOwner ? [{ ownerUserId: businessOwner }] : []);
  const select = vi.fn().mockReturnValue({
    from: () => ({ where: () => ({ limit }) }),
  });
  const db: any = { insert, select };
  db.transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db));
  return { db, insert, values };
}

describe('VerificationsService.findById access control', () => {
  const owner = { id: 'user-1', email: 'o@x.com', name: 'Owner', role: 'user' };
  const admin = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: 'admin' };
  const stranger = { id: 'user-2', email: 's@x.com', name: 'Stranger', role: 'user' };

  const verificationRow = {
    verification: {
      id: 'verif-1',
      businessId: 'biz-1',
      status: 'pending',
      ocrResult: { businessName: '한빛협회', registrationNumber: '123-45-67890' },
    },
    ownerUserId: owner.id,
  };

  function createFindDb(row: typeof verificationRow | undefined) {
    const db: any = {
      select: vi.fn(() => ({
        from: () => ({
          innerJoin: () => ({
            where: () => ({ limit: vi.fn().mockResolvedValue(row ? [row] : []) }),
          }),
        }),
      })),
    };
    return db;
  }

  it('serves the OCR result to the business owner', async () => {
    const service = new VerificationsService(createFindDb(verificationRow), {} as any, {} as any);
    await expect(service.findById('verif-1', owner)).resolves.toMatchObject({
      id: 'verif-1',
      ocrResult: { businessName: '한빛협회' },
      displayStatus: '가승인',
    });
  });

  it('serves the verification to an admin', async () => {
    const service = new VerificationsService(createFindDb(verificationRow), {} as any, {} as any);
    await expect(service.findById('verif-1', admin)).resolves.toMatchObject({ id: 'verif-1' });
  });

  it('hides another user’s business verification behind 404 (no IDOR)', async () => {
    const service = new VerificationsService(createFindDb(verificationRow), {} as any, {} as any);
    await expect(service.findById('verif-1', stranger)).rejects.toThrow(NotFoundException);
  });

  it('returns 404 for a missing verification regardless of the caller', async () => {
    const service = new VerificationsService(createFindDb(undefined), {} as any, {} as any);
    await expect(service.findById('verif-x', admin)).rejects.toThrow(NotFoundException);
  });
});

describe('VerificationsService.submit', () => {
  it('checks file ownership, inserts the verification, and enqueues its job in the same transaction', async () => {
    const insertedVerification = { id: 'verif-1', status: 'pending' };
    const { db, insert } = createDbStub(insertedVerification);
    const outboxService = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const filesService = { assertOwnedReadyPrivate: vi.fn().mockResolvedValue(undefined) };
    const service = new VerificationsService(db, outboxService as any, filesService as any);

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
    const service = new VerificationsService(db, outboxService as any, filesService as any);

    await expect(
      service.submit({ businessId: 'biz-1', documentFileId: 'file-1' }, 'user-1'),
    ).rejects.toThrow('not owned');

    expect(insert).not.toHaveBeenCalled();
    expect(outboxService.enqueue).not.toHaveBeenCalled();
  });

  it('rejects a verification for a business the user does not own', async () => {
    const { db, insert } = createDbStub({ id: 'verif-1', status: 'pending' }, 'someone-else');
    const outboxService = { enqueue: vi.fn() };
    const filesService = { assertOwnedReadyPrivate: vi.fn() };
    const service = new VerificationsService(db, outboxService as any, filesService as any);

    await expect(
      service.submit({ businessId: 'biz-1', documentFileId: 'file-1' }, 'user-1'),
    ).rejects.toThrow('기업 정보를 찾을 수 없습니다');

    expect(filesService.assertOwnedReadyPrivate).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });
});

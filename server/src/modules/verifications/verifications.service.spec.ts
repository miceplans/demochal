import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { VerificationsService } from './verifications.service.js';

function createDbStub(
  insertedVerification: { id: string; status: string },
  businessOwner: string | null = 'user-1',
  businessStatus = 'verified',
) {
  const returning = vi.fn().mockResolvedValue([insertedVerification]);
  const values = vi.fn().mockReturnValue({ returning });
  const insert = vi.fn().mockReturnValue({ values });
  const limit = vi
    .fn()
    .mockResolvedValue(
      businessOwner ? [{ ownerUserId: businessOwner, verificationStatus: businessStatus }] : [],
    );
  const select = vi.fn().mockReturnValue({
    from: () => ({ where: () => ({ limit }) }),
  });
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set });
  const db: any = { insert, select, update };
  db.transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db));
  return { db, insert, values, update, set };
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
  it('auto-approves the verification, its business and notifies the owner in one transaction', async () => {
    const insertedVerification = { id: 'verif-1', status: 'verified' };
    const { db, insert, values, set } = createDbStub(insertedVerification);
    const notifications = { create: vi.fn().mockResolvedValue(undefined) };
    const filesService = { assertOwnedReadyPrivate: vi.fn().mockResolvedValue(undefined) };
    const service = new VerificationsService(db, filesService as any, notifications as any);

    const result = await service.submit(
      { businessId: 'biz-1', documentFileId: 'file-1' },
      'user-1',
    );

    expect(filesService.assertOwnedReadyPrivate).toHaveBeenCalledWith('file-1', 'user-1');
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ status: 'verified' }));
    expect(set).toHaveBeenCalledWith({ verificationStatus: 'verified' });
    expect(notifications.create).toHaveBeenCalledWith(
      'user-1',
      'verification.result',
      expect.objectContaining({ verificationId: 'verif-1', status: 'verified' }),
      db,
    );
    expect(result).toEqual(
      expect.objectContaining({ id: 'verif-1', status: 'verified', displayStatus: '승인' }),
    );
  });

  it('keeps an admin-blocked business pending without lifting the block', async () => {
    const { db, values, update } = createDbStub(
      { id: 'verif-1', status: 'pending' },
      'user-1',
      'rejected',
    );
    const notifications = { create: vi.fn() };
    const filesService = { assertOwnedReadyPrivate: vi.fn().mockResolvedValue(undefined) };
    const service = new VerificationsService(db, filesService as any, notifications as any);

    const result = await service.submit(
      { businessId: 'biz-1', documentFileId: 'file-1' },
      'user-1',
    );

    expect(values).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }));
    expect(update).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        status: 'pending',
        displayStatus: '가승인',
        detailStatus: '인증 대기',
      }),
    );
  });

  it('does not insert a verification row when the file ownership check fails', async () => {
    const { db, insert } = createDbStub({ id: 'verif-1', status: 'verified' });
    const notifications = { create: vi.fn() };
    const filesService = {
      assertOwnedReadyPrivate: vi.fn().mockRejectedValue(new Error('not owned')),
    };
    const service = new VerificationsService(db, filesService as any, notifications as any);

    await expect(
      service.submit({ businessId: 'biz-1', documentFileId: 'file-1' }, 'user-1'),
    ).rejects.toThrow('not owned');

    expect(insert).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('rejects a verification for a business the user does not own', async () => {
    const { db, insert } = createDbStub({ id: 'verif-1', status: 'verified' }, 'someone-else');
    const filesService = { assertOwnedReadyPrivate: vi.fn() };
    const service = new VerificationsService(db, filesService as any, {} as any);

    await expect(
      service.submit({ businessId: 'biz-1', documentFileId: 'file-1' }, 'user-1'),
    ).rejects.toThrow('기업 정보를 찾을 수 없습니다');

    expect(filesService.assertOwnedReadyPrivate).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });
});

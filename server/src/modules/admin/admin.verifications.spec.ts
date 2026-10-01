import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { certificates } from '../../db/schema.js';
import {
  createDbStub,
  collectStrings,
  createNotificationsStub,
  referencesColumn,
  createFilesStub,
  createService,
  verificationRow,
  businessRow,
} from './admin.test-helpers.js';

describe('AdminService — verifications', () => {
  it('approve sets verification + business verified and notifies the owner', async () => {
    const updatedVerification = { ...verificationRow, status: 'verified' };
    const { db, setCalls } = createDbStub({
      select: [[verificationRow], [businessRow]],
      update: [[updatedVerification], []],
    });
    const { service, notifications } = createService(db);

    const result = await service.approveVerification('v1');

    expect(result).toEqual(updatedVerification);
    expect(setCalls[0]).toEqual([
      expect.objectContaining({ status: 'verified', updatedAt: expect.any(Date) }),
    ]);
    expect(setCalls[1]).toEqual([{ verificationStatus: 'verified' }]);
    expect(notifications.create).toHaveBeenCalledWith('owner-1', 'verification.result', {
      verificationId: 'v1',
      status: 'verified',
    });
  });

  it('reject records the reason, rejects the business and notifies the owner', async () => {
    const updatedVerification = {
      ...verificationRow,
      status: 'rejected',
      rejectionReason: '서류 불일치',
    };
    const { db, setCalls } = createDbStub({
      select: [[verificationRow], [businessRow]],
      update: [[updatedVerification], []],
    });
    const { service, notifications } = createService(db);

    const result = await service.rejectVerification('v1', '서류 불일치');

    expect(result).toEqual(updatedVerification);
    expect(setCalls[0]).toEqual([
      expect.objectContaining({
        status: 'rejected',
        rejectionReason: '서류 불일치',
        updatedAt: expect.any(Date),
      }),
    ]);
    expect(setCalls[1]).toEqual([{ verificationStatus: 'rejected' }]);
    expect(notifications.create).toHaveBeenCalledWith('owner-1', 'verification.result', {
      verificationId: 'v1',
      status: 'rejected',
      reason: '서류 불일치',
    });
  });

  it('refuses a duplicate decision without updating or notifying again', async () => {
    const { db } = createDbStub({ select: [[{ ...verificationRow, status: 'verified' }]] });
    const { service, notifications } = createService(db);

    await expect(service.approveVerification('v1')).rejects.toBeInstanceOf(ConflictException);
    expect(db.update).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('throws NotFound for an unknown verification', async () => {
    const { db } = createDbStub({ select: [[]] });
    const { service } = createService(db);

    await expect(service.approveVerification('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AdminService — certificates', () => {
  const certificateRow = {
    id: 'c1',
    userId: 'u1',
    title: '2025 공공데이터 활용 대회 대상',
    category: 'award',
    fileId: 'f1',
    status: 'pending',
  };

  it('approve verifies the certificate and appends a new badge', async () => {
    const updated = { ...certificateRow, status: 'verified' };
    const owner = { id: 'u1', name: '김수아', badges: ['기존 뱃지'] };
    const { db, setCalls } = createDbStub({
      select: [[certificateRow], [owner]],
      update: [[updated], []],
    });
    const { service } = createService(db);

    const result = await service.verifyCertificate('c1', { action: 'approve' });

    expect(result).toEqual({
      id: 'c1',
      user: '김수아',
      award: certificateRow.title,
      category: 'award',
      fileId: 'f1',
      status: 'verified',
    });
    expect(setCalls[1]).toEqual([{ badges: expect.anything() }]);
  });

  it('approve appends the badge with one atomic conditional UPDATE (no read-modify-write)', async () => {
    const updated = { ...certificateRow, status: 'verified' };
    const owner = { id: 'u1', name: '김수아', badges: [certificateRow.title] };
    const { db, setCalls } = createDbStub({
      select: [[certificateRow], [owner]],
      update: [[updated], []],
    });
    const { service } = createService(db);

    await service.verifyCertificate('c1', { action: 'approve' });

    expect(db.update).toHaveBeenCalledTimes(2);
    const sqlText = collectStrings((setCalls[1]![0] as { badges: unknown }).badges).join(' ');
    expect(sqlText).toContain(certificateRow.title);
  });

  it('refuses to decide a certificate that already has that status (no duplicate badge)', async () => {
    const { db } = createDbStub({ select: [[{ ...certificateRow, status: 'verified' }]] });
    const { service } = createService(db);

    await expect(service.verifyCertificate('c1', { action: 'approve' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(db.update).not.toHaveBeenCalled();
  });

  it('reject stores the rejection reason', async () => {
    const updated = { ...certificateRow, status: 'rejected', rejectionReason: '이미지 훼손' };
    const owner = { id: 'u1', name: '김수아', badges: [] };
    const { db, setCalls } = createDbStub({
      select: [[certificateRow], [owner]],
      update: [[updated], []],
    });
    const { service } = createService(db);

    const result = await service.verifyCertificate('c1', {
      action: 'reject',
      reason: '이미지 훼손',
    });

    expect(result.status).toBe('rejected');
    expect(setCalls[0]).toEqual([
      expect.objectContaining({ status: 'rejected', rejectionReason: '이미지 훼손' }),
    ]);
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it('revokes the badge when a verified certificate is flipped to rejected', async () => {
    const verified = { ...certificateRow, status: 'verified' };
    const owner = { id: 'u1', name: '김수아', badges: [certificateRow.title] };
    const { db, setCalls } = createDbStub({
      select: [[verified], [owner]],
      update: [[{ ...verified, status: 'rejected' }], []],
    });
    const { service } = createService(db);

    await service.verifyCertificate('c1', { action: 'reject', reason: '위조 확인' });

    expect(db.update).toHaveBeenCalledTimes(2);
    expect(setCalls[1]).toEqual([{ badges: expect.anything() }]);
  });

  it('reject without a reason is refused before touching the DB', async () => {
    const { db } = createDbStub();
    const { service } = createService(db);

    await expect(
      service.verifyCertificate('c1', { action: 'reject', reason: '  ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.select).not.toHaveBeenCalled();
  });

  describe('list', () => {
    const base = {
      certificate: {
        id: 'c1',
        title: '대상',
        category: 'award',
        fileId: 'f1',
        status: 'pending',
      },
      userName: '김수아',
    };

    it('filters by category', async () => {
      const { db, selectWhereCalls } = createDbStub({ select: [[]] });
      const { service } = createService(db);

      await service.listCertificates('pending', undefined, 'participation');

      const where = selectWhereCalls[0]?.[0];
      expect(referencesColumn(where, certificates.category)).toBe(true);
      expect(collectStrings(where)).toContain('participation');
    });

    it('presigns private originals and never exposes a raw key', async () => {
      const privateFile = {
        id: 'f1',
        bucket: 'private',
        key: 'pending/f1.png',
        uploadStatus: 'ready',
        contentType: 'image/png',
      };
      const { db } = createDbStub({ select: [[{ ...base, file: privateFile }]] });
      const files = createFilesStub();
      const { service } = createService(db, createNotificationsStub(), undefined, files);

      const [row] = await service.listCertificates();

      expect(files.getPrivateReadUrl).toHaveBeenCalledWith('pending/f1.png');
      expect(row).toMatchObject({
        fileUrl: 'https://signed.example/pending/f1.png',
        fileContentType: 'image/png',
      });
    });

    it('returns no URL for a missing or unfinished upload', async () => {
      const pendingFile = {
        id: 'f1',
        bucket: 'private',
        key: 'pending/f1.png',
        uploadStatus: 'pending',
        contentType: 'image/png',
      };
      const { db } = createDbStub({
        select: [
          [
            { ...base, file: pendingFile },
            { ...base, file: null },
          ],
        ],
      });
      const files = createFilesStub();
      const { service } = createService(db, createNotificationsStub(), undefined, files);

      const rows = await service.listCertificates();

      expect(rows.map((row) => row.fileUrl)).toEqual([null, null]);
      expect(files.getPrivateReadUrl).not.toHaveBeenCalled();
    });
  });
});

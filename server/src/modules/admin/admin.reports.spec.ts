import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { reports } from '../../db/schema.js';
import { createDbStub, referencesColumn, createService, reportRow } from './admin.test-helpers.js';

describe('AdminService — reports', () => {
  it('applies status and target type filters when listing reports', async () => {
    const { db, selectWhereCalls } = createDbStub({ select: [[reportRow]] });
    const { service } = createService(db);

    const result = await service.listReports('피싱', 'open', 'challenge');

    expect(result).toHaveLength(1);
    expect(selectWhereCalls).toHaveLength(1);
    expect(referencesColumn(selectWhereCalls[0], reports.content)).toBe(true);
    expect(referencesColumn(selectWhereCalls[0], reports.status)).toBe(true);
    expect(referencesColumn(selectWhereCalls[0], reports.targetType)).toBe(true);
  });

  it('omits optional report filters when they are not provided', async () => {
    const { db, selectWhereCalls } = createDbStub({ select: [[reportRow]] });
    const { service } = createService(db);

    await service.listReports();

    expect(selectWhereCalls).toEqual([[undefined]]);
  });

  it('resolve sets resolved + note + resolvedAt and maps the contract shape', async () => {
    const updated = { ...reportRow, status: 'resolved', note: '조치 완료' };
    const { db, setCalls } = createDbStub({ update: [[updated]] });
    const { service } = createService(db);

    const result = await service.resolveReport('r1', { action: 'resolve', note: '조치 완료' });

    expect(setCalls[0]).toEqual([
      expect.objectContaining({
        status: 'resolved',
        note: '조치 완료',
        resolvedAt: expect.any(Date),
      }),
    ]);
    expect(result).toEqual({
      id: 'r1',
      content: '2025 AI챌린지',
      targetType: 'challenge',
      org: '테스트기관',
      summary: '피싱 의심',
      detail: '상세 내용',
      reporter: '김*아',
      reportedAt: reportRow.createdAt,
      status: 'resolved',
    });
  });

  it('dismiss sets dismissed with a null note when omitted', async () => {
    const updated = { ...reportRow, status: 'dismissed', note: null };
    const { db, setCalls } = createDbStub({ update: [[updated]] });
    const { service } = createService(db);

    const result = await service.resolveReport('r1', { action: 'dismiss' });

    expect(setCalls[0]).toEqual([expect.objectContaining({ status: 'dismissed', note: null })]);
    expect(result.status).toBe('dismissed');
  });

  it('throws NotFound when no report row was updated', async () => {
    const { db } = createDbStub({ update: [[]] });
    const { service } = createService(db);

    await expect(service.resolveReport('missing', { action: 'resolve' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('refuses to re-process a report that is no longer open', async () => {
    const { db } = createDbStub({ update: [[]], select: [[{ id: 'r1' }]] });
    const { service } = createService(db);

    await expect(service.resolveReport('r1', { action: 'dismiss' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

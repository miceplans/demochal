import { describe, expect, it } from 'vitest';
import { businesses } from '../../db/schema.js';
import {
  createDbStub,
  collectStrings,
  referencesColumn,
  createService,
} from './admin.test-helpers.js';

describe('AdminService — businesses', () => {
  const businessListRow = {
    id: 'b1',
    name: '세모재단',
    type: '비영리' as string | null,
    registrationNumber: '123-45-67890',
    verificationStatus: 'pending',
    createdAt: new Date('2026-09-01T00:00:00Z'),
  };
  const statCounts = [[{ count: 1 }], [{ count: 0 }], [{ count: 0 }], [{ count: 1 }]];

  it('filters by businesses.type and returns the stored type', async () => {
    const { db, selectWhereCalls } = createDbStub({
      select: [...statCounts, [businessListRow], []],
    });
    const { service } = createService(db);

    const result = await service.listBusinesses(undefined, '비영리');

    const listWhere = selectWhereCalls[3]?.[0];
    expect(referencesColumn(listWhere, businesses.type)).toBe(true);
    expect(collectStrings(listWhere)).toContain('비영리');
    expect(result.items[0]?.type).toBe('비영리');
  });

  it("falls back to '미지정' when a business has no type", async () => {
    const { db } = createDbStub({
      select: [...statCounts, [{ ...businessListRow, type: null }], []],
    });
    const { service } = createService(db);

    const result = await service.listBusinesses();

    expect(result.items[0]?.type).toBe('미지정');
  });

  it('returns the latest verification id so approve/reject target the request, not the business', async () => {
    const { db } = createDbStub({
      select: [
        ...statCounts,
        [businessListRow, { ...businessListRow, id: 'b2' }],
        // desc(createdAt): v-new is the latest for b1; b2 has none.
        [
          { id: 'v-new', businessId: 'b1', status: 'pending', ocrResult: null },
          { id: 'v-old', businessId: 'b1', status: 'rejected', ocrResult: null },
        ],
      ],
    });
    const { service } = createService(db);

    const result = await service.listBusinesses();

    expect(result.items.map((item) => [item.id, item.verificationId])).toEqual([
      ['b1', 'v-new'],
      ['b2', null],
    ]);
  });

  it("counts '승인' and filters by the canonical verified status", async () => {
    const { db, selectWhereCalls } = createDbStub({ select: [...statCounts, [], []] });
    const { service } = createService(db);

    await service.listBusinesses(undefined, undefined, 'verified');

    // [0] 승인 count, [1] 거부, [2] 대기, [3] list filter
    expect(collectStrings(selectWhereCalls[0]?.[0])).toContain('verified');
    expect(collectStrings(selectWhereCalls[3]?.[0])).toContain('verified');
  });

  it('marks NTS success from a verified verification row', async () => {
    const { db } = createDbStub({
      select: [
        ...statCounts,
        [{ ...businessListRow, verificationStatus: 'verified' }],
        [{ id: 'v1', businessId: 'b1', status: 'verified', ocrResult: null }],
      ],
    });
    const { service } = createService(db);

    const result = await service.listBusinesses();

    expect(result.items[0]).toMatchObject({ nts: 'success', status: 'verified' });
  });
});

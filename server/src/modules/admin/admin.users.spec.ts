import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { reports, users } from '../../db/schema.js';
import {
  createDbStub,
  collectStrings,
  referencesColumn,
  createService,
} from './admin.test-helpers.js';

describe('AdminService — users', () => {
  it('suspend sets suspended/reason/at and returns the masked entry', async () => {
    const userRow = {
      id: 'u1',
      name: '김수아',
      email: 'kim.dev@gmail.com',
      position: null,
      suspended: true,
      suspendedReason: 'spam',
    };
    const { db, setCalls } = createDbStub({
      select: [[{ id: 'u1', role: 'user' }], [{ reportedUserId: 'u1', count: 3 }]],
      update: [[userRow]],
    });
    const { service } = createService(db);

    const result = await service.suspendUser('u1', { suspended: true, reason: 'spam' });

    expect(setCalls[0]).toEqual([
      expect.objectContaining({
        suspended: true,
        suspendedReason: 'spam',
        suspendedAt: expect.any(Date),
      }),
    ]);
    expect(result).toEqual({
      id: 'u1',
      name: '김수아',
      email: 'k***@gmail.com',
      position: '',
      reports: 3,
      status: 'suspended',
      suspendedReason: 'spam',
    });
  });

  it('lift clears the suspension fields', async () => {
    const userRow = {
      id: 'u1',
      name: '김수아',
      email: 'kim.dev@gmail.com',
      position: '프론트엔드',
      suspended: false,
      suspendedReason: null,
    };
    const { db, setCalls } = createDbStub({
      select: [[{ id: 'u1', role: 'admin' }], []],
      update: [[userRow]],
    });
    const { service } = createService(db);

    const result = await service.suspendUser('u1', { suspended: false });

    expect(setCalls[0]).toEqual([{ suspended: false, suspendedReason: null, suspendedAt: null }]);
    expect(result).toEqual({
      id: 'u1',
      name: '김수아',
      email: 'k***@gmail.com',
      position: '프론트엔드',
      reports: 0,
      status: 'active',
      suspendedReason: null,
    });
  });

  it('refuses to suspend an admin account', async () => {
    const { db } = createDbStub({ select: [[{ id: 'a1', role: 'admin' }]] });
    const { service } = createService(db);

    await expect(service.suspendUser('a1', { suspended: true })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(db.update).not.toHaveBeenCalled();
  });

  it('suspend throws NotFound when the user does not exist', async () => {
    const { db } = createDbStub({ select: [[]] });
    const { service } = createService(db);

    await expect(service.suspendUser('missing', { suspended: true })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('list counts reports filed against each user (reportedUserId), not by them', async () => {
    const rows = [
      { id: 'u1', name: '김수아', email: 'kim@a.com', position: '백엔드', suspended: false },
      { id: 'u2', name: '이도윤', email: 'lee@a.com', position: null, suspended: true },
    ];
    const { db, selectWhereCalls } = createDbStub({
      select: [rows, [{ count: 2 }], [{ reportedUserId: 'u2', count: 4 }]],
    });
    const { service } = createService(db);

    const result = await service.listUsers();

    expect(result.items.map((row) => [row.id, row.reports, row.status])).toEqual([
      ['u1', 0, 'active'],
      ['u2', 4, 'suspended'],
    ]);
    expect(result).toMatchObject({ total: 2, page: 1, pageSize: 30 });
    const countWhere = selectWhereCalls[2]?.[0];
    expect(referencesColumn(countWhere, reports.reportedUserId)).toBe(true);
    expect(referencesColumn(countWhere, reports.reporterUserId)).toBe(false);
  });

  it('list applies joinedWithin and position filters', async () => {
    const { db, selectWhereCalls } = createDbStub({ select: [[], [{ count: 0 }]] });
    const { service } = createService(db);

    await service.listUsers(undefined, undefined, '30d', '프론트엔드');

    const where = selectWhereCalls[0]?.[0];
    expect(referencesColumn(where, users.createdAt)).toBe(true);
    expect(referencesColumn(where, users.position)).toBe(true);
    expect(collectStrings(where)).toContain('%프론트엔드%');
    // No users → the report-count query is skipped (rows + total only).
    expect(db.select).toHaveBeenCalledTimes(2);
    // 총 개수 쿼리에도 같은 필터가 적용된다.
    expect(referencesColumn(selectWhereCalls[1]?.[0], users.position)).toBe(true);
  });

  it('list pages with limit/offset and clamps invalid page params', async () => {
    const { db, limitCalls, offsetCalls } = createDbStub({ select: [[], [{ count: 95 }]] });
    const { service } = createService(db);

    const result = await service.listUsers(undefined, undefined, undefined, undefined, 3, 20);
    expect(limitCalls[0]).toEqual([20]);
    expect(offsetCalls[0]).toEqual([40]);
    expect(result).toMatchObject({ total: 95, page: 3, pageSize: 20 });

    const clamped = await createService(
      createDbStub({ select: [[], [{ count: 0 }]] }).db,
    ).service.listUsers(undefined, undefined, undefined, undefined, -5, 9999);
    expect(clamped).toMatchObject({ page: 1, pageSize: 50 });
  });

  it('list ignores an unknown joinedWithin value', async () => {
    const { db, selectWhereCalls } = createDbStub({ select: [[], [{ count: 0 }]] });
    const { service } = createService(db);

    await service.listUsers(undefined, undefined, 'forever');

    expect(selectWhereCalls[0]?.[0]).toBeUndefined();
  });
});

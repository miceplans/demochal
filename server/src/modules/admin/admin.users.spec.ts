import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { reports, users } from '../../db/schema.js';
import {
  createDbStub,
  collectStrings,
  referencesColumn,
  createService,
} from './admin.test-helpers.js';

describe('AdminService — contents', () => {
  const team = {
    id: 't1',
    title: '세모팀',
    openRoles: [
      { role: '프론트엔드', count: 1 },
      { role: '백엔드', count: 2 },
    ],
  };
  const challenge = {
    id: 'ch1',
    title: 'AI 챌린지',
    category: 'IT',
    endDate: new Date(Date.now() + 3 * 86_400_000),
  };

  it('splits filled vs open roles, flags open reports and returns section totals', async () => {
    const { db } = createDbStub({
      select: [
        [{ count: 12 }], // teams total
        [{ team, challengeTitle: 'AI 챌린지' }],
        [
          { teamId: 't1', role: '프론트엔드', count: 1 },
          { teamId: 't1', role: '백엔드', count: 1 },
        ],
        [{ count: 30 }], // challenges total
        [challenge],
        [{ challengeId: 'ch1', count: 1 }],
        [{ targetId: 'ch1' }], // open report on the challenge only
        [],
      ],
    });
    const { service } = createService(db);

    const result = await service.getContents();

    expect(result.teams).toEqual([
      {
        id: 't1',
        name: '세모팀',
        challenge: 'AI 챌린지',
        roles: ['프론트엔드'],
        otherRoles: ['백엔드'],
        members: '2/4명 참여중',
        unread: false,
      },
    ]);
    expect(result.contests[0]).toMatchObject({ id: 'ch1', teams: '팀 모집 1건', unread: true });
    expect(result.teamsTotal).toBe(12);
    expect(result.contestsTotal).toBe(30);
  });

  it('clamps section limits to 1..50 with a default page of 8', async () => {
    const limits: unknown[] = [];
    const db: any = {
      select: vi.fn(() => {
        const proxy: any = new Proxy(function () {}, {
          get(_target, prop) {
            if (prop === 'then') return (resolve: (value: unknown) => unknown) => resolve([]);
            return (...args: unknown[]) => {
              if (prop === 'limit') limits.push(args[0]);
              return proxy;
            };
          },
        });
        return proxy;
      }),
    };
    const { service } = createService(db);

    await service.getContents('500', 'abc');

    // teams, challenges, then the fixed 5-row report log.
    expect(limits).toEqual([50, 8, 5]);
  });
});

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
      select: [rows, [{ reportedUserId: 'u2', count: 4 }]],
    });
    const { service } = createService(db);

    const result = await service.listUsers();

    expect(result.map((row) => [row.id, row.reports, row.status])).toEqual([
      ['u1', 0, 'active'],
      ['u2', 4, 'suspended'],
    ]);
    const countWhere = selectWhereCalls[1]?.[0];
    expect(referencesColumn(countWhere, reports.reportedUserId)).toBe(true);
    expect(referencesColumn(countWhere, reports.reporterUserId)).toBe(false);
  });

  it('list applies joinedWithin and position filters', async () => {
    const { db, selectWhereCalls } = createDbStub({ select: [[]] });
    const { service } = createService(db);

    await service.listUsers(undefined, undefined, '30d', '프론트엔드');

    const where = selectWhereCalls[0]?.[0];
    expect(referencesColumn(where, users.createdAt)).toBe(true);
    expect(referencesColumn(where, users.position)).toBe(true);
    expect(collectStrings(where)).toContain('%프론트엔드%');
    // No users → the report-count query is skipped entirely.
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('list ignores an unknown joinedWithin value', async () => {
    const { db, selectWhereCalls } = createDbStub({ select: [[]] });
    const { service } = createService(db);

    await service.listUsers(undefined, undefined, 'forever');

    expect(selectWhereCalls[0]?.[0]).toBeUndefined();
  });
});

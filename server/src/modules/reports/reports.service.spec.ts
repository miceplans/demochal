import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { maskReporterName, ReportsService } from './reports.service.js';

/** Thenable drizzle chain: every call returns itself, awaiting resolves `resolved`. */
function chainable(resolved: unknown, onValues?: (value: unknown) => void) {
  const proxy: any = new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === 'then') {
        return (onFulfilled: (value: unknown) => unknown) => onFulfilled(resolved);
      }
      return (...args: unknown[]) => {
        if (prop === 'values') onValues?.(args[0]);
        return proxy;
      };
    },
  });
  return proxy;
}

function createDbStub(selectResult: unknown[] = []) {
  const inserted: Record<string, unknown>[] = [];
  const db: any = {
    select: vi.fn(() => chainable(selectResult)),
    insert: vi.fn(() =>
      chainable([{ id: 'r1' }], (value) => void inserted.push(value as Record<string, unknown>)),
    ),
  };
  return { db, inserted };
}

const reporter = { id: 'u-reporter', email: 'kim@example.com', name: '김수아', role: 'user' };
const TARGET_ID = '11111111-1111-1111-1111-111111111111';

describe('maskReporterName', () => {
  it('masks reporter names', () => {
    expect(maskReporterName('김수아')).toBe('김*아');
    expect(maskReporterName('김아')).toBe('김*');
    expect(maskReporterName('김')).toBe('김');
  });
});

describe('ReportsService.create', () => {
  it('stores the masked reporter name', async () => {
    const { db, inserted } = createDbStub();
    const service = new ReportsService(db);

    await service.create({ targetType: 'award', summary: '비방' }, reporter);

    expect(inserted[0]).toMatchObject({
      reporterUserId: 'u-reporter',
      reporterName: '김*아',
      content: '비방',
      status: 'open',
    });
    expect(db.select).not.toHaveBeenCalled();
  });

  it('derives content/org/reportedUserId from the team, ignoring client-sent org', async () => {
    const { db, inserted } = createDbStub([
      { title: 'AI 팀', org: '2026 AI 챌린지', leaderId: 'u-leader' },
    ]);
    const service = new ReportsService(db);

    await service.create(
      { targetType: 'team', targetId: TARGET_ID, summary: '스팸/도배', org: '클라이언트 값' },
      reporter,
    );

    expect(inserted[0]).toMatchObject({
      targetId: TARGET_ID,
      content: 'AI 팀',
      org: '2026 AI 챌린지',
      reportedUserId: 'u-leader',
    });
  });

  it('reports a challenge against its business owner', async () => {
    const { db, inserted } = createDbStub([
      { title: '2026 AI 챌린지', org: '세모재단', ownerId: 'u-owner' },
    ]);
    const service = new ReportsService(db);

    await service.create(
      { targetType: 'challenge', targetId: TARGET_ID, summary: '기타' },
      reporter,
    );

    expect(inserted[0]).toMatchObject({
      content: '2026 AI 챌린지',
      org: '세모재단',
      reportedUserId: 'u-owner',
    });
  });

  it('reports a user profile against that user', async () => {
    const { db, inserted } = createDbStub([{ name: '박민수', position: '디자이너' }]);
    const service = new ReportsService(db);

    await service.create({ targetType: 'user', targetId: TARGET_ID, summary: '비방' }, reporter);

    expect(inserted[0]).toMatchObject({
      content: '박민수',
      org: '디자이너',
      reportedUserId: TARGET_ID,
    });
  });

  it('rejects a missing target with 404 and inserts nothing', async () => {
    const { db } = createDbStub([]);
    const service = new ReportsService(db);

    await expect(
      service.create({ targetType: 'team', targetId: TARGET_ID, summary: '비방' }, reporter),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it.each(['challenge', 'team', 'user'] as const)(
    'rejects a missing targetId for targetType %s with 400 and inserts nothing',
    async (targetType) => {
      const { db } = createDbStub();
      const service = new ReportsService(db);

      await expect(
        service.create({ targetType, summary: '비방' }, reporter),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(db.insert).not.toHaveBeenCalled();
    },
  );
});

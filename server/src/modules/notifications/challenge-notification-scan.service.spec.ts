import { describe, expect, it, vi } from 'vitest';
import { ChallengeNotificationScanService } from './challenge-notification-scan.service.js';

function createDbStub(selectResults: unknown[][], insertedPerCall = (n: number) => n) {
  const queue = [...selectResults];
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => Promise.resolve(queue.shift() ?? []),
  };
  const onConflictDoNothing = vi.fn();
  const values = vi.fn((rows: unknown[]) => ({
    onConflictDoNothing: onConflictDoNothing.mockReturnValue({
      returning: () => Promise.resolve(Array.from({ length: insertedPerCall(rows.length) })),
    }),
  }));
  const db = { select: vi.fn(() => chain), insert: vi.fn(() => ({ values })) };
  return { db, values, onConflictDoNothing };
}

const now = new Date('2026-07-01T00:00:00Z');

describe('ChallengeNotificationScanService.scan', () => {
  it('creates deadline, bookmark-open and interest notifications with dedupe keys', async () => {
    const endDate = new Date('2026-07-04T12:00:00Z');
    const { db, values } = createDbStub([
      [
        {
          userId: 'u1',
          challengeId: 'c1',
          title: '공공데이터 챌린지',
          endDate,
          notificationSettings: {},
        },
      ],
      [{ userId: 'u1', challengeId: 'c2', title: '해커톤', notificationSettings: {} }],
      [{ id: 'c3', title: 'AI 챌린지', category: 'AI/데이터' }],
      [{ id: 'u2', interests: ['데이터 · AI'], notificationSettings: {} }],
    ]);
    const service = new ChallengeNotificationScanService(db as any);

    const result = await service.scan(now);

    expect(result).toEqual({ created: 3 });
    const rows = values.mock.calls.flatMap(([r]) => r as any[]);
    expect(rows).toEqual([
      expect.objectContaining({
        userId: 'u1',
        type: 'deadline',
        dedupeKey: 'deadline:c1',
        payload: expect.objectContaining({ challengeId: 'c1', daysLeft: 4 }),
      }),
      expect.objectContaining({
        userId: 'u1',
        type: 'posting',
        dedupeKey: 'posting:open:c2',
        payload: expect.objectContaining({ kind: 'bookmark_open' }),
      }),
      expect.objectContaining({
        userId: 'u2',
        type: 'posting',
        dedupeKey: 'posting:new:c3',
        payload: expect.objectContaining({ kind: 'interest_new', category: 'AI/데이터' }),
      }),
    ]);
  });

  it('matches interest vocabulary with the shared token normalizer', async () => {
    // user-design.ts 관심분야('IT · 소프트웨어')와 category('IT/SW')는 문자열이 달라
    // 예전 jsonb_exists 조인으로는 매칭되지 않았다 — 토큰 정규화 매칭이 잡아야 한다.
    const { db, values } = createDbStub([
      [],
      [],
      [
        { id: 'c-it', title: 'SW 공모전', category: 'IT/SW' },
        { id: 'c-ai', title: 'AI 공모전', category: 'AI/데이터' },
      ],
      [
        { id: 'u-it', interests: ['IT · 소프트웨어'], notificationSettings: {} },
        { id: 'u-ai', interests: ['데이터 · AI'], notificationSettings: {} },
        { id: 'u-lit', interests: ['문학 · 글쓰기'], notificationSettings: {} },
      ],
    ]);
    const service = new ChallengeNotificationScanService(db as any);

    expect(await service.scan(now)).toEqual({ created: 2 });
    const rows = values.mock.calls.flatMap(([r]) => r as any[]);
    expect(rows).toEqual([
      expect.objectContaining({
        userId: 'u-it',
        dedupeKey: 'posting:new:c-it',
        payload: expect.objectContaining({ kind: 'interest_new', challengeId: 'c-it' }),
      }),
      expect.objectContaining({
        userId: 'u-ai',
        dedupeKey: 'posting:new:c-ai',
        payload: expect.objectContaining({ kind: 'interest_new', challengeId: 'c-ai' }),
      }),
    ]);
  });

  it('skips users who opted out in notification settings', async () => {
    const endDate = new Date('2026-07-04T12:00:00Z');
    const { db, values } = createDbStub([
      [
        {
          userId: 'u-on',
          challengeId: 'c1',
          title: 't',
          endDate,
          notificationSettings: { deadline: true },
        },
        {
          userId: 'u-off',
          challengeId: 'c1',
          title: 't',
          endDate,
          notificationSettings: { deadline: false },
        },
      ],
      [
        {
          userId: 'u-on2',
          challengeId: 'c2',
          title: 't',
          notificationSettings: { challenge: true },
        },
        {
          userId: 'u-off2',
          challengeId: 'c2',
          title: 't',
          notificationSettings: { challenge: false },
        },
      ],
      [{ id: 'c3', title: 't', category: 'AI/데이터' }],
      [
        { id: 'u-on3', interests: ['데이터 · AI'], notificationSettings: { challenge: true } },
        { id: 'u-off3', interests: ['데이터 · AI'], notificationSettings: { challenge: false } },
      ],
    ]);
    const service = new ChallengeNotificationScanService(db as any);

    expect(await service.scan(now)).toEqual({ created: 3 });
    const rows = values.mock.calls.flatMap(([r]) => r as any[]);
    expect(rows.map((row) => row.userId).sort()).toEqual(['u-on', 'u-on2', 'u-on3']);
    expect(values).toHaveBeenCalledTimes(3);
  });

  it('counts only rows actually inserted, so a repeated scan creates nothing', async () => {
    const { db, onConflictDoNothing } = createDbStub(
      [
        [
          {
            userId: 'u1',
            challengeId: 'c1',
            title: 't',
            endDate: new Date('2026-07-02T00:00:00Z'),
            notificationSettings: {},
          },
        ],
        [],
        [],
      ],
      () => 0,
    );
    const service = new ChallengeNotificationScanService(db as any);

    expect(await service.scan(now)).toEqual({ created: 0 });
    expect(onConflictDoNothing).toHaveBeenCalled();
  });

  it('does not insert anything when nothing matches', async () => {
    const { db, values } = createDbStub([[], [], []]);
    const service = new ChallengeNotificationScanService(db as any);

    expect(await service.scan(now)).toEqual({ created: 0 });
    expect(values).not.toHaveBeenCalled();
  });
});

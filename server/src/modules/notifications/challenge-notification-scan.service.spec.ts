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
      [{ userId: 'u1', challengeId: 'c1', title: '공공데이터 챌린지', endDate }],
      [{ userId: 'u1', challengeId: 'c2', title: '해커톤' }],
      [{ userId: 'u2', challengeId: 'c3', title: 'AI 챌린지', category: 'AI/데이터' }],
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

  it('counts only rows actually inserted, so a repeated scan creates nothing', async () => {
    const { db, onConflictDoNothing } = createDbStub(
      [
        [
          {
            userId: 'u1',
            challengeId: 'c1',
            title: 't',
            endDate: new Date('2026-07-02T00:00:00Z'),
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

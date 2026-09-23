import { describe, expect, it, vi } from 'vitest';
import { challenges } from '../../db/schema.js';
import { ChallengesService } from './challenges.service.js';

type ChallengeRow = {
  id: string;
  category: string | null;
  createdAt: Date;
  status: string;
  endDate: Date | null;
};

function queryChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn().mockReturnValue({ limit });
  const groupBy = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit, orderBy, groupBy });
  const from = vi.fn().mockReturnValue({ where });
  return { from, where, orderBy, groupBy };
}

function createService(
  user: { interests: string[]; onboardingSurvey?: unknown } | undefined,
  candidates: ChallengeRow[],
  views: { challengeId: string; total: number }[] = [],
  bookmarkCounts: { challengeId: string; total: number }[] = [],
) {
  const db = { select: vi.fn() } as any;
  const userQuery = queryChain(user ? [user] : []);
  const candidatesQuery = queryChain(candidates);
  const viewsQuery = queryChain(views);
  const bookmarksQuery = queryChain(bookmarkCounts);
  db.select
    .mockReturnValueOnce(userQuery)
    .mockReturnValueOnce(candidatesQuery)
    .mockReturnValueOnce(viewsQuery)
    .mockReturnValueOnce(bookmarksQuery);
  return { service: new ChallengesService(db, {} as any), candidatesQuery };
}

function challenge(id: string, category: string | null, createdAt: string): ChallengeRow {
  return {
    id,
    category,
    createdAt: new Date(createdAt),
    status: 'published',
    endDate: new Date('2030-01-01'),
  };
}

function referencesColumn(node: any, column: unknown, seen = new Set<unknown>()): boolean {
  if (node === column) return true;
  if (!node || typeof node !== 'object' || seen.has(node)) return false;
  seen.add(node);
  if (Array.isArray(node)) return node.some((chunk) => referencesColumn(chunk, column, seen));
  return Array.isArray(node.queryChunks) && referencesColumn(node.queryChunks, column, seen);
}

function collectSqlValues(node: any, values: unknown[] = []): unknown[] {
  if (typeof node === 'string' || node instanceof Date) values.push(node);
  if (node?.constructor?.name === 'Param') values.push(node.value);
  if (Array.isArray(node?.value))
    node.value.forEach((chunk: any) => collectSqlValues(chunk, values));
  if (Array.isArray(node)) node.forEach((chunk) => collectSqlValues(chunk, values));
  if (Array.isArray(node?.queryChunks))
    node.queryChunks.forEach((chunk: any) => collectSqlValues(chunk, values));
  return values;
}

describe('ChallengesService.listRecommended', () => {
  it('ranks interest matches first and normalizes IT/SW against IT · 소프트웨어', async () => {
    const matching = challenge('matching', 'IT/SW', '2029-01-01');
    const popular = challenge('popular', '디자인', '2029-02-01');
    const { service } = createService(
      { interests: ['IT · 소프트웨어'], onboardingSurvey: { interests: ['IT · 소프트웨어'] } },
      [matching, popular],
      [{ challengeId: 'popular', total: 49 }],
      [{ challengeId: 'popular', total: 15 }],
    );

    const result = await service.listRecommended('user-1');

    expect(result.items.map((item) => item.id)).toEqual(['matching', 'popular']);
  });

  it('does not match short ASCII interest tokens as substrings of unrelated categories', async () => {
    const mail = challenge('mail', '메일/CRM 마케팅', '2029-02-01');
    const digital = challenge('digital', 'Digital 아트', '2029-02-01');
    const ai = challenge('ai', 'AI', '2029-01-01');
    const { service } = createService({ interests: ['데이터 · AI', 'IT · 소프트웨어'] }, [
      mail,
      digital,
      ai,
    ]);

    const result = await service.listRecommended('user-1');

    expect(result.items.map((item) => item.id)).toEqual(['ai', 'digital', 'mail']);
  });

  it('scores views and bookmarks independently, including their caps', async () => {
    const viewWinner = challenge('view-winner', '디자인', '2029-01-01');
    const almostViewWinner = challenge('almost-view-winner', '창업', '2029-01-01');
    const bookmarkWinner = challenge('bookmark-winner', '영상', '2029-01-01');
    const cappedViews = challenge('capped-views', '사진', '2029-01-01');
    const cappedBookmarks = challenge('capped-bookmarks', '음악', '2029-01-01');
    const exactBookmarkCap = challenge('exact-bookmark-cap', '문학', '2029-02-01');
    const { service } = createService(
      { interests: [] },
      [
        almostViewWinner,
        viewWinner,
        bookmarkWinner,
        cappedViews,
        cappedBookmarks,
        exactBookmarkCap,
      ],
      [
        { challengeId: 'view-winner', total: 50 },
        { challengeId: 'almost-view-winner', total: 49 },
        { challengeId: 'capped-views', total: 999 },
      ],
      [
        { challengeId: 'bookmark-winner', total: 20 },
        { challengeId: 'capped-bookmarks', total: 999 },
        { challengeId: 'exact-bookmark-cap', total: 20 },
      ],
    );

    const result = await service.listRecommended('user-1');

    expect(result.items.map((item) => item.id)).toEqual([
      'exact-bookmark-cap',
      'bookmark-winner',
      'capped-bookmarks',
      'capped-views',
      'view-winner',
      'almost-view-winner',
    ]);
  });

  it('uses a published and unexpired candidate condition without failing for a missing user', async () => {
    const { service, candidatesQuery } = createService(undefined, []);

    await expect(service.listRecommended('missing-user')).resolves.toEqual({ items: [] });
    const condition = candidatesQuery.where.mock.calls[0]![0];
    const values = collectSqlValues(condition);

    expect(referencesColumn(condition, challenges.status)).toBe(true);
    expect(referencesColumn(condition, challenges.endDate)).toBe(true);
    expect(values).toContain('published');
    expect(values.some((value) => value instanceof Date)).toBe(true);
  });

  it('defaults to six results and clamps the requested limit from one through twenty', async () => {
    const candidates = Array.from({ length: 21 }, (_, index) =>
      challenge(String(index).padStart(2, '0'), '기타', new Date(2029, 0, index + 1).toISOString()),
    );
    const low = createService({ interests: [] }, candidates);
    const high = createService({ interests: [] }, candidates);
    const defaultLimit = createService({ interests: [] }, candidates);

    const [lowResult, highResult, defaultResult] = await Promise.all([
      low.service.listRecommended('user-1', 0),
      high.service.listRecommended('user-1', 999),
      defaultLimit.service.listRecommended('user-1'),
    ]);

    expect(lowResult.items).toHaveLength(1);
    expect(highResult.items).toHaveLength(20);
    expect(defaultResult.items).toHaveLength(6);
  });
});

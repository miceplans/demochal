import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { challenges, type ApplicationFormQuestion } from '../../infra/db/schema.js';
import { ChallengesService } from './challenges.service.js';

type ChallengeRow = {
  id: string;
  category: string | null;
  createdAt: Date;
  status: string;
  endDate: Date | null;
  recruitMethod?: string;
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
  return {
    service: new ChallengesService(db, {} as any, createFilesStub() as any),
    candidatesQuery,
  };
}

// posterFileId 검증/포스터 URL 해결은 FilesService 책임 — 스텁으로 고정 동작을 돌려준다.
function createFilesStub(overrides: Record<string, unknown> = {}) {
  return {
    assertReadyPublic: vi.fn().mockResolvedValue({ id: 'file-1' }),
    resolvePublicUrl: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
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

  it('boosts seMOchall application-form challenges above equally scored external ones', async () => {
    const semo = { ...challenge('semo', '디자인', '2029-01-01'), recruitMethod: 'seMOchall' };
    const external = {
      ...challenge('external', '디자인', '2029-02-01'),
      recruitMethod: 'external',
    };
    const { service } = createService({ interests: [] }, [semo, external]);

    const result = await service.listRecommended('user-1');

    expect(result.items.map((item) => item.id)).toEqual(['semo', 'external']);
  });

  it('keeps a double interest match above the boost but not the popularity cap', async () => {
    const semoPlain = {
      ...challenge('semo-plain', '기타', '2029-01-01'),
      recruitMethod: 'seMOchall',
    };
    const popularExternal = {
      ...challenge('popular-external', '기타', '2029-02-01'),
      recruitMethod: 'external',
    };
    const doubleInterestExternal = {
      ...challenge('double-interest-external', '디자인/영상', '2029-03-01'),
      recruitMethod: 'external',
    };
    const { service } = createService(
      { interests: ['디자인', '영상'] },
      [semoPlain, popularExternal, doubleInterestExternal],
      [{ challengeId: 'popular-external', total: 999 }],
      [{ challengeId: 'popular-external', total: 999 }],
    );

    const result = await service.listRecommended('user-1');

    // double-interest (200) > boost (150) > popularity cap (110) — the un-boosted
    // candidates carry no popularity signal so the ordering isolates the boost
    // value against both bounds.
    expect(result.items.map((item) => item.id)).toEqual([
      'double-interest-external',
      'semo-plain',
      'popular-external',
    ]);
  });
});

describe('ChallengesService.list', () => {
  type ListRow = {
    id: string;
    status: string;
    createdAt: Date;
    endDate: Date;
    viewCount: number;
  };

  function row(
    id: string,
    overrides: Partial<Pick<ListRow, 'status' | 'createdAt' | 'endDate'>> & {
      viewCount?: number;
    } = {},
  ): ListRow {
    return {
      id,
      status: overrides.status ?? 'published',
      createdAt: overrides.createdAt ?? new Date('2029-01-01T00:00:00Z'),
      endDate: overrides.endDate ?? new Date('2030-01-01T00:00:00Z'),
      viewCount: overrides.viewCount ?? 0,
    };
  }

  function createListService(rows: unknown[]) {
    const limit = vi.fn().mockResolvedValue(rows);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy, limit });
    const from = vi.fn().mockReturnValue({ where });
    const db = { select: vi.fn().mockReturnValue({ from }) } as any;
    return {
      service: new ChallengesService(db, {} as any, createFilesStub() as any),
      db,
      where,
      orderBy,
    };
  }

  function whereValues(where: ReturnType<typeof createListService>['where']) {
    return collectSqlValues(where.mock.calls[0]![0]);
  }

  // drizzle의 asc()/desc() 래퍼가 StringChunk(' asc'/' desc')를 포함하므로 청크 문자열을 모아 방향을 본다.
  function directionOf(node: unknown): 'asc' | 'desc' | undefined {
    const chunks: string[] = [];
    const walk = (current: any, seen: Set<unknown>) => {
      if (!current || typeof current !== 'object' || seen.has(current)) return;
      seen.add(current);
      if (
        Array.isArray(current.value) &&
        current.value.every((part: unknown) => typeof part === 'string')
      ) {
        chunks.push(...current.value);
      }
      for (const key of ['queryChunks', 'value'] as const) {
        if (Array.isArray(current[key])) {
          current[key].forEach((part: unknown) => walk(part, seen));
        }
      }
    };
    walk(node, new Set());
    return chunks.some((chunk) => chunk.includes(' desc'))
      ? 'desc'
      : chunks.some((chunk) => chunk.includes(' asc'))
        ? 'asc'
        : undefined;
  }

  it('always excludes drafts from the public list', async () => {
    const { service, where } = createListService([]);

    await service.list({ limit: 20 });

    const condition = where.mock.calls[0]![0];
    expect(referencesColumn(condition, challenges.status)).toBe(true);
    expect(whereValues(where)).toContain('draft');
  });

  it('adds a closed exclusion only when includeClosed is false', async () => {
    const withClosed = createListService([]);
    await withClosed.service.list({ limit: 20, includeClosed: true });
    const withoutClosed = createListService([]);
    await withoutClosed.service.list({ limit: 20, includeClosed: false });

    expect(whereValues(withClosed.where).filter((value) => value === 'closed')).toHaveLength(0);
    expect(whereValues(withoutClosed.where).filter((value) => value === 'closed')).toHaveLength(1);
  });

  it('filters by category exact match and searches title/category with ILIKE', async () => {
    const { service, where } = createListService([]);

    await service.list({ limit: 20, category: '디자인', q: '해커톤' });

    const condition = where.mock.calls[0]![0];
    const values = whereValues(where);
    expect(referencesColumn(condition, challenges.category)).toBe(true);
    expect(referencesColumn(condition, challenges.title)).toBe(true);
    expect(values).toContain('디자인');
    expect(values).toContain('%해커톤%');
  });

  it('accepts comma-separated categories and applies target, organizer and prize filters', async () => {
    const { service, where } = createListService([]);

    await service.list({
      limit: 20,
      category: 'IT/SW,디자인',
      targets: '대학생,일반인',
      organizerType: '대기업',
      prizeMin: 3000,
      prizeMax: 8000,
    });

    const condition = where.mock.calls[0]![0];
    const values = whereValues(where);
    expect(referencesColumn(condition, challenges.category)).toBe(true);
    expect(referencesColumn(condition, challenges.targets)).toBe(true);
    expect(referencesColumn(condition, challenges.organizerType)).toBe(true);
    expect(referencesColumn(condition, challenges.prizeAmount)).toBe(true);
    expect(values).toEqual(
      expect.arrayContaining(['IT/SW', '디자인', '대학생', '일반인', '대기업', 3000, 8000]),
    );
  });

  it('orders by endDate ascending for the deadline sort', async () => {
    const { service, orderBy } = createListService([]);

    await service.list({ limit: 20, sort: 'deadline' });

    const primary = orderBy.mock.calls[0]![0];
    const tiebreak = orderBy.mock.calls[0]![1];
    expect(referencesColumn(primary, challenges.endDate)).toBe(true);
    expect(directionOf(primary)).toBe('asc');
    expect(referencesColumn(tiebreak, challenges.id)).toBe(true);
  });

  it('orders by viewCount descending for the popular sort', async () => {
    const { service, orderBy } = createListService([]);

    await service.list({ limit: 20, sort: 'popular' });

    const primary = orderBy.mock.calls[0]![0];
    const tiebreak = orderBy.mock.calls[0]![1];
    expect(referencesColumn(primary, challenges.viewCount)).toBe(true);
    expect(directionOf(primary)).toBe('desc');
    expect(referencesColumn(tiebreak, challenges.id)).toBe(true);
  });

  it('rejects an unknown sort value', async () => {
    const { service, db } = createListService([]);

    await expect(service.list({ limit: 20, sort: 'hot' })).rejects.toThrow('sort must be one of');
    expect(db.select).not.toHaveBeenCalled();
  });

  it('continues past rows sharing the same endDate via the compound cursor', async () => {
    const shared = new Date('2030-01-01T00:00:00Z');
    // 마감일이 같은 3건 중 1걸 이미 소비한 뒤(커서) 나머지 2걸 가져온다.
    const same1 = row('00000000-0000-4000-8000-000000000002', { endDate: shared });
    const after = row('00000000-0000-4000-8000-000000000003', {
      endDate: new Date('2030-02-01T00:00:00Z'),
    });
    const { service, where } = createListService([same1, after]);

    const result = await service.list({
      limit: 20,
      sort: 'deadline',
      cursor: `${shared.toISOString()}|00000000-0000-4000-8000-000000000001`,
    });

    const condition = where.mock.calls[0]![0];
    const values = whereValues(where);
    expect(referencesColumn(condition, challenges.endDate)).toBe(true);
    expect(referencesColumn(condition, challenges.id)).toBe(true);
    expect(
      values.some((value) => value instanceof Date && value.getTime() === shared.getTime()),
    ).toBe(true);
    expect(values).toContain('00000000-0000-4000-8000-000000000001');
    expect(result.items.map((item: ListRow) => item.id)).toEqual([
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000003',
    ]);
  });

  it('continues past rows sharing the same viewCount via the compound cursor', async () => {
    const sameA = row('00000000-0000-4000-8000-000000000005', { viewCount: 10 });
    const lower = row('00000000-0000-4000-8000-000000000006', { viewCount: 9 });
    const { service, where } = createListService([sameA, lower]);

    await service.list({
      limit: 20,
      sort: 'popular',
      cursor: '10|00000000-0000-4000-8000-000000000004',
    });

    const condition = where.mock.calls[0]![0];
    expect(referencesColumn(condition, challenges.viewCount)).toBe(true);
    expect(whereValues(where)).toContain(10);
    expect(whereValues(where)).toContain('00000000-0000-4000-8000-000000000004');
  });

  it('keeps accepting the legacy bare-ISO cursor for the latest sort', async () => {
    const { service, where } = createListService([]);

    await service.list({ limit: 20, sort: 'latest', cursor: '2029-01-01T00:00:00.000Z' });

    const condition = where.mock.calls[0]![0];
    expect(referencesColumn(condition, challenges.createdAt)).toBe(true);
    expect(
      whereValues(where).some(
        (value) =>
          value instanceof Date && value.getTime() === Date.parse('2029-01-01T00:00:00.000Z'),
      ),
    ).toBe(true);
  });

  it('rejects a bare-ISO cursor for non-latest sorts and malformed cursors', async () => {
    const { service } = createListService([]);

    await expect(
      service.list({ limit: 20, sort: 'deadline', cursor: '2030-01-01T00:00:00.000Z' }),
    ).rejects.toThrow('compound');
    await expect(service.list({ limit: 20, sort: 'latest', cursor: 'not-a-date' })).rejects.toThrow(
      'cursor',
    );
    await expect(service.list({ limit: 20, sort: 'popular', cursor: 'abc|id-1' })).rejects.toThrow(
      'number',
    );
  });

  it('encodes the next cursor from the sort column value and id', async () => {
    const items = [
      row('00000000-0000-4000-8000-000000000009', {
        createdAt: new Date('2029-05-01T00:00:00Z'),
        endDate: new Date('2029-07-01T00:00:00Z'),
        viewCount: 42,
      }),
    ];
    const serviceWith = (rows: unknown[]) => createListService(rows).service;

    const latest = await serviceWith([...items, row('extra')]).list({ limit: 1 });
    expect(latest.nextCursor).toBe('2029-05-01T00:00:00.000Z|00000000-0000-4000-8000-000000000009');

    const deadline = await serviceWith([...items, row('extra')]).list({
      limit: 1,
      sort: 'deadline',
    });
    expect(deadline.nextCursor).toBe(
      '2029-07-01T00:00:00.000Z|00000000-0000-4000-8000-000000000009',
    );

    const popular = await serviceWith([...items, row('extra')]).list({
      limit: 1,
      sort: 'popular',
    });
    expect(popular.nextCursor).toBe('42|00000000-0000-4000-8000-000000000009');

    const done = await serviceWith(items).list({ limit: 5 });
    expect(done.nextCursor).toBeNull();
  });
});

describe('ChallengesService.create', () => {
  function createCapturingService(valuesCalls: Record<string, unknown>[]) {
    const db = { select: vi.fn(), insert: vi.fn() } as any;
    db.select.mockImplementation(() => queryChain([{ id: 'biz-1' }]));
    db.insert.mockImplementation(() => ({
      values: vi.fn().mockImplementation((captured) => {
        valuesCalls.push(captured);
        return { returning: vi.fn().mockResolvedValue([{ id: 'challenge-1' }]) };
      }),
    }));
    const adminSettings = { isEnabled: vi.fn().mockResolvedValue(false) };
    return new ChallengesService(db, adminSettings as any, createFilesStub() as any);
  }

  const baseDto = {
    businessId: 'biz-1',
    title: '타이틀',
    description: '설명',
    price: 1000,
    capacity: 10,
    startDate: '2029-01-01T00:00:00Z',
    endDate: '2029-02-01T00:00:00Z',
  };

  it('persists recruitMethod when provided and defaults to external when omitted', async () => {
    const valuesCalls: Record<string, unknown>[] = [];
    const service = createCapturingService(valuesCalls);

    await service.create(
      { ...baseDto, recruitMethod: 'seMOchall', recruitUrl: undefined } as any,
      'user-1',
    );
    await service.create({ ...baseDto, recruitUrl: 'https://example.com/apply' } as any, 'user-1');

    expect(valuesCalls[0]).toMatchObject({ recruitMethod: 'seMOchall' });
    expect(valuesCalls[1]).toMatchObject({ recruitMethod: 'external' });
  });

  it('persists recruitUrl for external recruitMethod and clears any url provided for seMOchall', async () => {
    const valuesCalls: Record<string, unknown>[] = [];
    const service = createCapturingService(valuesCalls);

    await service.create(
      { ...baseDto, recruitMethod: 'external', recruitUrl: 'https://example.com/apply' } as any,
      'user-1',
    );
    await service.create(
      {
        ...baseDto,
        recruitMethod: 'seMOchall',
        recruitUrl: 'https://example.com/ignored',
      } as any,
      'user-1',
    );

    expect(valuesCalls[0]).toMatchObject({
      recruitMethod: 'external',
      recruitUrl: 'https://example.com/apply',
    });
    expect(valuesCalls[1]).toMatchObject({ recruitMethod: 'seMOchall', recruitUrl: null });
  });

  it('rejects creating an external-recruit challenge (default included) without a recruitUrl', async () => {
    const valuesCalls: Record<string, unknown>[] = [];
    const service = createCapturingService(valuesCalls);

    await expect(
      service.create({ ...baseDto, recruitMethod: 'external' } as any, 'user-1'),
    ).rejects.toThrow('recruitUrl is required when recruitMethod is external');
    await expect(service.create(baseDto as any, 'user-1')).rejects.toThrow(
      'recruitUrl is required when recruitMethod is external',
    );
    expect(valuesCalls).toHaveLength(0);
  });

  it('persists the optional poster file id on create', async () => {
    const valuesCalls: Record<string, unknown>[] = [];
    const service = createCapturingService(valuesCalls);

    await service.create(
      { ...baseDto, recruitMethod: 'seMOchall', posterFileId: 'file-1' } as any,
      'user-1',
    );

    expect(valuesCalls[0]).toMatchObject({ posterFileId: 'file-1' });
  });

  it('validates the poster file and rejects create for a missing/pending/private file', async () => {
    const valuesCalls: Record<string, unknown>[] = [];
    const db = { select: vi.fn(), insert: vi.fn() } as any;
    db.select.mockImplementation(() => queryChain([{ id: 'biz-1' }]));
    db.insert.mockImplementation(() => ({
      values: vi.fn().mockImplementation((captured) => {
        valuesCalls.push(captured);
        return { returning: vi.fn().mockResolvedValue([{ id: 'challenge-1' }]) };
      }),
    }));
    const files = createFilesStub({
      assertReadyPublic: vi
        .fn()
        .mockRejectedValue(new BadRequestException('A ready public file is required')),
    });
    const service = new ChallengesService(
      db,
      { isEnabled: vi.fn().mockResolvedValue(false) } as any,
      files as any,
    );

    await expect(
      service.create(
        { ...baseDto, recruitMethod: 'seMOchall', posterFileId: 'file-x' } as any,
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(valuesCalls).toHaveLength(0);
    expect(files.assertReadyPublic).toHaveBeenCalledWith('file-x');
  });
});

describe('ChallengesService.update', () => {
  const owner = { id: 'user-1', role: 'business' };
  const current = {
    startDate: new Date('2030-01-01T00:00:00Z'),
    endDate: new Date('2030-01-31T00:00:00Z'),
  };

  function createUpdateService(rows: unknown[]) {
    const limit = vi.fn().mockResolvedValue(rows);
    const where = vi.fn().mockReturnValue({ limit });
    const innerJoin = vi.fn().mockReturnValue({ where });
    const from = vi.fn().mockReturnValue({ innerJoin });
    const returning = vi.fn().mockResolvedValue([{ id: 'ch-1', title: 'new' }]);
    const set = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning }) });
    const db = {
      select: vi.fn().mockReturnValue({ from }),
      update: vi.fn().mockReturnValue({ set }),
    } as any;
    return {
      service: new ChallengesService(db, {} as any, createFilesStub() as any),
      db,
      set,
      where,
    };
  }

  it('updates only the provided fields for the owning business', async () => {
    const { service, set } = createUpdateService([current]);
    const result = await service.update('ch-1', { title: 'new', category: null }, owner);
    expect(result).toEqual({ id: 'ch-1', title: 'new' });
    expect(set).toHaveBeenCalledWith({ title: 'new', category: null });
  });

  it('returns 404 when the challenge is missing or owned by another business', async () => {
    const { service, db } = createUpdateService([]);
    await expect(service.update('ch-1', { title: 'x' }, owner)).rejects.toThrow(
      'Challenge not found',
    );
    expect(db.update).not.toHaveBeenCalled();
  });

  it('updates or clears the optional poster file id', async () => {
    const withPoster = createUpdateService([current]);
    await withPoster.service.update('ch-1', { posterFileId: 'file-1' }, owner);
    expect(withPoster.set).toHaveBeenCalledWith({ posterFileId: 'file-1' });

    const cleared = createUpdateService([current]);
    await cleared.service.update('ch-1', { posterFileId: null }, owner);
    expect(cleared.set).toHaveBeenCalledWith({ posterFileId: null });
  });

  it('rejects update when posterFileId is not a ready public file', async () => {
    const db = { select: vi.fn(), update: vi.fn() } as any;
    const limit = vi.fn().mockResolvedValue([current]);
    const where = vi.fn().mockReturnValue({ limit });
    const innerJoin = vi.fn().mockReturnValue({ where });
    db.select.mockReturnValue({ from: vi.fn().mockReturnValue({ innerJoin }) });
    db.update.mockReturnValue({ set: vi.fn() });
    const files = createFilesStub({
      assertReadyPublic: vi
        .fn()
        .mockRejectedValue(new BadRequestException('A ready public file is required')),
    });
    const service = new ChallengesService(db, {} as any, files as any);

    await expect(service.update('ch-1', { posterFileId: 'file-x' }, owner)).rejects.toThrow(
      BadRequestException,
    );
    expect(db.update).not.toHaveBeenCalled();
  });

  it('scopes the lookup to the owner unless the user is an admin', async () => {
    const ownerCall = createUpdateService([current]);
    await ownerCall.service.update('ch-1', { title: 'x' }, owner);
    const adminCall = createUpdateService([current]);
    await adminCall.service.update('ch-1', { title: 'x' }, { id: 'admin-1', role: 'admin' });
    expect(collectSqlValues(ownerCall.where.mock.calls[0]?.[0])).toContain('user-1');
    expect(collectSqlValues(adminCall.where.mock.calls[0]?.[0])).not.toContain('admin-1');
  });

  it('rejects an end date before the (existing) start date', async () => {
    const { service, db } = createUpdateService([current]);
    await expect(
      service.update('ch-1', { endDate: '2029-12-31T00:00:00Z' }, owner),
    ).rejects.toThrow('endDate must not be before startDate');
    expect(db.update).not.toHaveBeenCalled();
  });

  it('rejects an empty patch', async () => {
    const { service } = createUpdateService([current]);
    await expect(service.update('ch-1', {}, owner)).rejects.toThrow('No fields to update');
  });

  it('applies recruitUrl when the existing challenge recruits externally', async () => {
    const { service, set } = createUpdateService([{ ...current, recruitMethod: 'external' }]);
    await service.update('ch-1', { recruitUrl: 'https://example.com/apply' }, owner);
    expect(set).toHaveBeenCalledWith({ recruitUrl: 'https://example.com/apply' });
  });

  it('ignores recruitUrl when the existing challenge recruits via seMOchall', async () => {
    const { service, set } = createUpdateService([{ ...current, recruitMethod: 'seMOchall' }]);
    await service.update('ch-1', { title: 'new', recruitUrl: 'https://example.com/apply' }, owner);
    expect(set).toHaveBeenCalledWith({ title: 'new' });
  });

  it('persists applicationForm as-is so a later get returns the same questions', async () => {
    const applicationForm: ApplicationFormQuestion[] = [
      { id: 'q-1', title: '자기소개를 해주세요', type: 'long', options: [], required: true },
      {
        id: 'q-2',
        title: '희망 역할',
        type: 'radio',
        options: ['기획', '디자인', '개발'],
        required: false,
      },
    ];
    const { service, set } = createUpdateService([current]);

    await service.update('ch-1', { applicationForm }, owner);

    expect(set).toHaveBeenCalledWith({ applicationForm });
  });
});

describe('ChallengesService.findById', () => {
  it('returns applicationForm exactly as stored on the row (GET reflects a prior PATCH)', async () => {
    const applicationForm = [
      { id: 'q-1', title: '자기소개', type: 'short', options: [], required: true },
    ];
    const row = { id: 'ch-1', applicationForm };
    const limit = vi.fn().mockResolvedValue([row]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const values = vi.fn().mockResolvedValue(undefined);
    const db = {
      select: vi.fn().mockReturnValue({ from }),
      insert: vi.fn().mockReturnValue({ values }),
    } as any;
    const service = new ChallengesService(db, {} as any, createFilesStub() as any);

    const result = await service.findById('ch-1');

    expect(result.applicationForm).toEqual(applicationForm);
  });

  it('returns null applicationForm for a challenge that never had a form saved', async () => {
    const row = { id: 'ch-1', applicationForm: null };
    const limit = vi.fn().mockResolvedValue([row]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const values = vi.fn().mockResolvedValue(undefined);
    const db = {
      select: vi.fn().mockReturnValue({ from }),
      insert: vi.fn().mockReturnValue({ values }),
    } as any;
    const service = new ChallengesService(db, {} as any, createFilesStub() as any);

    const result = await service.findById('ch-1');

    expect(result.applicationForm).toBeNull();
  });
});

describe('ChallengesService.findById', () => {
  function createDetailService(rows: unknown[], files: ReturnType<typeof createFilesStub>) {
    const db = { select: vi.fn(), insert: vi.fn() } as any;
    db.select.mockImplementation(() => queryChain(rows));
    db.insert.mockImplementation(() => ({ values: vi.fn().mockResolvedValue(undefined) }));
    return new ChallengesService(db, {} as any, files as any);
  }

  it('attaches the resolved posterUrl next to the challenge row', async () => {
    const files = createFilesStub({
      resolvePublicUrl: vi.fn().mockResolvedValue('https://cdn.example.com/uploads/poster.webp'),
    });
    const service = createDetailService([{ id: 'ch-1', posterFileId: 'file-poster' }], files);

    const result = await service.findById('ch-1');

    expect(result).toMatchObject({
      id: 'ch-1',
      posterUrl: 'https://cdn.example.com/uploads/poster.webp',
    });
    expect(files.resolvePublicUrl).toHaveBeenCalledWith('file-poster');
  });

  it('falls back to a null posterUrl when the file is missing or not public-ready', async () => {
    const service = createDetailService([{ id: 'ch-1', posterFileId: null }], createFilesStub());

    const result = await service.findById('ch-1');

    expect(result.posterUrl).toBeNull();
  });
});

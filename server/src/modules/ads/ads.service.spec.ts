import { describe, expect, it, vi } from 'vitest';
import { ads } from '../../db/schema.js';
import { AdsService } from './ads.service.js';

vi.mock('../files/public-file-url.js', () => ({
  buildPublicFileUrl: vi.fn((file: { id: string }) =>
    file.id === 'file-visible' ? 'https://cdn.example.com/ads/visible.png' : null,
  ),
}));

function createDbStub(
  existingAd?: Record<string, unknown>,
  activationOrder?: Record<string, unknown>,
) {
  const limit = vi.fn().mockResolvedValue(existingAd ? [existingAd] : []);
  const forUpdate = vi.fn().mockResolvedValue(activationOrder ? [activationOrder] : []);
  const set = vi.fn();
  const returning = vi.fn();
  const db: any = {
    select: vi
      .fn()
      .mockImplementationOnce(() => ({
        from: vi.fn(() => ({ where: vi.fn(() => ({ limit })) })),
      }))
      .mockImplementation(() => ({
        from: vi.fn(() => ({ where: vi.fn(() => ({ for: forUpdate })) })),
      })),
    update: vi.fn(() => ({
      set: vi.fn((value: unknown) => {
        set(value);
        return { where: vi.fn(() => ({ returning })) };
      }),
    })),
    transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(db)),
  };
  return { db, limit, forUpdate, set, returning };
}

function createBusinessesStub(business?: { id: string }) {
  return { findByOwner: vi.fn().mockResolvedValue(business) };
}

function createReportDbStub(rows: Record<string, unknown>[]) {
  const db: any = {
    select: vi
      .fn()
      .mockImplementationOnce(() => ({
        from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([AD]) })) })),
      }))
      .mockImplementationOnce(() => ({
        from: vi.fn(() => ({ where: vi.fn(() => Promise.resolve(rows)) })),
      })),
  };
  return db;
}

const OWNER = { id: 'user-1', email: 'biz@x.com', name: 'Biz', role: 'business' };
const ADMIN = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: 'admin' };
const AD = { id: 'ad-1', businessId: 'biz-1', status: 'active', title: '히어로 광고' };

// drizzle 조건이 실제 컬럼을 참조하는지 확인한다 (challenges.spec과 동일한 방식).
function referencesColumn(node: any, column: unknown, seen = new Set<unknown>()): boolean {
  if (node === column) return true;
  if (!node || typeof node !== 'object' || seen.has(node)) return false;
  seen.add(node);
  if (Array.isArray(node)) return node.some((chunk) => referencesColumn(chunk, column, seen));
  return Array.isArray(node.queryChunks) && referencesColumn(node.queryChunks, column, seen);
}

// drizzle 조건에 바인딩된 문자열/날짜 값을 모은다 (연산자와 Param 값 확인용).
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

// 조건 트리에서 column을 참조하는 최소 서브트리들을 찾는다 (보통 이항 비교 조건 노드 하나).
function subtreesReferencing(node: any, column: unknown, seen = new Set<unknown>()): any[] {
  if (!node || typeof node !== 'object' || seen.has(node)) return [];
  seen.add(node);
  if (Array.isArray(node)) return node.flatMap((chunk) => subtreesReferencing(chunk, column, seen));
  if (!Array.isArray(node.queryChunks)) return [];
  const inner = node.queryChunks.flatMap((chunk: any) => subtreesReferencing(chunk, column, seen));
  if (inner.length > 0) return inner;
  // 자식 서브트리에 없는데 자신의 청크가 column을 직접 품고 있으면 이 노드가 최소 서브트리다.
  return node.queryChunks.includes(column) ? [node] : [];
}

// column 서브트리 안에서 연산자와 바인딩 값이 짝지어 있는지 확인한다. 열·연산자·값이
// 서로 뒤바뀐 구현(예: gte(startDate, todayStart))도 걸러낼 수 있어야 하므로
// 단순 참조 여부가 아니라 한 서브트리 안의 조합을 본다.
function hasPairedPredicate(
  condition: unknown,
  column: unknown,
  operator: string,
  matchesValue: (value: unknown) => boolean,
): boolean {
  return subtreesReferencing(condition, column).some((subtree) => {
    const parts = collectSqlValues(subtree);
    return (
      parts.some((part) => typeof part === 'string' && part.includes(operator)) &&
      parts.some(matchesValue)
    );
  });
}

describe('AdsService.updateStatus', () => {
  it('rejects a non-owning business with 403', async () => {
    const { db, set, returning } = createDbStub(AD);
    returning.mockResolvedValue([AD]);
    const businesses = createBusinessesStub({ id: 'biz-other' });
    const service = new AdsService(db, businesses as any);

    await expect(service.updateStatus('ad-1', { status: 'paused' }, OWNER)).rejects.toThrow(
      'Only the owning business',
    );

    expect(set).not.toHaveBeenCalled();
  });

  it('rejects a business user with no business with 403', async () => {
    const { db } = createDbStub(AD);
    const service = new AdsService(db, createBusinessesStub(undefined) as any);

    await expect(service.updateStatus('ad-1', { status: 'paused' }, OWNER)).rejects.toThrow(
      'Only the owning business',
    );
  });

  it('rejects activating an unpaid preparing ad with 400', async () => {
    const { db, set, returning } = createDbStub({ ...AD, status: 'preparing' });
    returning.mockResolvedValue([{ ...AD, status: 'active' }]);
    const businesses = createBusinessesStub({ id: 'biz-1' });
    const service = new AdsService(db, businesses as any);

    await expect(service.updateStatus('ad-1', { status: 'active' }, OWNER)).rejects.toThrow(
      'Unpaid ads cannot be activated directly',
    );

    expect(set).not.toHaveBeenCalled();
  });

  it('rejects reactivating an ad whose order was canceled', async () => {
    const { db, forUpdate, set } = createDbStub(
      { ...AD, status: 'ended' },
      { id: 'order-1', adId: 'ad-1', status: 'canceled' },
    );
    const service = new AdsService(db, createBusinessesStub({ id: 'biz-1' }) as any);

    await expect(service.updateStatus('ad-1', { status: 'active' }, OWNER)).rejects.toThrow(
      'Only ads with a paid order can be activated',
    );

    expect(forUpdate).toHaveBeenCalledWith('update');
    expect(set).not.toHaveBeenCalled();
  });

  it('reactivates an ad only while its order remains paid', async () => {
    const { db, forUpdate, returning } = createDbStub(
      { ...AD, status: 'paused' },
      { id: 'order-1', adId: 'ad-1', status: 'paid' },
    );
    returning.mockResolvedValue([{ ...AD, status: 'active' }]);
    const service = new AdsService(db, createBusinessesStub({ id: 'biz-1' }) as any);

    await expect(service.updateStatus('ad-1', { status: 'active' }, OWNER)).resolves.toEqual({
      ...AD,
      status: 'active',
    });

    expect(forUpdate).toHaveBeenCalledWith('update');
  });

  it('rejects pausing an ad that is not active with 400', async () => {
    const { db, set, returning } = createDbStub({ ...AD, status: 'ended' });
    returning.mockResolvedValue([{ ...AD, status: 'paused' }]);
    const businesses = createBusinessesStub({ id: 'biz-1' });
    const service = new AdsService(db, businesses as any);

    await expect(service.updateStatus('ad-1', { status: 'paused' }, OWNER)).rejects.toThrow(
      'Only active ads can be paused',
    );

    expect(set).not.toHaveBeenCalled();
  });

  it('lets the owning business pause an active ad', async () => {
    const { db, set, returning } = createDbStub(AD);
    returning.mockResolvedValue([{ ...AD, status: 'paused' }]);
    const businesses = createBusinessesStub({ id: 'biz-1' });
    const service = new AdsService(db, businesses as any);

    const updated = await service.updateStatus('ad-1', { status: 'paused' }, OWNER);

    expect(set).toHaveBeenCalledWith({ status: 'paused' });
    expect(updated).toEqual({ ...AD, status: 'paused' });
  });

  it('no longer lets an admin bypass ownership on PATCH (admin pause has its own endpoint)', async () => {
    const { db } = createDbStub(AD);
    const service = new AdsService(db, createBusinessesStub(undefined) as any);

    await expect(service.updateStatus('ad-1', { status: 'ended' }, ADMIN)).rejects.toThrow(
      'Only the owning business',
    );
  });

  it('throws 404 for unknown ads', async () => {
    const { db } = createDbStub(undefined);
    const service = new AdsService(db, createBusinessesStub({ id: 'biz-1' }) as any);

    await expect(service.updateStatus('missing', { status: 'paused' }, OWNER)).rejects.toThrow(
      'Ad not found',
    );
  });
});

describe('AdsService.listMine', () => {
  const DAY_MS = 86_400_000;

  function createListMineDbStub(rows: unknown[]) {
    const where = vi.fn((..._args: unknown[]) => ({ orderBy: vi.fn().mockResolvedValue(rows) }));
    const db: any = { select: vi.fn(() => ({ from: vi.fn(() => ({ where })) })) };
    return { db, where };
  }

  // 스텁은 drizzle 조건을 평가할 수 없으니, 서빙 기간 필터의 DB 적용 결과를
  // listPublic과 동일한 startDate/endDate 규칙으로 재현한다.
  function simulateServingWindow<T extends { startDate: Date; endDate: Date }>(
    rows: T[],
    now: Date,
  ) {
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    return rows.filter((row) => row.startDate <= now && row.endDate >= todayStart);
  }

  it('excludes expired-but-active ads when withinServingWindow is set', async () => {
    const before = new Date();
    const liveAd = {
      ...AD,
      id: 'ad-live',
      startDate: new Date(before.getTime() - 2 * DAY_MS),
      endDate: new Date(before.getTime() + 5 * DAY_MS),
    };
    const expiredAd = {
      ...AD,
      id: 'ad-expired',
      startDate: new Date(before.getTime() - 30 * DAY_MS),
      endDate: new Date(before.getTime() - 3 * DAY_MS),
    };
    const { db, where } = createListMineDbStub(simulateServingWindow([liveAd, expiredAd], before));
    const service = new AdsService(db, createBusinessesStub() as any);

    const result = await service.listMine('biz-1', 'active', { withinServingWindow: true });

    expect(result.map((ad) => ad.id)).toEqual(['ad-live']);
    const condition = where.mock.calls[0]![0];
    const after = new Date();
    const expectedTodayStart = new Date(
      Date.UTC(before.getUTCFullYear(), before.getUTCMonth(), before.getUTCDate()),
    );
    // startDate <= now, endDate >= 오늘 0시(UTC) — 열·연산자·값이 뒤바뀐 구현은 통과하지 못한다.
    expect(
      hasPairedPredicate(
        condition,
        ads.startDate,
        '<=',
        (v) =>
          v instanceof Date && v.getTime() >= before.getTime() && v.getTime() <= after.getTime(),
      ),
    ).toBe(true);
    expect(
      hasPairedPredicate(
        condition,
        ads.endDate,
        '>=',
        (v) => v instanceof Date && v.getTime() === expectedTodayStart.getTime(),
      ),
    ).toBe(true);
  });

  it('excludes a not-yet-started active ad when withinServingWindow is set', async () => {
    const now = new Date();
    const futureAd = {
      ...AD,
      id: 'ad-future',
      startDate: new Date(now.getTime() + DAY_MS),
      endDate: new Date(now.getTime() + 5 * DAY_MS),
    };
    const { db } = createListMineDbStub(simulateServingWindow([futureAd], now));
    const service = new AdsService(db, createBusinessesStub() as any);

    const result = await service.listMine('biz-1', 'active', { withinServingWindow: true });

    expect(result.map((ad) => ad.id)).toEqual([]);
  });

  it('keeps an active ad whose contract ends today when withinServingWindow is set', async () => {
    const now = new Date();
    const endsTodayAd = {
      ...AD,
      id: 'ad-ends-today',
      startDate: new Date(now.getTime() - 2 * DAY_MS),
      endDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
    };
    const { db, where } = createListMineDbStub(simulateServingWindow([endsTodayAd], now));
    const service = new AdsService(db, createBusinessesStub() as any);

    const result = await service.listMine('biz-1', 'active', { withinServingWindow: true });

    expect(result.map((ad) => ad.id)).toEqual(['ad-ends-today']);
    expect(referencesColumn(where.mock.calls[0]![0], ads.endDate)).toBe(true);
  });

  it('adds no date conditions when the option is not set', async () => {
    const now = new Date();
    const expiredAd = {
      ...AD,
      id: 'ad-expired',
      startDate: new Date(now.getTime() - 30 * DAY_MS),
      endDate: new Date(now.getTime() - 3 * DAY_MS),
    };
    const { db, where } = createListMineDbStub([expiredAd]);
    const service = new AdsService(db, createBusinessesStub() as any);

    // GET /ads 경로(status 유무 모두)는 기존처럼 만료 여부와 무관하게 전부 남긴다.
    const withStatus = await service.listMine('biz-1', 'active');
    const withoutStatus = await service.listMine('biz-1');

    expect(withStatus.map((ad) => ad.id)).toEqual(['ad-expired']);
    expect(withoutStatus.map((ad) => ad.id)).toEqual(['ad-expired']);
    expect(where).toHaveBeenCalledTimes(2);
    for (const call of where.mock.calls) {
      expect(referencesColumn(call[0], ads.startDate)).toBe(false);
      expect(referencesColumn(call[0], ads.endDate)).toBe(false);
    }
  });
});

describe('AdsService.listPublic', () => {
  it('returns only image-ready minimal public fields for the requested placement', async () => {
    const where = vi.fn(() => ({
      orderBy: vi.fn().mockResolvedValue([
        {
          id: 'ad-visible',
          title: '진행 중 히어로 광고',
          imageFileId: 'file-visible',
          landingUrl: 'https://example.com/landing',
          placement: 'hero',
          startDate: new Date('2026-09-21T00:00:00.000Z'),
          createdAt: new Date('2026-09-01T00:00:00.000Z'),
        },
        {
          id: 'ad-no-image',
          title: '이미지 없는 광고',
          imageFileId: null,
          landingUrl: null,
          placement: 'hero',
          startDate: new Date('2026-09-21T00:00:00.000Z'),
          createdAt: new Date('2026-09-02T00:00:00.000Z'),
        },
      ]),
    }));
    const db: any = {
      select: vi
        .fn()
        .mockImplementationOnce(() => ({
          from: vi.fn(() => ({ innerJoin: vi.fn(() => ({ where })) })),
        }))
        .mockImplementationOnce(() => ({
          from: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([{ id: 'file-visible' }]),
          })),
        })),
    };
    const service = new AdsService(db, createBusinessesStub() as any);

    await expect(service.listPublic('hero')).resolves.toEqual([
      {
        id: 'ad-visible',
        title: '진행 중 히어로 광고',
        imageUrl: expect.any(String),
        landingUrl: 'https://example.com/landing',
        placement: 'hero',
      },
    ]);
    expect(where).toHaveBeenCalledOnce();
  });
});

describe('AdsService.report', () => {
  const businesses = () => createBusinessesStub({ id: 'biz-1' });

  it('rejects a non-owning business with 403', async () => {
    const { db } = createDbStub(AD);
    const service = new AdsService(db, createBusinessesStub({ id: 'biz-other' }) as any);

    await expect(service.report('ad-1', {}, OWNER)).rejects.toThrow('Only the owning business');
  });

  it('returns honest zeros: 7-day default range, 24 hourly slots, empty monthlyClicks', async () => {
    const { db } = createDbStub(AD);
    const service = new AdsService(db, businesses() as any);

    const report = await service.report('ad-1', {}, OWNER);

    expect(report.totals).toEqual({ impressions: 0, clicks: 0, ctr: 0 });
    expect(report.daily).toHaveLength(7);
    const seoulDate = (value: Date) =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(value);
    const today = seoulDate(new Date());
    const sixDaysAgo = seoulDate(new Date(Date.now() - 6 * 86_400_000));
    expect(report.daily![0]!.date).toBe(sixDaysAgo);
    expect(report.daily![6]!.date).toBe(today);
    for (const row of report.daily!) {
      expect(row).toMatchObject({ impressions: 0, clicks: 0, ctr: 0 });
    }
    expect(report.hourly).toHaveLength(24);
    expect(report.hourly![0]).toEqual({
      hour: 0,
      label: '0시~1시',
      impressions: 0,
      clicks: 0,
      ctr: 0,
    });
    expect(report.hourly![23]).toEqual({
      hour: 23,
      label: '23시~24시',
      impressions: 0,
      clicks: 0,
      ctr: 0,
    });
    expect(report.monthlyClicks).toEqual([]);
  });

  it('honours an explicit from/to range', async () => {
    const { db } = createDbStub(AD);
    const service = new AdsService(db, businesses() as any);

    const report = await service.report('ad-1', { from: '2026-09-01', to: '2026-09-03' }, OWNER);

    expect(report.daily.map((row) => row.date)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
  });

  it('caps the range at 31 days', async () => {
    const { db } = createDbStub(AD);
    const service = new AdsService(db, businesses() as any);

    const report = await service.report('ad-1', { from: '2026-01-01', to: '2026-09-14' }, OWNER);

    expect(report.daily).toHaveLength(31);
    expect(report.daily[0]!.date).toBe('2026-08-15');
    expect(report.daily[30]!.date).toBe('2026-09-14');
  });

  it('aggregates counters by Seoul day/hour and calculates CTR and monthly clicks', async () => {
    const db = createReportDbStub([
      { bucketStart: new Date('2026-09-01T00:00:00Z'), impressions: 3, clicks: 1 },
      { bucketStart: new Date('2026-09-01T15:00:00Z'), impressions: 2, clicks: 2 },
    ]);
    const service = new AdsService(db, businesses() as any);

    const report = await service.report('ad-1', { from: '2026-09-01', to: '2026-09-02' }, OWNER);

    expect(report.totals).toEqual({ impressions: 5, clicks: 3, ctr: 60 });
    expect(report.daily[0]).toEqual({ date: '2026-09-01', impressions: 3, clicks: 1, ctr: 33.33 });
    expect(report.daily[1]).toEqual({ date: '2026-09-02', impressions: 2, clicks: 2, ctr: 100 });
    expect(report.hourly[9]).toMatchObject({ impressions: 3, clicks: 1, ctr: 33.33 });
    expect(report.hourly[0]).toMatchObject({ impressions: 2, clicks: 2, ctr: 100 });
    expect(report.monthlyClicks).toEqual([{ label: '9월', value: 3 }]);
  });
});

describe('AdsService.recordEvent', () => {
  it('records active ads once per event id and ignores inactive ads', async () => {
    const insert = vi.fn(() => ({
      values: vi.fn(() => ({ onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) })),
    }));
    const select = vi.fn((..._args: unknown[]) => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ id: 'ad-1', status: 'active' }]),
        })),
      })),
    }));
    const db: any = { select, insert };
    const service = new AdsService(db, createBusinessesStub() as any);

    await expect(
      service.recordEvent('ad-1', 'impressions', { eventId: crypto.randomUUID() }),
    ).resolves.toEqual({ recorded: true });
    const eventId = crypto.randomUUID();
    await service.recordEvent('ad-1', 'clicks', { eventId });
    await service.recordEvent('ad-1', 'clicks', { eventId });
    expect(insert).toHaveBeenCalledTimes(2);

    select.mockImplementationOnce(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ id: 'ad-2', status: 'paused' }]),
        })),
      })),
    }));
    await expect(service.recordEvent('ad-2', 'impressions', {})).resolves.toEqual({
      recorded: false,
    });
    expect(insert).toHaveBeenCalledTimes(2);
  });
});

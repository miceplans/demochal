import { BadRequestException, NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ads, businesses, orders, payments } from '../../db/schema.js';
import {
  AdminService,
  maskBizNumber,
  maskEmail,
  maskReporterName,
  niceMax,
  timeBuckets,
} from './admin.service.js';
import { DEFAULT_VALUES, ADMIN_SETTINGS_ID } from './admin-settings.service.js';

/**
 * Auto-chaining thenable stand-in for a drizzle query builder: every method
 * call returns the proxy itself and awaiting it resolves the scripted value.
 * `spies` captures method args (e.g. `set`/`values`) for assertions.
 */
function chainable(resolved: unknown, spies: Record<string, (args: unknown[]) => void> = {}) {
  const proxy: any = new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === 'then') {
        return (onFulfilled: (value: unknown) => unknown) => onFulfilled(resolved);
      }
      return (...args: unknown[]) => {
        spies[prop as string]?.(args);
        return proxy;
      };
    },
  });
  return proxy;
}

/** Scripted drizzle stub: each db.select()/update()/insert() pops the next queued result. */
function createDbStub(
  options: { select?: unknown[]; update?: unknown[]; insert?: unknown[] } = {},
) {
  const selectQueue = [...(options.select ?? [])];
  const updateQueue = [...(options.update ?? [])];
  const insertQueue = [...(options.insert ?? [])];
  const setCalls: unknown[][] = [];
  const valuesCalls: unknown[][] = [];
  const selectWhereCalls: unknown[][] = [];
  const db: any = {
    select: vi.fn(() =>
      chainable(selectQueue.length ? selectQueue.shift() : [], {
        where: (args) => selectWhereCalls.push(args),
      }),
    ),
    update: vi.fn(() =>
      chainable(updateQueue.length ? updateQueue.shift() : [], {
        set: (args) => setCalls.push(args),
      }),
    ),
    insert: vi.fn(() =>
      chainable(insertQueue.length ? insertQueue.shift() : [], {
        values: (args) => valuesCalls.push(args),
      }),
    ),
  };
  return { db, setCalls, valuesCalls, selectWhereCalls };
}

/** drizzle SQL 트리에서 문자열 값(Param 포함)을 모은다. */
function collectStrings(node: any, acc: string[] = []): string[] {
  if (typeof node === 'string') {
    acc.push(node);
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach((c) => collectStrings(c, acc));
    return acc;
  }
  if (node?.constructor?.name === 'Param' && typeof node.value === 'string') {
    acc.push(node.value);
    return acc;
  }
  if (Array.isArray(node?.queryChunks)) {
    node.queryChunks.forEach((c: any) => collectStrings(c, acc));
  }
  return acc;
}

function createNotificationsStub() {
  return { create: vi.fn().mockResolvedValue({}) };
}

/** Does a drizzle SQL tree reference this exact column object (by identity)? */
function referencesColumn(node: any, target: unknown, seen = new Set<unknown>()): boolean {
  if (node === target) return true;
  if (!node || typeof node !== 'object' || seen.has(node)) return false;
  seen.add(node);
  if (Array.isArray(node)) return node.some((c) => referencesColumn(c, target, seen));
  if (Array.isArray(node.queryChunks)) return referencesColumn(node.queryChunks, target, seen);
  return false;
}

const zeroAdReport = {
  totals: { impressions: 0, clicks: 0, ctr: 0 },
  daily: [],
  hourly: [],
  monthlyClicks: [],
};

function createAdsStub(report: unknown = zeroAdReport) {
  return { getReportForAdmin: vi.fn().mockResolvedValue(report) };
}

function createService(
  db: any,
  notifications = createNotificationsStub(),
  adsService = createAdsStub(),
) {
  return {
    service: new AdminService(db, notifications as any, adsService as any),
    notifications,
    adsService,
  };
}

const verificationRow = { id: 'v1', businessId: 'b1', status: 'pending' };
const businessRow = { id: 'b1', ownerUserId: 'owner-1' };
const reportRow = {
  id: 'r1',
  content: '2025 AI챌린지',
  targetType: 'challenge',
  org: '테스트기관',
  summary: '피싱 의심',
  detail: '상세 내용',
  reporterUserId: 'u1',
  reporterName: '김*아',
  status: 'open',
  createdAt: new Date('2026-09-14T00:00:00Z'),
};

describe('AdminService — verifications', () => {
  it('approve sets verification + business approved and notifies the owner', async () => {
    const updatedVerification = { ...verificationRow, status: 'approved' };
    const { db, setCalls } = createDbStub({
      select: [[verificationRow], [businessRow]],
      update: [[updatedVerification], []],
    });
    const { service, notifications } = createService(db);

    const result = await service.approveVerification('v1');

    expect(result).toEqual(updatedVerification);
    expect(setCalls[0]).toEqual([
      expect.objectContaining({ status: 'approved', updatedAt: expect.any(Date) }),
    ]);
    expect(setCalls[1]).toEqual([{ verificationStatus: 'approved' }]);
    expect(notifications.create).toHaveBeenCalledWith('owner-1', 'verification.result', {
      verificationId: 'v1',
      status: 'approved',
    });
  });

  it('reject records the reason, rejects the business and notifies the owner', async () => {
    const updatedVerification = {
      ...verificationRow,
      status: 'rejected',
      rejectionReason: '서류 불일치',
    };
    const { db, setCalls } = createDbStub({
      select: [[verificationRow], [businessRow]],
      update: [[updatedVerification], []],
    });
    const { service, notifications } = createService(db);

    const result = await service.rejectVerification('v1', '서류 불일치');

    expect(result).toEqual(updatedVerification);
    expect(setCalls[0]).toEqual([
      expect.objectContaining({
        status: 'rejected',
        rejectionReason: '서류 불일치',
        updatedAt: expect.any(Date),
      }),
    ]);
    expect(setCalls[1]).toEqual([{ verificationStatus: 'rejected' }]);
    expect(notifications.create).toHaveBeenCalledWith('owner-1', 'verification.result', {
      verificationId: 'v1',
      status: 'rejected',
    });
  });

  it('throws NotFound for an unknown verification', async () => {
    const { db } = createDbStub({ select: [[]] });
    const { service } = createService(db);

    await expect(service.approveVerification('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AdminService — certificates', () => {
  const certificateRow = {
    id: 'c1',
    userId: 'u1',
    title: '2025 공공데이터 활용 대회 대상',
    category: 'award',
    fileId: 'f1',
    status: 'pending',
  };

  it('approve verifies the certificate and appends a new badge', async () => {
    const updated = { ...certificateRow, status: 'verified' };
    const owner = { id: 'u1', name: '김수아', badges: ['기존 뱃지'] };
    const { db, setCalls } = createDbStub({
      select: [[certificateRow], [owner]],
      update: [[updated], []],
    });
    const { service } = createService(db);

    const result = await service.verifyCertificate('c1', { action: 'approve' });

    expect(result).toEqual({
      id: 'c1',
      user: '김수아',
      award: certificateRow.title,
      category: 'award',
      fileId: 'f1',
      status: 'verified',
    });
    expect(setCalls[1]).toEqual([{ badges: ['기존 뱃지', certificateRow.title] }]);
  });

  it('approve does not duplicate an existing badge', async () => {
    const updated = { ...certificateRow, status: 'verified' };
    const owner = { id: 'u1', name: '김수아', badges: [certificateRow.title] };
    const { db, setCalls } = createDbStub({
      select: [[certificateRow], [owner]],
      update: [[updated], []],
    });
    const { service } = createService(db);

    await service.verifyCertificate('c1', { action: 'approve' });

    expect(db.update).toHaveBeenCalledTimes(1);
    expect(setCalls).toHaveLength(1);
  });

  it('reject stores the rejection reason', async () => {
    const updated = { ...certificateRow, status: 'rejected', rejectionReason: '이미지 훼손' };
    const owner = { id: 'u1', name: '김수아', badges: [] };
    const { db, setCalls } = createDbStub({
      select: [[certificateRow], [owner]],
      update: [[updated], []],
    });
    const { service } = createService(db);

    const result = await service.verifyCertificate('c1', {
      action: 'reject',
      reason: '이미지 훼손',
    });

    expect(result.status).toBe('rejected');
    expect(setCalls[0]).toEqual([
      expect.objectContaining({ status: 'rejected', rejectionReason: '이미지 훼손' }),
    ]);
    expect(db.update).toHaveBeenCalledTimes(1);
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
    };
    const { db, setCalls } = createDbStub({
      select: [[userRow], [{ count: 3 }]],
      update: [[]],
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
    });
  });

  it('lift clears the suspension fields', async () => {
    const userRow = {
      id: 'u1',
      name: '김수아',
      email: 'kim.dev@gmail.com',
      position: '프론트엔드',
      suspended: false,
    };
    const { db, setCalls } = createDbStub({
      select: [[userRow], [{ count: 0 }]],
      update: [[]],
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
    });
  });
});

describe('AdminService — ad pricing', () => {
  const products = [
    { id: 'p1', placement: 'hero', dailyPrice: 1000 },
    { id: 'p2', placement: 'gallery', dailyPrice: 2000 },
    { id: 'p3', placement: 'team', dailyPrice: 3000 },
  ];

  it('PUT updates by slot and returns the fresh pricing list', async () => {
    const updatedProducts = [
      { id: 'p1', placement: 'hero', dailyPrice: 5000 },
      { id: 'p2', placement: 'gallery', dailyPrice: 2000 },
      { id: 'p3', placement: 'team', dailyPrice: 7000 },
    ];
    const { db, setCalls } = createDbStub({
      // initial product lookup, then getAdPricing re-reads the updated rows
      select: [products, updatedProducts, [], [], []],
      update: [[], []],
    });
    const { service } = createService(db);

    const result = await service.updateAdPricing([
      { slot: 'hero', dailyPrice: 5000 },
      { slot: 'team', dailyPrice: 7000 },
    ]);

    expect(setCalls[0]).toEqual([{ dailyPrice: 5000 }]);
    expect(setCalls[1]).toEqual([{ dailyPrice: 7000 }]);
    expect(result.map((row) => [row.slot, row.dailyPrice])).toEqual([
      ['hero', 5000],
      ['gallery', 2000],
      ['team', 7000],
    ]);
    expect(result.map((row) => row.currentAdId)).toEqual([null, null, null]);
  });

  it('PUT rejects an unknown slot with 400', async () => {
    const { db, setCalls } = createDbStub({ select: [products] });
    const { service } = createService(db);

    await expect(
      service.updateAdPricing([{ slot: 'moon' as never, dailyPrice: 1 }]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(setCalls).toHaveLength(0);
  });
});

describe('AdminService — ads list', () => {
  const adRow = { id: 'ad-1', title: '2026 AI 챌린지 광고', status: 'active', paidAmount: 300000 };

  it('joins the organization name and product name onto each ad row', async () => {
    const { db } = createDbStub({
      select: [[{ ad: adRow, organization: '부산광역시', productName: '홈 배너' }]],
    });
    const { service } = createService(db);

    const result = await service.listAds();

    expect(result).toEqual([{ ...adRow, organization: '부산광역시', productName: '홈 배너' }]);
  });

  it('matches q against both the ad title and the business name', async () => {
    const { db, selectWhereCalls } = createDbStub({ select: [[]] });
    const { service } = createService(db);

    await service.listAds('부산');

    const where = selectWhereCalls[0];
    expect(collectStrings(where)).toContain('%부산%');
    expect(referencesColumn(where, ads.title)).toBe(true);
    expect(referencesColumn(where, businesses.name)).toBe(true);
  });

  it('filters by the exact status value', async () => {
    const { db, selectWhereCalls } = createDbStub({ select: [[]] });
    const { service } = createService(db);

    await service.listAds(undefined, 'paused');

    const where = selectWhereCalls[0];
    expect(collectStrings(where)).toContain('paused');
    expect(referencesColumn(where, ads.status)).toBe(true);
    expect(referencesColumn(where, ads.title)).toBe(false);
  });

  it('combines q and status into a single where clause', async () => {
    const { db, selectWhereCalls } = createDbStub({ select: [[]] });
    const { service } = createService(db);

    await service.listAds('부산', 'active');

    const where = selectWhereCalls[0];
    const strings = collectStrings(where);
    expect(strings).toContain('%부산%');
    expect(strings).toContain('active');
    expect(referencesColumn(where, ads.title)).toBe(true);
    expect(referencesColumn(where, businesses.name)).toBe(true);
    expect(referencesColumn(where, ads.status)).toBe(true);
  });

  it('skips the where clause entirely when no filter is given', async () => {
    const { db, selectWhereCalls } = createDbStub({ select: [[]] });
    const { service } = createService(db);

    await service.listAds();

    expect(selectWhereCalls).toHaveLength(1);
    expect(selectWhereCalls[0]?.[0]).toBeUndefined();
  });
});

describe('AdminService — time buckets', () => {
  const now = new Date('2026-09-23T10:00:00Z');

  it('builds consecutive day buckets ending today', () => {
    const buckets = timeBuckets('day', 3, now);
    expect(buckets.keys).toEqual(['2026-09-21', '2026-09-22', '2026-09-23']);
    expect(buckets.labels).toEqual(['9/21', '9/22', '9/23']);
    expect(buckets.since.toISOString()).toBe('2026-09-21T00:00:00.000Z');
  });

  it('builds month buckets across a year boundary', () => {
    const buckets = timeBuckets('month', 12, now);
    expect(buckets.keys[0]).toBe('2025-10-01');
    expect(buckets.keys[11]).toBe('2026-09-01');
    expect(buckets.labels[0]).toBe('10월');
    expect(buckets.labels[11]).toBe('9월');
  });

  it('rounds chart maxima up to 1/2/5 steps with a floor of 10', () => {
    expect(niceMax(0)).toBe(10);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(11)).toBe(20);
    expect(niceMax(37)).toBe(50);
    expect(niceMax(120)).toBe(200);
  });
});

describe('AdminService — dashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T10:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fills traffic buckets from signups per role and computes the ad revenue share', async () => {
    const { db, selectWhereCalls } = createDbStub({
      select: [
        [{ count: 5 }],
        [{ count: 3 }],
        [{ count: 10 }],
        [{ count: 2 }],
        [],
        [
          { bucket: '2026-09-17', role: 'user', count: 4 },
          { bucket: '2026-09-23', role: 'user', count: 1 },
          { bucket: '2026-09-23', role: 'business', count: 2 },
        ],
        [{ total: 40_000, ad: 10_000 }],
      ],
    });
    const { service } = createService(db);

    const result = await service.getDashboard('7days');

    expect(result.stats.map((card) => card.value)).toEqual(['5', '3', '10', '2']);
    expect(result.traffic.labels).toEqual(['9/17', '9/18', '9/19', '9/20', '9/21', '9/22', '9/23']);
    expect(result.traffic.primary).toEqual([4, 0, 0, 0, 0, 0, 1]);
    expect(result.traffic.secondary).toEqual([0, 0, 0, 0, 0, 0, 2]);
    expect(result.adRatio).toEqual({ value: '10,000 ₩', ratio: 0.25 });
    expect(result.generatedAt).toBe('2026-09-23T10:00:00.000Z');

    // Revenue is scoped to paid payments within the same window, and the ad
    // share keys off orders.adId.
    const revenueSelect = db.select.mock.calls[6]![0];
    expect(referencesColumn(revenueSelect.ad, orders.adId)).toBe(true);
    expect(referencesColumn(revenueSelect.total, payments.refundedAmount)).toBe(true);
    const revenueWhere = selectWhereCalls[selectWhereCalls.length - 1];
    expect(collectStrings(revenueWhere)).toContain('paid');
  });

  it('returns a zero ratio instead of dividing by zero when there is no revenue', async () => {
    const { db } = createDbStub({
      select: [[{ count: 0 }], [{ count: 0 }], [{ count: 0 }], [{ count: 0 }], [], [], []],
    });
    const { service } = createService(db);

    const result = await service.getDashboard('30days');

    expect(result.adRatio).toEqual({ value: '0 ₩', ratio: 0 });
    expect(result.traffic.labels).toHaveLength(30);
    expect(result.traffic.primary.every((value) => value === 0)).toBe(true);
  });

  it('defaults to 12 month buckets ending this month', async () => {
    const { db } = createDbStub({
      select: [[{ count: 0 }], [{ count: 0 }], [{ count: 0 }], [{ count: 0 }], [], [], []],
    });
    const { service } = createService(db);

    const result = await service.getDashboard();

    expect(result.traffic.labels).toHaveLength(12);
    expect(result.traffic.labels[0]).toBe('10월');
    expect(result.traffic.labels[11]).toBe('9월');
  });
});

describe('AdminService — reports', () => {
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
});

describe('AdminService — user-facing masking', () => {
  it('masks emails to first char + *** + domain', () => {
    expect(maskEmail('kim.dev@gmail.com')).toBe('k***@gmail.com');
    expect(maskEmail('a@semochal.kr')).toBe('a***@semochal.kr');
  });

  it('masks reporter names', () => {
    expect(maskReporterName('김수아')).toBe('김*아');
    expect(maskReporterName('김아')).toBe('김*');
  });

  it('masks business numbers to the first 6 chars', () => {
    expect(maskBizNumber('123-45-67890')).toBe('123-45-*****');
  });

  it('createReport stores the masked reporter name and returns the contract row', async () => {
    const created = {
      ...reportRow,
      reporterName: '김*아',
      createdAt: new Date('2026-09-14T00:00:00Z'),
    };
    const { db, valuesCalls } = createDbStub({ insert: [[created]] });
    const { service } = createService(db);

    const result = await service.createReport(
      {
        content: '2025 AI챌린지',
        targetType: 'challenge',
        org: '테스트기관',
        summary: '피싱 의심',
        detail: '상세 내용',
      },
      { id: 'u1', email: 'kim.dev@gmail.com', name: '김수아', role: 'user' },
    );

    expect(valuesCalls[0]).toEqual([
      expect.objectContaining({ reporterUserId: 'u1', reporterName: '김*아' }),
    ]);
    expect(result.reporter).toBe('김*아');
  });
});

describe('AdminService — analytics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T10:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const uuid = '11111111-1111-1111-1111-111111111111';
  const adRow = {
    ad: {
      id: uuid,
      adNumber: 7,
      startDate: new Date('2026-08-24T00:00:00Z'),
      endDate: new Date('2026-09-24T00:00:00Z'),
      paidAmount: 250,
    },
    organization: '부산광역시',
  };
  // users(30d), challenges(30d), payments, applications/month, challenges/month
  const baseSelects = () => [
    [{ count: 7 }],
    [{ count: 4 }],
    [{ total: 300 }],
    [
      { bucket: '2026-04-01', count: 3 },
      { bucket: '2026-09-01', count: 12 },
    ],
    [{ bucket: '2026-08-01', count: 2 }],
  ];

  it('counts new users/challenges over the last 30 days and fills monthly activity', async () => {
    const { db, selectWhereCalls } = createDbStub({ select: baseSelects() });
    const { service } = createService(db);

    const result = await service.getAnalytics();

    expect(result.stats.map((card) => [card.value, card.meta])).toEqual([
      ['7', '최근 30일'],
      ['4', '최근 30일'],
      ['300', '결제 완료 기준'],
    ]);
    // Both "신규" cards are windowed, not all-time totals.
    expect(selectWhereCalls[0]?.[0]).toBeDefined();
    expect(selectWhereCalls[1]?.[0]).toBeDefined();
    expect(result.activity.months).toEqual(['4월', '5월', '6월', '7월', '8월', '9월']);
    expect(result.activity.general).toEqual([3, 0, 0, 0, 0, 12]);
    expect(result.activity.corp).toEqual([0, 0, 0, 0, 2, 0]);
    expect(result.activity.yMax).toBe(20);
    expect(result.adReport).toBeUndefined();
  });

  it('nets platform revenue against refundedAmount on paid payments only', async () => {
    const { db, selectWhereCalls } = createDbStub({ select: baseSelects() });
    const { service } = createService(db);

    await service.getAnalytics();

    const revenueSelectArg = db.select.mock.calls[2]![0];
    expect(referencesColumn(revenueSelectArg.total, payments.amount)).toBe(true);
    expect(referencesColumn(revenueSelectArg.total, payments.refundedAmount)).toBe(true);
    expect(collectStrings(selectWhereCalls[2])).toContain('paid');
  });

  it('resolves ?ad=N by the stable ads.ad_number column, not list position', async () => {
    const { db, selectWhereCalls } = createDbStub({ select: [...baseSelects(), [adRow]] });
    const { service, adsService } = createService(db);

    const result = await service.getAnalytics('7');

    const adWhere = selectWhereCalls[selectWhereCalls.length - 1]?.[0];
    expect(referencesColumn(adWhere, ads.adNumber)).toBe(true);
    expect(referencesColumn(adWhere, ads.id)).toBe(false);
    expect(adsService.getReportForAdmin).toHaveBeenCalledWith(uuid);
    expect(result.adReport).toMatchObject({
      adId: uuid,
      adNumber: 7,
      organization: '부산광역시',
      period: '8/24~9/24',
      daily: [],
    });
    expect(result.adReport?.stats.map((card) => card.value)).toEqual(['0', '0', '0%', '250']);
  });

  it('resolves a uuid ?ad= via ads.id and passes through AdsService metrics', async () => {
    const report = {
      totals: { impressions: 1200, clicks: 36, ctr: 3 },
      daily: [{ date: '2026-09-22', impressions: 1200, clicks: 36, ctr: 3 }],
      hourly: [],
      monthlyClicks: [],
    };
    const { db, selectWhereCalls } = createDbStub({ select: [...baseSelects(), [adRow]] });
    const { service } = createService(db, createNotificationsStub(), createAdsStub(report));

    const result = await service.getAnalytics(uuid);

    const adWhere = selectWhereCalls[selectWhereCalls.length - 1]?.[0];
    expect(referencesColumn(adWhere, ads.id)).toBe(true);
    expect(result.adReport?.stats.map((card) => card.value)).toEqual(['1200', '36', '3%', '250']);
    expect(result.adReport?.daily).toEqual(report.daily);
  });

  it('throws NotFound for an unknown ad number without touching AdsService', async () => {
    const { db } = createDbStub({ select: [...baseSelects(), []] });
    const { service, adsService } = createService(db);

    await expect(service.getAnalytics('99')).rejects.toBeInstanceOf(NotFoundException);
    expect(adsService.getReportForAdmin).not.toHaveBeenCalled();
  });

  it('rejects a malformed ?ad= before it can reach the uuid column', async () => {
    const { db } = createDbStub({ select: baseSelects() });
    const { service } = createService(db);

    await expect(service.getAnalytics('not-a-uuid')).rejects.toBeInstanceOf(NotFoundException);
    // Only the five analytics selects ran — no ads lookup.
    expect(db.select).toHaveBeenCalledTimes(5);
  });
});

describe('AdminService — settings', () => {
  const user = { id: 'admin-1', name: '관리자', email: 'admin@example.com' } as never;

  it('row가 없어도 getSettings는 DEFAULT_VALUES 기본값을 반환한다', async () => {
    const { db } = createDbStub({ select: [[]] });
    const { service } = createService(db);

    const result = await service.getSettings(user);

    expect(result.values).toEqual(DEFAULT_VALUES);
  });

  it('getSettings는 저장 값을 DEFAULT_VALUES 위에 병합한다', async () => {
    const { db } = createDbStub({
      select: [[{ id: 'default', values: { maintenanceMode: true } }]],
    });
    const { service } = createService(db);

    const result = await service.getSettings(user);

    expect(result.values).toEqual({ ...DEFAULT_VALUES, maintenanceMode: true });
  });

  it('updateSettings는 공유 id 아래 저장하고 병합된 값을 반환한다', async () => {
    const { db, setCalls, valuesCalls } = createDbStub({
      select: [
        [{ id: 'default', values: { reportAlert: true } }],
        [{ id: 'default', values: { reportAlert: true, maintenanceMode: true } }],
      ],
    });
    const { service } = createService(db);

    const result = await service.updateSettings({ maintenanceMode: true }, user);

    expect(setCalls[0]?.[0]).toMatchObject({
      values: { reportAlert: true, maintenanceMode: true },
    });
    expect(valuesCalls).toHaveLength(0); // 기존 row가 있으므로 insert 경로가 아니다
    expect(result.values).toEqual({ ...DEFAULT_VALUES, reportAlert: true, maintenanceMode: true });
  });
});

describe('AdminService — settings insert 경로', () => {
  const user = { id: 'admin-1', name: '관리자', email: 'admin@example.com' } as never;

  it('row가 없으면 insert 경로로 공유 id 아래 저장한다', async () => {
    const { db, valuesCalls } = createDbStub({
      select: [[], [{ id: ADMIN_SETTINGS_ID, values: { maintenanceMode: true } }]],
    });
    const { service } = createService(db);

    const result = await service.updateSettings({ maintenanceMode: true }, user);

    expect(valuesCalls[0]?.[0]).toMatchObject({
      id: ADMIN_SETTINGS_ID,
      values: { maintenanceMode: true },
    });
    expect(result.values).toEqual({ ...DEFAULT_VALUES, maintenanceMode: true });
  });
});

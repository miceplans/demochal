import { NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ads, applications, businesses, orders, payments, users } from '../../db/schema.js';
import { niceMax, timeBuckets } from './admin.service.js';
import {
  createDbStub,
  collectStrings,
  createNotificationsStub,
  referencesColumn,
  createAdsStub,
  createService,
} from './admin.test-helpers.js';

describe('AdminService — time buckets', () => {
  const now = new Date('2026-09-23T10:00:00Z');

  it('rolls the day over at KST midnight, not UTC midnight', () => {
    // 2026-09-23 16:00 UTC = 2026-09-24 01:00 KST
    const buckets = timeBuckets('day', 2, new Date('2026-09-23T16:00:00Z'));
    expect(buckets.keys).toEqual(['2026-09-23', '2026-09-24']);
    expect(buckets.since.toISOString()).toBe('2026-09-22T15:00:00.000Z');
  });

  it('builds consecutive day buckets ending today', () => {
    const buckets = timeBuckets('day', 3, now);
    expect(buckets.keys).toEqual(['2026-09-21', '2026-09-22', '2026-09-23']);
    expect(buckets.labels).toEqual(['9/21', '9/22', '9/23']);
    expect(buckets.since.toISOString()).toBe('2026-09-20T15:00:00.000Z');
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

  it('fills traffic buckets from user signups and application submissions and computes the ad revenue share', async () => {
    const { db, selectWhereCalls } = createDbStub({
      select: [
        [{ count: 5 }],
        [{ count: 3 }],
        [{ count: 10 }],
        [{ count: 2 }],
        [],
        [
          { bucket: '2026-09-17', count: 4 },
          { bucket: '2026-09-23', count: 1 },
        ],
        [{ bucket: '2026-09-23', count: 2 }],
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

    // Traffic: primary는 일반 사용자(user) 신규 가입, secondary는 신규 제출물(applications).
    const signupSelect = db.select.mock.calls[5]![0];
    expect(referencesColumn(signupSelect.bucket, users.createdAt)).toBe(true);
    expect(collectStrings(selectWhereCalls[3])).toContain('user');
    const submissionSelect = db.select.mock.calls[6]![0];
    expect(referencesColumn(submissionSelect.bucket, applications.createdAt)).toBe(true);

    // Revenue is scoped to completed payments (paid + legacy done) within the
    // same window, and the ad share keys off orders.adId.
    const revenueSelect = db.select.mock.calls[7]![0];
    expect(referencesColumn(revenueSelect.ad, orders.adId)).toBe(true);
    expect(referencesColumn(revenueSelect.total, payments.refundedAmount)).toBe(true);
    const revenueWhere = selectWhereCalls[selectWhereCalls.length - 1];
    expect(collectStrings(revenueWhere)).toEqual(expect.arrayContaining(['paid', 'done']));
  });

  it('counts legacy done payments alongside paid in the ad revenue window', async () => {
    const { db, selectWhereCalls } = createDbStub({
      select: [
        [{ count: 0 }],
        [{ count: 0 }],
        [{ count: 0 }],
        [{ count: 0 }],
        [],
        [],
        [],
        [{ total: 50_000, ad: 20_000 }],
      ],
    });
    const { service } = createService(db);

    const result = await service.getDashboard('7days');

    expect(result.adRatio).toEqual({ value: '20,000 ₩', ratio: 0.4 });
    const revenueWhere = selectWhereCalls[selectWhereCalls.length - 1];
    expect(collectStrings(revenueWhere)).toEqual(expect.arrayContaining(['paid', 'done']));
  });

  it('returns a zero ratio instead of dividing by zero when there is no revenue', async () => {
    const { db } = createDbStub({
      select: [[{ count: 0 }], [{ count: 0 }], [{ count: 0 }], [{ count: 0 }], [], [], [], []],
    });
    const { service } = createService(db);

    const result = await service.getDashboard('30days');

    expect(result.adRatio).toEqual({ value: '0 ₩', ratio: 0 });
    expect(result.traffic.labels).toHaveLength(30);
    expect(result.traffic.primary.every((value) => value === 0)).toBe(true);
  });

  it('defaults to 12 month buckets ending this month', async () => {
    const { db } = createDbStub({
      select: [[{ count: 0 }], [{ count: 0 }], [{ count: 0 }], [{ count: 0 }], [], [], [], []],
    });
    const { service } = createService(db);

    const result = await service.getDashboard();

    expect(result.traffic.labels).toHaveLength(12);
    expect(result.traffic.labels[0]).toBe('10월');
    expect(result.traffic.labels[11]).toBe('9월');
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
      paidAmount: 999,
    },
    organization: '부산광역시',
  };
  // users(30d), challenges(30d), payments, user signups/month, new businesses/month
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

    // Activity: general은 일반 사용자(user) 신규 가입, corp는 신규 기업(businesses) 가입.
    expect(referencesColumn(db.select.mock.calls[3]![0].bucket, users.createdAt)).toBe(true);
    expect(collectStrings(selectWhereCalls[3])).toContain('user');
    expect(referencesColumn(db.select.mock.calls[4]![0].bucket, businesses.createdAt)).toBe(true);
  });

  it('nets platform revenue against refundedAmount on paid and legacy done payments', async () => {
    const { db, selectWhereCalls } = createDbStub({ select: baseSelects() });
    const { service } = createService(db);

    await service.getAnalytics();

    const revenueSelectArg = db.select.mock.calls[2]![0];
    expect(referencesColumn(revenueSelectArg.total, payments.amount)).toBe(true);
    expect(referencesColumn(revenueSelectArg.total, payments.refundedAmount)).toBe(true);
    expect(collectStrings(selectWhereCalls[2])).toEqual(expect.arrayContaining(['paid', 'done']));
  });

  it('resolves ?ad=N by the stable ads.ad_number column, not list position', async () => {
    const { db, selectWhereCalls } = createDbStub({
      select: [...baseSelects(), [adRow], [{ total: 250 }]],
    });
    const { service, adsService } = createService(db);

    const result = await service.getAnalytics('7');

    // 마지막 select는 결제 순액 집계라, 광고 조회는 그 직전이다.
    const adWhere = selectWhereCalls[selectWhereCalls.length - 2]?.[0];
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
    const { db, selectWhereCalls } = createDbStub({
      select: [...baseSelects(), [adRow], [{ total: 250 }]],
    });
    const { service } = createService(db, createNotificationsStub(), createAdsStub(report));

    const result = await service.getAnalytics(uuid);

    // 마지막 select는 결제 순액 집계라, 광고 조회는 그 직전이다.
    const adWhere = selectWhereCalls[selectWhereCalls.length - 2]?.[0];
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

  it('rejects digit ad numbers past the int4 range before querying', async () => {
    // 2147483648 = int4 max + 1, 9999999999과 30자리 수는 파싱해도 int4를 넘는다.
    for (const ad of ['2147483648', '9999999999', '9'.repeat(30)]) {
      const { db } = createDbStub({ select: baseSelects() });
      const { service, adsService } = createService(db);

      await expect(service.getAnalytics(ad)).rejects.toBeInstanceOf(NotFoundException);
      // Only the five analytics selects ran — no ads lookup.
      expect(db.select).toHaveBeenCalledTimes(5);
      expect(adsService.getReportForAdmin).not.toHaveBeenCalled();
    }
  });
});

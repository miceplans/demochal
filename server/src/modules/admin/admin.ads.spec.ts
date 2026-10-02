import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ads, businesses } from '../../db/schema.js';
import {
  createDbStub,
  collectStrings,
  referencesColumn,
  createService,
} from './admin.test-helpers.js';

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
  const adRow = {
    id: 'ad-1',
    title: '2026 AI 챌린지 광고',
    status: 'active',
    paidAmount: 300000,
    endDate: new Date('2999-01-01'),
  };

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

  it('shows an active ad whose contract has ended as 종료(ended)', async () => {
    const expired = { ...adRow, endDate: new Date('2020-01-01') };
    const { db } = createDbStub({
      select: [[{ ad: expired, organization: '부산광역시', productName: '홈 배너' }]],
    });
    const { service } = createService(db);

    const [row] = await service.listAds();

    expect(row?.status).toBe('ended');
  });

  it('active filter excludes expired contracts; ended filter includes them', async () => {
    const { db, selectWhereCalls } = createDbStub({ select: [[], []] });
    const { service } = createService(db);

    await service.listAds(undefined, 'active');
    await service.listAds(undefined, 'ended');

    expect(referencesColumn(selectWhereCalls[0], ads.endDate)).toBe(true);
    expect(referencesColumn(selectWhereCalls[1], ads.endDate)).toBe(true);
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

describe('AdminService — ad pause', () => {
  it('pauses an active ad with an atomic conditional update', async () => {
    const { db, setCalls } = createDbStub({ update: [[{ id: 'ad1', status: 'paused' }]] });
    const { service } = createService(db);

    await expect(service.pauseAd('ad1')).resolves.toEqual({ id: 'ad1', status: 'paused' });
    expect(setCalls[0]).toEqual([{ status: 'paused' }]);
  });

  it('refuses a non-active ad with 400', async () => {
    const { db } = createDbStub({ update: [[]], select: [[{ id: 'ad1' }]] });
    const { service } = createService(db);

    await expect(service.pauseAd('ad1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws 404 for an unknown ad', async () => {
    const { db } = createDbStub({ update: [[]], select: [[]] });
    const { service } = createService(db);

    await expect(service.pauseAd('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

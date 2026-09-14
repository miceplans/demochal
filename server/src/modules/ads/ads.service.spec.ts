import { describe, expect, it, vi } from 'vitest';
import { AdsService } from './ads.service.js';

function createDbStub(existingAd?: Record<string, unknown>) {
  const limit = vi.fn().mockResolvedValue(existingAd ? [existingAd] : []);
  const set = vi.fn();
  const returning = vi.fn();
  const db: any = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit })) })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((value: unknown) => {
        set(value);
        return { where: vi.fn(() => ({ returning })) };
      }),
    })),
  };
  return { db, limit, set, returning };
}

function createBusinessesStub(business?: { id: string }) {
  return { findByOwner: vi.fn().mockResolvedValue(business) };
}

const OWNER = { id: 'user-1', email: 'biz@x.com', name: 'Biz', role: 'business' };
const ADMIN = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: 'admin' };
const AD = { id: 'ad-1', businessId: 'biz-1', status: 'active', title: '히어로 광고' };

describe('AdsService.updateStatus', () => {
  it('rejects a non-owning business with 403', async () => {
    const { db, set, returning } = createDbStub(AD);
    returning.mockResolvedValue([AD]);
    const businesses = createBusinessesStub({ id: 'biz-other' });
    const service = new AdsService(db, businesses as any);

    await expect(
      service.updateStatus('ad-1', { status: 'paused' }, OWNER),
    ).rejects.toThrow('Only the owning business');

    expect(set).not.toHaveBeenCalled();
  });

  it('rejects a business user with no business with 403', async () => {
    const { db } = createDbStub(AD);
    const service = new AdsService(db, createBusinessesStub(undefined) as any);

    await expect(
      service.updateStatus('ad-1', { status: 'paused' }, OWNER),
    ).rejects.toThrow('Only the owning business');
  });

  it('rejects activating an unpaid preparing ad with 400', async () => {
    const { db, set, returning } = createDbStub({ ...AD, status: 'preparing' });
    returning.mockResolvedValue([{ ...AD, status: 'active' }]);
    const businesses = createBusinessesStub({ id: 'biz-1' });
    const service = new AdsService(db, businesses as any);

    await expect(
      service.updateStatus('ad-1', { status: 'active' }, OWNER),
    ).rejects.toThrow('Unpaid ads cannot be activated directly');

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

  it('lets an admin change any ad', async () => {
    const { db, returning } = createDbStub(AD);
    returning.mockResolvedValue([{ ...AD, status: 'ended' }]);
    const businesses = createBusinessesStub(undefined);
    const service = new AdsService(db, businesses as any);

    await expect(
      service.updateStatus('ad-1', { status: 'ended' }, ADMIN),
    ).resolves.toEqual({ ...AD, status: 'ended' });
  });

  it('throws 404 for unknown ads', async () => {
    const { db } = createDbStub(undefined);
    const service = new AdsService(db, createBusinessesStub({ id: 'biz-1' }) as any);

    await expect(
      service.updateStatus('missing', { status: 'paused' }, OWNER),
    ).rejects.toThrow('Ad not found');
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
    const today = new Date().toISOString().slice(0, 10);
    const sixDaysAgo = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
    expect(report.daily![0]!.date).toBe(sixDaysAgo);
    expect(report.daily![6]!.date).toBe(today);
    for (const row of report.daily!) {
      expect(row).toMatchObject({ impressions: 0, clicks: 0, ctr: 0 });
    }
    expect(report.hourly).toHaveLength(24);
    expect(report.hourly![0]).toEqual({ hour: 0, label: '0시~1시', impressions: 0, clicks: 0, ctr: 0 });
    expect(report.hourly![23]).toEqual({ hour: 23, label: '23시~24시', impressions: 0, clicks: 0, ctr: 0 });
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
});

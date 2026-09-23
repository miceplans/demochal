import { describe, expect, it, vi } from 'vitest';
import { BizService } from './biz.service.js';

/** select().from().where().orderBy().limit() chain for the recent-challenge lookup. */
function createDbStub(recentChallenge?: Record<string, unknown>) {
  const limit = vi.fn().mockResolvedValue(recentChallenge ? [recentChallenge] : []);
  const db: any = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit })) })),
      })),
    })),
  };
  return { db, limit };
}

function createDeps(overrides: {
  business?: { id: string } | undefined;
  stats?: unknown;
  history?: { items: unknown[]; total: number };
  activeAds?: unknown[];
}) {
  return {
    businessesService: { findByOwner: vi.fn().mockResolvedValue(overrides.business) },
    challengesService: { getStats: vi.fn().mockResolvedValue(overrides.stats) },
    billingHistoryService: {
      forBusiness: vi.fn().mockResolvedValue(overrides.history ?? { items: [], total: 0 }),
    },
    adsService: { listMine: vi.fn().mockResolvedValue(overrides.activeAds ?? []) },
  };
}

const OWNER = { id: 'user-1', email: 'biz@x.com', name: 'Biz', role: 'business' };

describe('BizService', () => {
  it('returns null stats when the business has no postings yet', async () => {
    const { db } = createDbStub();
    const deps = createDeps({ business: { id: 'biz-1' } });
    const service = new BizService(
      db,
      deps.businessesService as any,
      deps.challengesService as any,
      deps.billingHistoryService as any,
      deps.adsService as any,
    );

    const dashboard = await service.dashboard(OWNER.id);

    expect(dashboard.recentPosting).toBeNull();
    expect(dashboard.stats).toBeNull();
    expect(deps.challengesService.getStats).not.toHaveBeenCalled();
    expect(dashboard.monthlyAdExposure).toEqual([]);
    expect(dashboard.payments).toEqual([]);
    expect(dashboard.paymentTotal).toBe(0);
    expect(dashboard.activeAds).toEqual([]);
  });

  it('builds the dashboard from the latest challenge, history, and active ads', async () => {
    const recent = { id: 'ch-1', title: '신규 공고' };
    const { db } = createDbStub(recent);
    const stats = { clicks: { value: 42, deltaPercent: 0 } };
    const historyItems = [
      { id: 'p1', amount: -10 },
      { id: 'p2', amount: -20 },
      { id: 'p3', amount: -30 },
      { id: 'p4', amount: -40 },
    ];
    const activeAds = [{ id: 'ad-1', status: 'active' }];
    const deps = createDeps({
      business: { id: 'biz-1' },
      stats,
      history: { items: historyItems, total: -100 },
      activeAds,
    });
    const service = new BizService(
      db,
      deps.businessesService as any,
      deps.challengesService as any,
      deps.billingHistoryService as any,
      deps.adsService as any,
    );

    const dashboard = await service.dashboard(OWNER.id);

    expect(dashboard.recentPosting).toEqual(recent);
    expect(deps.challengesService.getStats).toHaveBeenCalledWith('ch-1');
    expect(dashboard.stats).toEqual(stats);
    expect(deps.billingHistoryService.forBusiness).toHaveBeenCalledWith('biz-1', {});
    // Only the top 3 history items, but the total covers all of them.
    expect(dashboard.payments).toHaveLength(3);
    expect(dashboard.paymentTotal).toBe(-100);
    expect(deps.adsService.listMine).toHaveBeenCalledWith('biz-1', 'active');
    expect(dashboard.activeAds).toEqual(activeAds);
  });

  it('rejects users without a business', async () => {
    const { db } = createDbStub();
    const deps = createDeps({ business: undefined });
    const service = new BizService(
      db,
      deps.businessesService as any,
      deps.challengesService as any,
      deps.billingHistoryService as any,
      deps.adsService as any,
    );

    await expect(service.dashboard(OWNER.id)).rejects.toThrow('Business account required');
  });
});

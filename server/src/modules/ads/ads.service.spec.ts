import { describe, it, expect, vi, afterEach } from 'vitest';
import { AdsService } from './ads.service.js';
import { AdminAdsService } from '../admin/admin-ads.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { adPeriod, adToday } from './ad-period.js';
import { adProducts, ads, notifications, orders } from '../../db/schema.js';
import type { Database } from '../../db/drizzle.provider.js';

// A scripted DB double keeps assertions at the service boundary: rows written,
// transaction use and the row lock that serializes concurrent reservations.
function database(reads: unknown[][]) {
  const writes: { table: unknown; value: any }[] = [];
  const locks: string[] = [];
  function query(rows: unknown[]) {
    const chain: any = {
      then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
    };
    for (const method of ['from', 'where', 'limit', 'innerJoin', 'orderBy'])
      chain[method] = () => chain;
    chain.for = (mode: string) => {
      locks.push(mode);
      return chain;
    };
    return chain;
  }
  const db: any = {
    select: () => query(reads.shift() ?? []),
    insert: (table: unknown) => ({
      values: (value: unknown) => {
        writes.push({ table, value });
        return {
          ...query([]),
          returning: () => Promise.resolve([{ id: 'new-ad', ...(value as object) }]),
        };
      },
    }),
    update: (table: unknown) => ({
      set: (value: unknown) => {
        writes.push({ table, value });
        return query([]);
      },
    }),
    transaction: vi.fn(async (run: (tx: unknown) => unknown) => run(db)),
  };
  return { db: db as Database, writes, locks };
}
const product = { id: 'hero', name: '배너', dailyPrice: 7000 };
const dto = {
  productId: 'hero',
  startDate: '2099-09-11',
  endDate: '2099-09-13',
  expectedDailyPrice: 7000,
};
afterEach(() => vi.useRealTimers());

describe('advertising contracts', () => {
  it('charges the new buyer the current price and freezes the same amount on the ad and order', async () => {
    const { db, writes, locks } = database([[{ id: 'business' }], [product], []]);
    const result = await new AdsService(db).create(dto, 'buyer');
    expect(result.paidAmount).toBe(21000);
    expect(writes.find((write) => write.table === orders)?.value.amount).toBe(21000);
    expect(db.transaction).toHaveBeenCalledOnce();
    expect(locks).toEqual(['update']);
  });
  it('rejects a conflicting reservation without creating an ad or order', async () => {
    const { db, writes } = database([[{ id: 'business' }], [product], [{ id: 'existing' }]]);
    await expect(new AdsService(db).create(dto, 'buyer')).rejects.toThrow('이미 계약된');
    expect(writes).toEqual([]);
  });
  it('requires the buyer to review a changed price', async () => {
    const { db, writes } = database([[{ id: 'business' }], [{ ...product, dailyPrice: 9000 }]]);
    await expect(new AdsService(db).create(dto, 'buyer')).rejects.toThrow('단가가 변경');
    expect(writes).toEqual([]);
  });
  it('notifies existing buyers without rewriting their paid amount or dates', async () => {
    const { db, writes } = database([
      [product],
      [{ userId: 'A', ad: { id: 'A-ad', paidAmount: 15000 } }],
    ]);
    const service = new AdminAdsService(db);
    vi.spyOn(service, 'getAdPricing').mockResolvedValue([]);
    await service.updateAdPricing([{ slot: 'hero', dailyPrice: 9000 }]);
    expect(writes.filter((write) => write.table === ads || write.table === orders)).toEqual([]);
    expect(writes.find((write) => write.table === adProducts)?.value).toEqual({ dailyPrice: 9000 });
    expect(writes.find((write) => write.table === notifications)?.value).toMatchObject({
      userId: 'A',
      payload: { paidAmount: 15000, dailyPrice: 9000, previousDailyPrice: 7000 },
    });
  });
  it('does not notify if the price did not change', async () => {
    const { db, writes } = database([[product]]);
    const service = new AdminAdsService(db);
    vi.spyOn(service, 'getAdPricing').mockResolvedValue([]);
    await service.updateAdPricing([{ slot: 'hero', dailyPrice: 7000 }]);
    expect(writes).toEqual([]);
  });
  it('does not reactivate an ended ad on a duplicate payment webhook', async () => {
    const { db, writes } = database([[{ id: 'order', status: 'paid', adId: 'ended-ad' }]]);
    await new OrdersService(db).markPaid('order');
    expect(writes).toEqual([]);
  });
  it('rejects payment for a released reservation', async () => {
    const { db, writes } = database([
      [{ id: 'order', status: 'pending', adId: 'ended-ad' }],
      [{ status: 'ended' }],
    ]);
    await expect(new OrdersService(db).markPaid('order')).rejects.toThrow('종료되거나 취소된');
    expect(writes).toEqual([]);
  });
  it('counts the last exposure day and supports a one-day contract', () => {
    expect(adPeriod('2099-09-11', '2099-09-11').days).toBe(1);
    expect(adPeriod(dto.startDate, dto.endDate).days).toBe(3);
  });
  it('rejects reversed, impossible and past dates', () => {
    expect(() => adPeriod('2099-09-13', '2099-09-11')).toThrow();
    expect(() => adPeriod('2099-02-30', '2099-03-03')).toThrow();
    expect(() => adPeriod('2000-01-01', '2000-01-02')).toThrow();
  });
  it('changes the booking day at Korean midnight', () => {
    expect(adToday(new Date('2026-09-10T15:00:00Z')).toISOString()).toBe(
      '2026-09-11T00:00:00.000Z',
    );
  });
});

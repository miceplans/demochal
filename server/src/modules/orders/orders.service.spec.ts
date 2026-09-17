import { NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { ads } from '../../db/schema.js';
import { OrdersService } from './orders.service.js';

/** Chainable drizzle stub for the select().from().where().for('update') / update().set().where().returning() shapes. */
function createDbStub(existingOrder?: { id: string; status: string; adId?: string }) {
  const forUpdate = vi.fn().mockResolvedValue(existingOrder ? [existingOrder] : []);
  const selectFrom = vi
    .fn()
    .mockReturnValue({ where: vi.fn().mockReturnValue({ for: forUpdate }) });

  const ordersReturning = vi
    .fn()
    .mockResolvedValue(existingOrder ? [{ ...existingOrder, status: 'canceled' }] : [undefined]);
  const ordersUpdateSet = vi
    .fn()
    .mockReturnValue({ where: vi.fn().mockReturnValue({ returning: ordersReturning }) });

  const adsUpdateWhere = vi.fn().mockResolvedValue(undefined);
  const adsUpdateSet = vi.fn().mockReturnValue({ where: adsUpdateWhere });

  const update = vi.fn((table: unknown) => {
    if (table === ads) return { set: adsUpdateSet };
    return { set: ordersUpdateSet };
  });

  const db: any = {
    select: vi.fn(() => ({ from: selectFrom })),
    update,
  };
  db.transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db));
  return { db, ordersUpdateSet, adsUpdateSet, adsUpdateWhere };
}

describe('OrdersService.markCancelled', () => {
  it('cancels a pending order', async () => {
    const { db, ordersUpdateSet, adsUpdateSet } = createDbStub({
      id: 'order-1',
      status: 'pending',
    });
    const service = new OrdersService(db);

    const result = await service.markCancelled('order-1');

    expect(ordersUpdateSet).toHaveBeenCalledWith({ status: 'canceled' });
    expect(adsUpdateSet).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ status: 'canceled' }));
  });

  it('cancels a paid order without an ad (refund only)', async () => {
    const { db, ordersUpdateSet, adsUpdateSet } = createDbStub({ id: 'order-1', status: 'paid' });
    const service = new OrdersService(db);

    await service.markCancelled('order-1');

    expect(ordersUpdateSet).toHaveBeenCalledWith({ status: 'canceled' });
    expect(adsUpdateSet).not.toHaveBeenCalled();
  });

  it('reverts the activated ad when a paid order with an ad is canceled', async () => {
    const { db, adsUpdateSet, adsUpdateWhere } = createDbStub({
      id: 'order-1',
      status: 'paid',
      adId: 'ad-1',
    });
    const service = new OrdersService(db);

    await service.markCancelled('order-1');

    expect(adsUpdateSet).toHaveBeenCalledWith({ status: 'ended' });
    expect(adsUpdateWhere).toHaveBeenCalledWith(and(eq(ads.id, 'ad-1'), eq(ads.status, 'active')));
  });

  it('does not revert an ad for a canceled pending order that never activated it', async () => {
    const { db, adsUpdateSet } = createDbStub({ id: 'order-1', status: 'pending', adId: 'ad-1' });
    const service = new OrdersService(db);

    await service.markCancelled('order-1');

    expect(adsUpdateSet).not.toHaveBeenCalled();
  });

  it('is idempotent for an already-canceled order', async () => {
    const { db, ordersUpdateSet, adsUpdateSet } = createDbStub({
      id: 'order-1',
      status: 'canceled',
    });
    const service = new OrdersService(db);

    const result = await service.markCancelled('order-1');

    expect(ordersUpdateSet).not.toHaveBeenCalled();
    expect(adsUpdateSet).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'order-1', status: 'canceled' });
  });

  it('throws for a missing order', async () => {
    const { db } = createDbStub(undefined);
    const service = new OrdersService(db);

    await expect(service.markCancelled('missing')).rejects.toThrow(NotFoundException);
  });
});

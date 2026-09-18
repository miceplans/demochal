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

/**
 * markPaid()/payOrder() stub: select() is called once for the order and,
 * when the order has an adId, a second time for the ad — both via
 * .from().where().for('update'), so the queued `forUpdateResults` are
 * consumed in that order.
 */
function createPayOrderDbStub(
  existingOrder?: { id: string; status: string; adId?: string },
  ad?: { id: string; status: string; endDate: Date },
) {
  const forUpdateResults = [existingOrder ? [existingOrder] : []];
  if (existingOrder?.adId) forUpdateResults.push(ad ? [ad] : []);
  const forUpdate = vi.fn(() => Promise.resolve(forUpdateResults.shift()));
  const selectFrom = vi
    .fn()
    .mockReturnValue({ where: vi.fn().mockReturnValue({ for: forUpdate }) });

  const ordersReturning = vi
    .fn()
    .mockResolvedValue(existingOrder ? [{ ...existingOrder, status: 'paid' }] : [undefined]);
  const ordersUpdateSet = vi
    .fn()
    .mockReturnValue({ where: vi.fn().mockReturnValue({ returning: ordersReturning }) });

  const adsUpdateWhere = vi.fn().mockResolvedValue(undefined);
  const adsUpdateSet = vi.fn().mockReturnValue({ where: adsUpdateWhere });

  const update = vi.fn((table: unknown) => {
    if (table === ads) return { set: adsUpdateSet };
    return { set: ordersUpdateSet };
  });

  const db: any = { select: vi.fn(() => ({ from: selectFrom })), update };
  db.transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db));
  return { db, ordersUpdateSet, adsUpdateSet };
}

describe('OrdersService.markPaid', () => {
  it('pays a pending order without an ad', async () => {
    const { db, ordersUpdateSet, adsUpdateSet } = createPayOrderDbStub({
      id: 'order-1',
      status: 'pending',
    });
    const service = new OrdersService(db);

    const result = await service.markPaid('order-1');

    expect(ordersUpdateSet).toHaveBeenCalledWith({ status: 'paid' });
    expect(adsUpdateSet).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ status: 'paid' }));
  });

  it('activates a preparing ad when paying its order', async () => {
    const { db, adsUpdateSet } = createPayOrderDbStub(
      { id: 'order-1', status: 'pending', adId: 'ad-1' },
      { id: 'ad-1', status: 'preparing', endDate: new Date('2999-01-01') },
    );
    const service = new OrdersService(db);

    await service.markPaid('order-1');

    expect(adsUpdateSet).toHaveBeenCalledWith({ status: 'active' });
  });

  it('is idempotent for an already-paid order', async () => {
    const { db, ordersUpdateSet, adsUpdateSet } = createPayOrderDbStub({
      id: 'order-1',
      status: 'paid',
    });
    const service = new OrdersService(db);

    const result = await service.markPaid('order-1');

    expect(ordersUpdateSet).not.toHaveBeenCalled();
    expect(adsUpdateSet).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'order-1', status: 'paid' });
  });

  it('rejects paying an order that is not pending', async () => {
    const { db } = createPayOrderDbStub({ id: 'order-1', status: 'canceled' });
    const service = new OrdersService(db);

    await expect(service.markPaid('order-1')).rejects.toThrow('결제할 수 없는 주문입니다.');
  });

  it('throws for a missing order', async () => {
    const { db } = createPayOrderDbStub(undefined);
    const service = new OrdersService(db);

    await expect(service.markPaid('missing')).rejects.toThrow(NotFoundException);
  });
});

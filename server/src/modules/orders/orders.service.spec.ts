import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OrdersService } from './orders.service.js';

/** Chainable drizzle stub for the select().from().where().for('update') / update().set().where().returning() shapes. */
function createDbStub(existingOrder?: { id: string; status: string }) {
  const forUpdate = vi.fn().mockResolvedValue(existingOrder ? [existingOrder] : []);
  const selectFrom = vi
    .fn()
    .mockReturnValue({ where: vi.fn().mockReturnValue({ for: forUpdate }) });
  const returning = vi
    .fn()
    .mockResolvedValue(existingOrder ? [{ ...existingOrder, status: 'canceled' }] : [undefined]);
  const updateSet = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning }) });
  const db: any = {
    select: vi.fn(() => ({ from: selectFrom })),
    update: vi.fn(() => ({ set: updateSet })),
  };
  db.transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db));
  return { db, updateSet };
}

describe('OrdersService.markCancelled', () => {
  it('cancels a pending order', async () => {
    const { db, updateSet } = createDbStub({ id: 'order-1', status: 'pending' });
    const service = new OrdersService(db);

    const result = await service.markCancelled('order-1');

    expect(updateSet).toHaveBeenCalledWith({ status: 'canceled' });
    expect(result).toEqual(expect.objectContaining({ status: 'canceled' }));
  });

  it('cancels a paid order (refund)', async () => {
    const { db, updateSet } = createDbStub({ id: 'order-1', status: 'paid' });
    const service = new OrdersService(db);

    await service.markCancelled('order-1');

    expect(updateSet).toHaveBeenCalledWith({ status: 'canceled' });
  });

  it('is idempotent for an already-canceled order', async () => {
    const { db, updateSet } = createDbStub({ id: 'order-1', status: 'canceled' });
    const service = new OrdersService(db);

    const result = await service.markCancelled('order-1');

    expect(updateSet).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'order-1', status: 'canceled' });
  });

  it('throws for a missing order', async () => {
    const { db } = createDbStub(undefined);
    const service = new OrdersService(db);

    await expect(service.markCancelled('missing')).rejects.toThrow(NotFoundException);
  });
});

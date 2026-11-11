import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { REFUND_RESULT_NOTIFICATION, RefundsService } from './refunds.service.js';

const openRequest = {
  id: 'req-1',
  orderId: 'order-1',
  userId: 'user-1',
  reason: '단순 변심',
  status: 'requested',
};

/** select().from().where().limit() → rows; insert().values().returning(); transaction runs fn(tx). */
function createService(opts: {
  selectRows?: unknown[];
  orderStatus?: string;
  insertError?: unknown;
  updateReturning?: unknown[];
  refundImpl?: (o: string, r: string, settle: (tx: unknown, amt: number) => Promise<void>) => any;
}) {
  const returning = vi.fn().mockResolvedValue(opts.updateReturning ?? [{ id: 'req-1' }]);
  const updateWhere = vi.fn(() => ({ returning }));
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const tx = {
    update: vi.fn(() => ({ set: updateSet })),
    select: vi.fn(() => ({
      from: () => ({ where: () => ({ for: vi.fn().mockResolvedValue([openRequest]) }) }),
    })),
  };
  const insertReturning = opts.insertError
    ? vi.fn().mockRejectedValue(opts.insertError)
    : vi.fn().mockResolvedValue([{ id: 'req-1' }]);
  const insertValues = vi.fn(() => ({ returning: insertReturning }));
  const db: any = {
    select: vi.fn(() => ({
      from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue(opts.selectRows ?? []) }) }),
    })),
    insert: vi.fn(() => ({ values: insertValues })),
    transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
  };
  const orders = {
    findById: vi
      .fn()
      .mockResolvedValue({ id: 'order-1', userId: 'user-1', status: opts.orderStatus ?? 'paid' }),
  };
  const payments = {
    refundPaidOrder: vi.fn(
      opts.refundImpl ?? (async (_o, _r, settle) => (await settle(tx, 40000), 40000)),
    ),
  };
  const notifications = { create: vi.fn().mockResolvedValue(undefined) };
  const service = new RefundsService(db, orders as any, payments as any, notifications as any);
  return { service, db, tx, insertValues, updateSet, orders, payments, notifications };
}

describe('RefundsService', () => {
  describe('request', () => {
    it('creates a request for a paid order owned by the buyer', async () => {
      const { service, insertValues } = createService({});
      await service.request('user-1', 'order-1', '  단순 변심 ');
      expect(insertValues).toHaveBeenCalledWith({
        orderId: 'order-1',
        userId: 'user-1',
        reason: '단순 변심',
      });
    });

    it('rejects orders that are not paid', async () => {
      const { service, insertValues } = createService({ orderStatus: 'pending' });
      await expect(service.request('user-1', 'order-1', 'x')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(insertValues).not.toHaveBeenCalled();
    });

    it('rejects a whitespace-only reason', async () => {
      const { service, insertValues } = createService({});
      await expect(service.request('user-1', 'order-1', '   ')).rejects.toThrow(
        '환불 사유를 입력해 주세요',
      );
      expect(insertValues).not.toHaveBeenCalled();
    });

    it('maps the one-open-request unique violation to 409 (plain and wrapped pg errors)', async () => {
      for (const insertError of [{ code: '23505' }, { cause: { code: '23505' } }]) {
        const { service } = createService({ insertError });
        await expect(service.request('user-1', 'order-1', 'x')).rejects.toBeInstanceOf(
          ConflictException,
        );
      }
    });
  });

  describe('approve', () => {
    it('cancels via Toss then marks approved and notifies the buyer in the same tx', async () => {
      const { service, payments, updateSet, notifications, tx } = createService({
        selectRows: [openRequest],
      });

      await expect(service.approve('req-1', 'admin-1')).resolves.toEqual({
        id: 'req-1',
        status: 'approved',
      });

      expect(payments.refundPaidOrder).toHaveBeenCalledWith(
        'order-1',
        expect.stringContaining('단순 변심'),
        expect.any(Function),
        expect.any(Function),
      );
      expect(updateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved', processedBy: 'admin-1' }),
      );
      expect(notifications.create).toHaveBeenCalledWith(
        'user-1',
        REFUND_RESULT_NOTIFICATION,
        { orderId: 'order-1', status: 'approved', amount: 40000 },
        tx,
      );
    });

    it('does not touch request state when the Toss cancel fails', async () => {
      const { service, updateSet, notifications } = createService({
        selectRows: [openRequest],
        refundImpl: async () => {
          throw new Error('toss down');
        },
      });
      await expect(service.approve('req-1', 'admin-1')).rejects.toThrow('toss down');
      expect(updateSet).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('409s when a concurrent reject already processed the request', async () => {
      const { service } = createService({ selectRows: [openRequest], updateReturning: [] });
      await expect(service.approve('req-1', 'admin-1')).rejects.toBeInstanceOf(ConflictException);
    });

    it('404s for unknown and 409s for already-processed requests, without calling Toss', async () => {
      const missing = createService({ selectRows: [] });
      await expect(missing.service.approve('req-1', 'a')).rejects.toBeInstanceOf(NotFoundException);
      const done = createService({ selectRows: [{ ...openRequest, status: 'approved' }] });
      await expect(done.service.approve('req-1', 'a')).rejects.toBeInstanceOf(ConflictException);
      expect(missing.payments.refundPaidOrder).not.toHaveBeenCalled();
      expect(done.payments.refundPaidOrder).not.toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('rejects a whitespace-only reason', async () => {
      const { service, updateSet } = createService({ selectRows: [openRequest] });
      await expect(service.reject('req-1', 'admin-1', '   ')).rejects.toThrow(
        '반려 사유를 입력해 주세요',
      );
      expect(updateSet).not.toHaveBeenCalled();
    });

    it('marks rejected with the reason, notifies the buyer, and never calls Toss', async () => {
      const { service, payments, updateSet, notifications, tx } = createService({
        selectRows: [openRequest],
      });

      await expect(service.reject('req-1', 'admin-1', ' 기간 경과 ')).resolves.toEqual({
        id: 'req-1',
        status: 'rejected',
      });

      expect(updateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'rejected', adminNote: '기간 경과' }),
      );
      expect(notifications.create).toHaveBeenCalledWith(
        'user-1',
        REFUND_RESULT_NOTIFICATION,
        { orderId: 'order-1', status: 'rejected', reason: '기간 경과' },
        tx,
      );
      expect(payments.refundPaidOrder).not.toHaveBeenCalled();
    });
  });
});

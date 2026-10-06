import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ads } from '../../db/schema.js';
import { OrdersService } from '../orders/orders.service.js';
import { PaymentsService } from './payments.service.js';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

/**
 * Drizzle stub. insert().values() returns the conflict handlers the service
 * chains onto every payment write (unique on payments.orderId); select() backs
 * the PARTIAL_CANCELED precondition lookup over the existing payment row.
 */
function createDbStub(existingPayment: { status: string } | null = { status: 'paid' }) {
  const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const insertValues = vi.fn(() => ({ onConflictDoNothing, onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values: insertValues }));
  const limit = vi.fn().mockResolvedValue(existingPayment ? [existingPayment] : []);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  const tx = { insert };
  const transaction = vi.fn(async (fn: (txArg: unknown) => Promise<void>) => fn(tx));
  const db: any = { insert, select, transaction };
  return { db, tx, insertValues, onConflictDoNothing, onConflictDoUpdate, select, transaction };
}

function createOrdersStub(orderStatus: string = 'pending') {
  return {
    findByIdInternal: vi
      .fn()
      .mockResolvedValue({ id: 'order-1', amount: 50000, status: orderStatus }),
    markPaid: vi.fn().mockResolvedValue({}),
    settleOrderPaid: vi.fn().mockResolvedValue({}),
    markCancelled: vi.fn().mockResolvedValue({}),
    cancelOrder: vi.fn().mockResolvedValue({}),
  };
}

const webhook = (status: string) => ({
  eventType: `PAYMENT_${status}`,
  data: { paymentKey: 'pay-key-1', orderId: 'order-1', status },
});

const tossResponse = (status: string) => ({
  ok: true,
  json: async () => ({ status, orderId: 'order-1', paymentKey: 'pay-key-1', totalAmount: 50000 }),
});

const partialCancelTossResponse = () => ({
  ok: true,
  json: async () => ({
    status: 'PARTIAL_CANCELED',
    orderId: 'order-1',
    paymentKey: 'pay-key-1',
    totalAmount: 50000,
    balanceAmount: 30000,
  }),
});

describe('PaymentsService', () => {
  it('marks the order paid and persists a done payment for DONE', async () => {
    fetchMock.mockResolvedValue(tossResponse('DONE'));
    const { db, tx, insertValues, onConflictDoNothing, onConflictDoUpdate } = createDbStub();
    const orders = createOrdersStub();
    const service = new PaymentsService(db, orders as any);

    await service.handleTossWebhook(webhook('DONE'));

    // The order settlement must run inside the SAME transaction as the payment write.
    expect(orders.settleOrderPaid).toHaveBeenCalledWith(tx, 'order-1');
    expect(orders.markPaid).not.toHaveBeenCalled();
    expect(orders.markCancelled).not.toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        providerPaymentKey: 'pay-key-1',
        amount: 50000,
        status: 'paid',
      }),
    );
    // DONE never overwrites an existing payment row.
    expect(onConflictDoNothing).toHaveBeenCalledWith({ target: expect.anything() });
    expect(onConflictDoUpdate).not.toHaveBeenCalled();
  });

  it('cancels a pending order and upserts an expired payment for ABORTED', async () => {
    fetchMock.mockResolvedValue(tossResponse('ABORTED'));
    const { db, insertValues, onConflictDoUpdate } = createDbStub();
    const orders = createOrdersStub('pending');
    const service = new PaymentsService(db, orders as any);

    await service.handleTossWebhook(webhook('ABORTED'));

    expect(orders.cancelOrder).toHaveBeenCalledWith(expect.anything(), 'order-1', ['pending']);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1', status: 'expired' }),
    );
    expect(onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ set: { status: 'expired' } }),
    );
  });

  it('reconciles PARTIAL_CANCELED by persisting the Toss-reported refunded amount', async () => {
    fetchMock.mockResolvedValue(partialCancelTossResponse());
    const { db, insertValues, onConflictDoUpdate } = createDbStub();
    const orders = createOrdersStub('paid');
    const service = new PaymentsService(db, orders as any);

    await service.handleTossWebhook(webhook('PARTIAL_CANCELED'));

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        providerPaymentKey: 'pay-key-1',
        amount: 50000,
        status: 'paid',
        refundedAmount: 20000,
      }),
    );
    expect(onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ set: { refundedAmount: 20000 } }),
    );
    expect(orders.markCancelled).not.toHaveBeenCalled();
    expect(orders.markPaid).not.toHaveBeenCalled();
  });

  it('is idempotent across redelivered PARTIAL_CANCELED webhooks (sets, never increments)', async () => {
    fetchMock.mockResolvedValue(partialCancelTossResponse());
    const { db, onConflictDoUpdate } = createDbStub();
    const service = new PaymentsService(db, createOrdersStub('paid') as any);

    await service.handleTossWebhook(webhook('PARTIAL_CANCELED'));
    await service.handleTossWebhook(webhook('PARTIAL_CANCELED'));

    expect(onConflictDoUpdate).toHaveBeenCalledTimes(2);
    for (const [arg] of onConflictDoUpdate.mock.calls as any[]) {
      expect(arg).toEqual(expect.objectContaining({ set: { refundedAmount: 20000 } }));
    }
  });

  it('rejects PARTIAL_CANCELED that outran DONE instead of inserting a phantom paid row', async () => {
    fetchMock.mockResolvedValue(partialCancelTossResponse());
    const { db, insertValues, onConflictDoUpdate } = createDbStub(null);
    const orders = createOrdersStub('pending');
    const service = new PaymentsService(db, orders as any);

    await expect(service.handleTossWebhook(webhook('PARTIAL_CANCELED'))).rejects.toThrow(
      UnauthorizedException,
    );

    // No payment row exists yet — Toss redelivers after DONE settles the order.
    expect(insertValues).not.toHaveBeenCalled();
    expect(onConflictDoUpdate).not.toHaveBeenCalled();
  });

  it('applies a redelivered PARTIAL_CANCELED after DONE settles, idempotently', async () => {
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(partialCancelTossResponse()) // outran DONE → rejected
      .mockResolvedValueOnce(tossResponse('DONE')) // settlement
      .mockResolvedValue(partialCancelTossResponse()); // redeliveries
    const { db, insertValues, onConflictDoUpdate } = createDbStub();
    const order = { id: 'order-1', amount: 50000, status: 'pending' };
    const orders = {
      ...createOrdersStub(),
      findByIdInternal: vi.fn(async () => order),
      settleOrderPaid: vi.fn(async () => {
        order.status = 'paid';
      }),
    };
    const service = new PaymentsService(db, orders as any);

    // 1. PARTIAL_CANCELED raced ahead of DONE → rejected, no phantom row.
    await expect(service.handleTossWebhook(webhook('PARTIAL_CANCELED'))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(insertValues).not.toHaveBeenCalled();

    // 2. DONE settles the order and its payment row.
    await service.handleTossWebhook(webhook('DONE'));
    expect(orders.settleOrderPaid).toHaveBeenCalledTimes(1);

    // 3. Redelivered (and duplicated) PARTIAL_CANCELED converges via SET.
    await service.handleTossWebhook(webhook('PARTIAL_CANCELED'));
    await service.handleTossWebhook(webhook('PARTIAL_CANCELED'));
    expect(onConflictDoUpdate).toHaveBeenCalledTimes(2);
    for (const [arg] of onConflictDoUpdate.mock.calls as any[]) {
      expect(arg).toEqual(expect.objectContaining({ set: { refundedAmount: 20000 } }));
    }
  });

  it.each(['canceled', 'expired'])(
    'ignores PARTIAL_CANCELED for a payment already settled as %s',
    async (status) => {
      fetchMock.mockResolvedValue(partialCancelTossResponse());
      const { db, insertValues, onConflictDoUpdate } = createDbStub({ status });
      const orders = createOrdersStub(status);
      const service = new PaymentsService(db, orders as any);

      await expect(service.handleTossWebhook(webhook('PARTIAL_CANCELED'))).resolves.toBeUndefined();

      expect(insertValues).not.toHaveBeenCalled();
      expect(onConflictDoUpdate).not.toHaveBeenCalled();
    },
  );

  it('rejects a PARTIAL_CANCELED webhook whose Toss amount mismatches the order', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'PARTIAL_CANCELED',
        orderId: 'order-1',
        paymentKey: 'pay-key-1',
        totalAmount: 99999,
        balanceAmount: 30000,
      }),
    });
    const { db, insertValues } = createDbStub();
    const orders = createOrdersStub();
    const service = new PaymentsService(db, orders as any);

    await expect(service.handleTossWebhook(webhook('PARTIAL_CANCELED'))).rejects.toThrow(
      'did not match the order',
    );
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('rejects a PARTIAL_CANCELED response missing balanceAmount instead of guessing', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'PARTIAL_CANCELED',
        orderId: 'order-1',
        paymentKey: 'pay-key-1',
        totalAmount: 50000,
      }),
    });
    const { db, insertValues } = createDbStub();
    const orders = createOrdersStub();
    const service = new PaymentsService(db, orders as any);

    await expect(service.handleTossWebhook(webhook('PARTIAL_CANCELED'))).rejects.toThrow(
      'balanceAmount',
    );
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('rejects webhooks Toss cannot confirm', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    const { db, insertValues } = createDbStub();
    const orders = createOrdersStub();
    const service = new PaymentsService(db, orders as any);

    await expect(service.handleTossWebhook(webhook('DONE'))).rejects.toThrow('verification failed');

    expect(orders.markPaid).not.toHaveBeenCalled();
    expect(orders.markCancelled).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('runs the done payment insert and order settlement in ONE transaction', async () => {
    fetchMock.mockResolvedValue(tossResponse('DONE'));
    const { db, transaction, insertValues } = createDbStub();
    const orders = createOrdersStub('pending');
    const service = new PaymentsService(db, orders as any);

    await service.handleTossWebhook(webhook('DONE'));

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledTimes(1);
    expect(orders.settleOrderPaid).toHaveBeenCalledTimes(1);
  });

  it('acknowledges a redelivered DONE for an order already settled as paid', async () => {
    fetchMock.mockResolvedValue(tossResponse('DONE'));
    const { db, transaction, insertValues } = createDbStub();
    const orders = createOrdersStub('paid');
    const service = new PaymentsService(db, orders as any);

    await expect(service.handleTossWebhook(webhook('DONE'))).resolves.toBeUndefined();

    expect(transaction).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
    expect(orders.settleOrderPaid).not.toHaveBeenCalled();
  });

  it('acknowledges DONE arriving after EXPIRED settled the order instead of retry-looping Toss', async () => {
    fetchMock.mockResolvedValue(tossResponse('DONE'));
    const { db, transaction, insertValues } = createDbStub();
    const orders = createOrdersStub('canceled');
    const service = new PaymentsService(db, orders as any);

    await expect(service.handleTossWebhook(webhook('DONE'))).resolves.toBeUndefined();

    expect(transaction).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
    expect(orders.settleOrderPaid).not.toHaveBeenCalled();
  });

  it('propagates a settlement failure so DONE rolls back instead of half-committing', async () => {
    fetchMock.mockResolvedValue(tossResponse('DONE'));
    const { db, transaction, insertValues } = createDbStub();
    const orders = createOrdersStub('pending');
    orders.settleOrderPaid.mockRejectedValue(new Error('expired ad contract'));
    const service = new PaymentsService(db, orders as any);

    await expect(service.handleTossWebhook(webhook('DONE'))).rejects.toThrow('expired ad contract');
    expect(transaction).toHaveBeenCalledTimes(1);
    // The payment write was attempted inside the same (rolled-back) transaction.
    expect(insertValues).toHaveBeenCalledTimes(1);
  });

  it('refunds via Toss when DONE cannot settle the order (e.g. ad contract ended)', async () => {
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(tossResponse('DONE'))
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const { db } = createDbStub();
    const orders = createOrdersStub('pending');
    orders.settleOrderPaid.mockRejectedValue(new ConflictException('종료된 광고'));
    const service = new PaymentsService(db, orders as any);

    // Refunded + recorded locally → acked, so Toss does not redeliver forever.
    await expect(service.handleTossWebhook(webhook('DONE'))).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe('https://api.tosspayments.com/v1/payments/pay-key-1/cancel');
    expect(init.method).toBe('POST');
    expect(init.headers['Idempotency-Key']).toBe('cancel:order-1');
    expect(orders.cancelOrder).toHaveBeenCalledWith(expect.anything(), 'order-1');
  });

  it('records refund_pending and rethrows when the compensating cancel fails', async () => {
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(tossResponse('DONE'))
      .mockResolvedValueOnce({ ok: false, status: 500 });
    const { db, insertValues } = createDbStub();
    const orders = createOrdersStub('pending');
    orders.settleOrderPaid.mockRejectedValue(new ConflictException('종료된 광고'));
    const service = new PaymentsService(db, orders as any);

    await expect(service.handleTossWebhook(webhook('DONE'))).rejects.toThrow('종료된 광고');

    expect(insertValues).toHaveBeenLastCalledWith(
      expect.objectContaining({ orderId: 'order-1', status: 'refund_pending' }),
    );
    expect(orders.cancelOrder).not.toHaveBeenCalled();
  });

  it('acks a DONE redelivery once the payment was refunded and the order canceled', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(tossResponse('CANCELED'));
    const { db, transaction } = createDbStub();
    const orders = createOrdersStub('canceled');
    const service = new PaymentsService(db, orders as any);

    await expect(service.handleTossWebhook(webhook('DONE'))).resolves.toBeUndefined();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('does not refund on a transient settlement failure (a later webhook can settle it)', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(tossResponse('DONE'));
    const { db } = createDbStub();
    const orders = createOrdersStub('pending');
    orders.settleOrderPaid.mockRejectedValue(new Error('connection reset'));
    const service = new PaymentsService(db, orders as any);

    await expect(service.handleTossWebhook(webhook('DONE'))).rejects.toThrow('connection reset');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('propagates a cancellation failure so CANCELED rolls back instead of half-committing', async () => {
    fetchMock.mockResolvedValue(tossResponse('CANCELED'));
    const { db, transaction, insertValues } = createDbStub();
    const orders = createOrdersStub('pending');
    orders.cancelOrder.mockRejectedValue(new Error('uncancelable order'));
    const service = new PaymentsService(db, orders as any);

    await expect(service.handleTossWebhook(webhook('CANCELED'))).rejects.toThrow(
      'uncancelable order',
    );
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledTimes(1);
  });

  it('still rejects an unverified DONE even when the order is already settled', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'DONE',
        orderId: 'order-1',
        paymentKey: 'pay-key-1',
        totalAmount: 99999, // mismatches the order amount
      }),
    });
    const { db, transaction, insertValues } = createDbStub();
    const orders = createOrdersStub('paid');
    const service = new PaymentsService(db, orders as any);

    await expect(service.handleTossWebhook(webhook('DONE'))).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
    expect(orders.settleOrderPaid).not.toHaveBeenCalled();
  });

  it('conflict-proofs DONE re-delivery instead of select-then-insert', async () => {
    fetchMock.mockResolvedValue(tossResponse('DONE'));
    const { db, insertValues, onConflictDoUpdate } = createDbStub();
    const service = new PaymentsService(db, createOrdersStub() as any);

    await service.handleTossWebhook(webhook('DONE'));

    expect(insertValues).toHaveBeenCalledTimes(1);
    expect(onConflictDoUpdate).not.toHaveBeenCalled();
  });

  it('marks the order cancelled and upserts a canceled payment for CANCELED', async () => {
    fetchMock.mockResolvedValue(tossResponse('CANCELED'));
    const { db, insertValues, onConflictDoUpdate } = createDbStub();
    const orders = createOrdersStub();
    const service = new PaymentsService(db, orders as any);

    await service.handleTossWebhook(webhook('CANCELED'));

    expect(orders.cancelOrder).toHaveBeenCalledWith(expect.anything(), 'order-1');
    expect(orders.markCancelled).not.toHaveBeenCalled();
    expect(orders.markPaid).not.toHaveBeenCalled();
    expect(orders.settleOrderPaid).not.toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1', status: 'canceled' }),
    );
    expect(onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        set: { status: 'canceled' },
        setWhere: expect.anything(),
      }),
    );
  });

  it('runs the canceled payment upsert and order cancellation in ONE transaction', async () => {
    fetchMock.mockResolvedValue(tossResponse('CANCELED'));
    const { db, transaction, insertValues } = createDbStub();
    const orders = createOrdersStub('pending');
    const service = new PaymentsService(db, orders as any);

    await service.handleTossWebhook(webhook('CANCELED'));

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledTimes(1);
    expect(orders.cancelOrder).toHaveBeenCalledTimes(1);
  });

  it('upsert shape for CANCELED leaves already-canceled rows untouched', async () => {
    fetchMock.mockResolvedValue(tossResponse('CANCELED'));
    const { db, onConflictDoUpdate } = createDbStub();
    const orders = createOrdersStub();
    const service = new PaymentsService(db, orders as any);

    await service.handleTossWebhook(webhook('CANCELED'));

    expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
    const [{ set, setWhere }] = onConflictDoUpdate.mock.calls[0]!;
    expect(set).toEqual({ status: 'canceled' });
    expect(setWhere).toBeDefined();
  });

  it('cancels a pending order and upserts an expired payment for EXPIRED', async () => {
    fetchMock.mockResolvedValue(tossResponse('EXPIRED'));
    const { db, insertValues, onConflictDoUpdate } = createDbStub();
    const orders = createOrdersStub('pending');
    const service = new PaymentsService(db, orders as any);

    await service.handleTossWebhook(webhook('EXPIRED'));

    expect(orders.cancelOrder).toHaveBeenCalledWith(expect.anything(), 'order-1', ['pending']);
    expect(orders.markCancelled).not.toHaveBeenCalled();
    expect(orders.markPaid).not.toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        providerPaymentKey: 'pay-key-1',
        amount: 50000,
        status: 'expired',
      }),
    );
    // EXPIRED upgrades everything except an already 'expired' or 'canceled' row.
    expect(onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ set: { status: 'expired' }, setWhere: expect.anything() }),
    );
  });

  it('runs the expired payment upsert and order cancellation in ONE transaction', async () => {
    fetchMock.mockResolvedValue(tossResponse('EXPIRED'));
    const { db, transaction, insertValues } = createDbStub();
    const orders = createOrdersStub('pending');
    const service = new PaymentsService(db, orders as any);

    await service.handleTossWebhook(webhook('EXPIRED'));

    expect(transaction).toHaveBeenCalledTimes(1);
    // Both operations ran inside the transaction callback.
    expect(insertValues).toHaveBeenCalledTimes(1);
    expect(orders.cancelOrder).toHaveBeenCalledTimes(1);
  });

  it('is conflict-safe when duplicate EXPIRED webhooks are delivered concurrently', async () => {
    fetchMock.mockResolvedValue(tossResponse('EXPIRED'));
    const { db, insertValues, onConflictDoUpdate } = createDbStub();
    const service = new PaymentsService(db, createOrdersStub('pending') as any);

    await Promise.all([
      service.handleTossWebhook(webhook('EXPIRED')),
      service.handleTossWebhook(webhook('EXPIRED')),
    ]);

    // Both deliveries go through the same atomic upsert on payments.orderId;
    // no select-then-insert, so the second conflicts instead of duplicating.
    expect(insertValues).toHaveBeenCalledTimes(2);
    expect(onConflictDoUpdate).toHaveBeenCalledTimes(2);
    expect(onConflictDoUpdate.mock.calls.every(([arg]: any[]) => arg.target !== undefined)).toBe(
      true,
    );
  });

  it('ignores an EXPIRED webhook for an order a DONE webhook already settled', async () => {
    fetchMock.mockResolvedValue(tossResponse('EXPIRED'));
    const { db, insertValues, transaction } = createDbStub();
    const orders = createOrdersStub('paid');
    const service = new PaymentsService(db, orders as any);

    await service.handleTossWebhook(webhook('EXPIRED'));

    expect(orders.cancelOrder).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('does not verify with Toss or change state for WAITING_FOR_DEPOSIT', async () => {
    const { db, insertValues } = createDbStub();
    const orders = createOrdersStub();
    const service = new PaymentsService(db, orders as any);
    const fetchCallsBefore = fetchMock.mock.calls.length;

    await service.handleTossWebhook(webhook('WAITING_FOR_DEPOSIT'));

    expect(fetchMock.mock.calls.length).toBe(fetchCallsBefore);
    expect(orders.markPaid).not.toHaveBeenCalled();
    expect(orders.markCancelled).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
  });

  describe('confirmPayment', () => {
    const confirmDto = { orderId: 'order-1', paymentKey: 'pay-key-1', amount: 50000 };

    it('confirms with Toss and settles the order in ONE transaction', async () => {
      fetchMock.mockResolvedValue(tossResponse('DONE'));
      const { db, tx, transaction, insertValues } = createDbStub();
      const orders = {
        ...createOrdersStub('pending'),
        findById: vi
          .fn()
          .mockResolvedValue({ id: 'order-1', amount: 50000, status: 'pending', userId: 'user-1' }),
      };
      const service = new PaymentsService(db, orders as any);

      await service.confirmPayment('user-1', confirmDto);

      expect(transaction).toHaveBeenCalledTimes(1);
      expect(orders.settleOrderPaid).toHaveBeenCalledWith(tx, 'order-1');
      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order-1',
          providerPaymentKey: 'pay-key-1',
          amount: 50000,
          status: 'paid',
          approvedAt: expect.any(Date),
        }),
      );
    });

    it('refunds via Toss and rethrows when the order cannot be settled after approval', async () => {
      fetchMock.mockReset();
      fetchMock
        .mockResolvedValueOnce(tossResponse('DONE'))
        .mockResolvedValueOnce({ ok: true, status: 200 });
      const { db } = createDbStub();
      const orders = {
        ...createOrdersStub('pending'),
        findById: vi
          .fn()
          .mockResolvedValue({ id: 'order-1', amount: 50000, status: 'pending', userId: 'user-1' }),
      };
      orders.settleOrderPaid.mockRejectedValue(new ConflictException('결제할 수 없는 주문입니다.'));
      const service = new PaymentsService(db, orders as any);

      await expect(service.confirmPayment('user-1', confirmDto)).rejects.toThrow(
        '결제할 수 없는 주문입니다.',
      );

      expect(fetchMock.mock.calls[0]![1].headers['Idempotency-Key']).toBe('confirm:order-1');
      expect(fetchMock.mock.calls[1]![0]).toContain('/pay-key-1/cancel');
    });

    it('converges on the recorded Toss payment when the confirm was already processed', async () => {
      fetchMock.mockReset();
      fetchMock
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ code: 'ALREADY_PROCESSED_PAYMENT' }),
        })
        .mockResolvedValueOnce(tossResponse('DONE'));
      const { db, transaction } = createDbStub();
      const orders = {
        ...createOrdersStub('pending'),
        findById: vi
          .fn()
          .mockResolvedValue({ id: 'order-1', amount: 50000, status: 'pending', userId: 'user-1' }),
      };
      const service = new PaymentsService(db, orders as any);

      await service.confirmPayment('user-1', confirmDto);

      expect(fetchMock.mock.calls[1]![0]).toBe(
        'https://api.tosspayments.com/v1/payments/pay-key-1',
      );
      expect(transaction).toHaveBeenCalledTimes(1);
    });

    it('rejects a confirm whose amount does not match the order before calling Toss', async () => {
      const { db, insertValues } = createDbStub();
      const orders = {
        ...createOrdersStub('pending'),
        findById: vi
          .fn()
          .mockResolvedValue({ id: 'order-1', amount: 50000, status: 'pending', userId: 'user-1' }),
      };
      const service = new PaymentsService(db, orders as any);
      const fetchCallsBefore = fetchMock.mock.calls.length;

      await expect(
        service.confirmPayment('user-1', { ...confirmDto, amount: 99999 }),
      ).rejects.toThrow('결제 금액이 주문 금액과 일치하지 않습니다');

      expect(fetchMock.mock.calls.length).toBe(fetchCallsBefore);
      expect(insertValues).not.toHaveBeenCalled();
    });

    it('is idempotent for an order already settled as paid (no Toss re-call)', async () => {
      const { db, transaction, insertValues } = createDbStub();
      const orders = {
        ...createOrdersStub('paid'),
        findById: vi
          .fn()
          .mockResolvedValue({ id: 'order-1', amount: 50000, status: 'paid', userId: 'user-1' }),
      };
      const service = new PaymentsService(db, orders as any);
      const fetchCallsBefore = fetchMock.mock.calls.length;

      await expect(service.confirmPayment('user-1', confirmDto)).resolves.toEqual(
        expect.objectContaining({ id: 'order-1', status: 'paid' }),
      );

      expect(fetchMock.mock.calls.length).toBe(fetchCallsBefore);
      expect(transaction).not.toHaveBeenCalled();
      expect(insertValues).not.toHaveBeenCalled();
    });

    it('rejects when Toss does not confirm the payment', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 400 });
      const { db, insertValues } = createDbStub();
      const orders = {
        ...createOrdersStub('pending'),
        findById: vi
          .fn()
          .mockResolvedValue({ id: 'order-1', amount: 50000, status: 'pending', userId: 'user-1' }),
      };
      const service = new PaymentsService(db, orders as any);

      await expect(service.confirmPayment('user-1', confirmDto)).rejects.toThrow(
        '결제 승인에 실패했습니다',
      );
      expect(insertValues).not.toHaveBeenCalled();
    });
  });

  /**
   * Compensation driven by the REAL OrdersService: settleOrderPaid rejects a
   * reservation whose payment TTL expired, so both the DONE webhook and the
   * confirm path must auto-cancel the Toss payment instead of settling.
   */
  describe('expired ad reservation TTL (real OrdersService)', () => {
    const confirmDto = { orderId: 'order-1', paymentKey: 'pay-key-1', amount: 50000 };
    const pendingOrder = {
      id: 'order-1',
      amount: 50000,
      status: 'pending',
      adId: 'ad-1',
      userId: 'user-1',
    };
    const ttlExpiredAd = {
      id: 'ad-1',
      status: 'preparing',
      endDate: '2099-01-01',
      expiresAt: new Date(Date.now() - 1),
    };

    /**
     * One drizzle stub shared by both services: payments insert chains plus
     * orders select/update chains, with transaction(cb) running cb against
     * the stub itself so settleOrderPaid sees the same tx.
     */
    function createCombinedDbStub(opts: {
      order: Record<string, unknown>;
      ad: Record<string, unknown>;
    }) {
      const insertValues = vi.fn(() => ({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      }));
      const insert = vi.fn(() => ({ values: insertValues }));

      const orderForUpdate = vi.fn().mockResolvedValue([opts.order]);
      const orderLimit = vi.fn().mockResolvedValue([opts.order]);
      const adForUpdate = vi.fn().mockResolvedValue([opts.ad]);
      const selectFrom = vi.fn((table: unknown) => ({
        where: vi.fn().mockReturnValue({
          for: table === ads ? adForUpdate : orderForUpdate,
          limit: orderLimit,
        }),
      }));
      const select = vi.fn(() => ({ from: selectFrom }));

      const ordersUpdateSet = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...opts.order, status: 'paid' }]),
        }),
      });
      const adsUpdateSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const update = vi.fn((table: unknown) => ({
        set: table === ads ? adsUpdateSet : ordersUpdateSet,
      }));

      const db: any = { insert, select, update };
      db.transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db));
      return { db, insertValues, ordersUpdateSet, adsUpdateSet, orderLimit };
    }

    function createService(opts: { order: Record<string, unknown>; ad: Record<string, unknown> }) {
      const { db, insertValues, ordersUpdateSet, adsUpdateSet, orderLimit } =
        createCombinedDbStub(opts);
      const service = new PaymentsService(db, new OrdersService(db));
      return { service, db, insertValues, ordersUpdateSet, adsUpdateSet, orderLimit };
    }

    it('DONE webhook: TTL-expired reservation is not settled and Toss cancel compensates', async () => {
      fetchMock.mockReset();
      fetchMock
        .mockResolvedValueOnce(tossResponse('DONE'))
        .mockResolvedValueOnce({ ok: true, status: 200 });
      const { service, insertValues, ordersUpdateSet, adsUpdateSet } = createService({
        order: pendingOrder,
        ad: ttlExpiredAd,
      });

      // Refunded + recorded locally → acked, so Toss does not redeliver forever.
      await expect(service.handleTossWebhook(webhook('DONE'))).resolves.toBeUndefined();

      const [cancelUrl, cancelInit] = fetchMock.mock.calls[1]!;
      expect(cancelUrl).toBe('https://api.tosspayments.com/v1/payments/pay-key-1/cancel');
      expect(cancelInit.method).toBe('POST');
      expect(cancelInit.headers['Idempotency-Key']).toBe('cancel:order-1');
      // Never paid, never activated: the only order write is the compensation
      // cancellation; the refund is recorded as 'canceled'.
      expect(ordersUpdateSet).toHaveBeenCalledTimes(1);
      expect(ordersUpdateSet).toHaveBeenCalledWith({ status: 'canceled' });
      expect(ordersUpdateSet).not.toHaveBeenCalledWith({ status: 'paid' });
      expect(adsUpdateSet).not.toHaveBeenCalled();
      expect(insertValues).toHaveBeenLastCalledWith(
        expect.objectContaining({ orderId: 'order-1', status: 'canceled' }),
      );
    });

    it('DONE webhook: redelivery after the TTL refund is idempotently acked', async () => {
      fetchMock.mockReset();
      fetchMock
        .mockResolvedValueOnce(tossResponse('DONE'))
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce(tossResponse('CANCELED'));
      const { service, insertValues, ordersUpdateSet, orderLimit } = createService({
        order: pendingOrder,
        ad: ttlExpiredAd,
      });

      await service.handleTossWebhook(webhook('DONE'));

      // Locally the order is now canceled (via the compensation path), and
      // Toss reports the payment as CANCELED on the redelivered verification.
      orderLimit.mockResolvedValue([{ ...pendingOrder, status: 'canceled' }]);
      await expect(service.handleTossWebhook(webhook('DONE'))).resolves.toBeUndefined();

      // Exactly one compensating cancel across both deliveries, and no
      // further payment writes after the refund record.
      const cancelCalls = fetchMock.mock.calls.filter(
        (call) => (call[1] as RequestInit | undefined)?.method === 'POST',
      );
      expect(cancelCalls).toHaveLength(1);
      expect(insertValues).toHaveBeenCalledTimes(2); // paid attempt + canceled record
      expect(ordersUpdateSet).toHaveBeenCalledWith({ status: 'canceled' });
    });

    it('settles normally while the TTL is still valid', async () => {
      fetchMock.mockReset();
      fetchMock.mockResolvedValue(tossResponse('DONE'));
      const { service, ordersUpdateSet, adsUpdateSet } = createService({
        order: pendingOrder,
        ad: { ...ttlExpiredAd, expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
      });

      await expect(service.handleTossWebhook(webhook('DONE'))).resolves.toBeUndefined();

      expect(ordersUpdateSet).toHaveBeenCalledWith({ status: 'paid' });
      expect(ordersUpdateSet).not.toHaveBeenCalledWith({ status: 'canceled' });
      expect(adsUpdateSet).toHaveBeenCalledWith({ status: 'active' });
    });

    it('confirm path: TTL-expired reservation is rejected after approval and refunded', async () => {
      fetchMock.mockReset();
      fetchMock
        .mockResolvedValueOnce(tossResponse('DONE'))
        .mockResolvedValueOnce({ ok: true, status: 200 });
      const { service, insertValues, ordersUpdateSet, adsUpdateSet } = createService({
        order: pendingOrder,
        ad: ttlExpiredAd,
      });

      await expect(service.confirmPayment('user-1', confirmDto)).rejects.toThrow(
        '결제 마감 시간이 지난 광고 예약입니다.',
      );

      expect(fetchMock.mock.calls[1]![0]).toBe(
        'https://api.tosspayments.com/v1/payments/pay-key-1/cancel',
      );
      expect(ordersUpdateSet).not.toHaveBeenCalledWith({ status: 'paid' });
      expect(ordersUpdateSet).toHaveBeenCalledWith({ status: 'canceled' });
      expect(adsUpdateSet).not.toHaveBeenCalled();
      expect(insertValues).toHaveBeenLastCalledWith(
        expect.objectContaining({ orderId: 'order-1', status: 'canceled' }),
      );
    });
  });
});

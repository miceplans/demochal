import { describe, expect, it, vi } from 'vitest';
import { PaymentsService } from './payments.service.js';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

/**
 * Drizzle stub. insert().values() returns the conflict handlers the service
 * chains onto every payment write (unique on payments.orderId). `select()` is
 * the tx-scoped `SELECT ... FOR UPDATE` handleDone() runs to detect an order
 * that a concurrent/out-of-order EXPIRED already moved to a terminal state;
 * `currentOrderStatus` controls what that read returns.
 */
function createDbStub(currentOrderStatus: string = 'pending') {
  const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const insertValues = vi.fn(() => ({ onConflictDoNothing, onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values: insertValues }));
  const selectFor = vi.fn().mockResolvedValue([{ id: 'order-1', status: currentOrderStatus }]);
  const selectWhere = vi.fn(() => ({ for: selectFor }));
  const selectFrom = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from: selectFrom }));
  const transaction = vi.fn(async (fn: (tx: any) => Promise<void>) => fn({ insert, select }));
  const db: any = { insert, select, transaction };
  return { db, insertValues, onConflictDoNothing, onConflictDoUpdate, transaction, select };
}

function createOrdersStub(orderStatus: string = 'pending') {
  return {
    findByIdInternal: vi
      .fn()
      .mockResolvedValue({ id: 'order-1', amount: 50000, status: orderStatus }),
    markPaid: vi.fn().mockResolvedValue({}),
    markCancelled: vi.fn().mockResolvedValue({}),
    payOrder: vi.fn().mockResolvedValue({}),
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

describe('PaymentsService', () => {
  it('marks the order paid and persists a done payment for DONE', async () => {
    fetchMock.mockResolvedValue(tossResponse('DONE'));
    const { db, insertValues, onConflictDoNothing, onConflictDoUpdate } = createDbStub();
    const orders = createOrdersStub();
    const service = new PaymentsService(db, orders as any);

    await service.handleTossWebhook(webhook('DONE'));

    expect(orders.payOrder).toHaveBeenCalledWith(expect.anything(), 'order-1');
    expect(orders.cancelOrder).not.toHaveBeenCalled();
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

  it('runs the done payment upsert and order transition in ONE transaction', async () => {
    fetchMock.mockResolvedValue(tossResponse('DONE'));
    const { db, transaction, insertValues } = createDbStub();
    const orders = createOrdersStub();
    const service = new PaymentsService(db, orders as any);

    await service.handleTossWebhook(webhook('DONE'));

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledTimes(1);
    expect(orders.payOrder).toHaveBeenCalledTimes(1);
  });

  it('records a DONE payment without reopening an order an earlier EXPIRED already canceled', async () => {
    fetchMock.mockResolvedValue(tossResponse('DONE'));
    // A repayment's DONE can arrive after a different payment attempt's
    // (out-of-order/delayed) EXPIRED already canceled this order.
    const { db, insertValues } = createDbStub('canceled');
    const orders = createOrdersStub();
    const service = new PaymentsService(db, orders as any);

    await expect(service.handleTossWebhook(webhook('DONE'))).resolves.toBeUndefined();

    // The payment is still recorded for audit ...
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1', status: 'paid' }),
    );
    // ... but the terminally canceled order is never reopened, and Toss gets
    // a 200 instead of retrying this webhook forever.
    expect(orders.payOrder).not.toHaveBeenCalled();
  });

  it('ignores other non-actionable webhook events (e.g. ABORTED)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ABORTED', amount: 50000 }),
    });
    const { db, insertValues } = createDbStub();
    const orders = createOrdersStub();
    const service = new PaymentsService(db, orders as any);

    await service.handleTossWebhook(webhook('ABORTED'));

    expect(orders.markCancelled).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('reconciles PARTIAL_CANCELED by persisting the Toss-reported refunded amount', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'PARTIAL_CANCELED',
        orderId: 'order-1',
        paymentKey: 'pay-key-1',
        totalAmount: 50000,
        balanceAmount: 30000,
      }),
    });
    const { db, insertValues, onConflictDoUpdate } = createDbStub();
    const orders = createOrdersStub();
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
    expect(orders.cancelOrder).not.toHaveBeenCalled();
    expect(orders.payOrder).not.toHaveBeenCalled();
  });

  it('is idempotent across redelivered PARTIAL_CANCELED webhooks (sets, never increments)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'PARTIAL_CANCELED',
        orderId: 'order-1',
        paymentKey: 'pay-key-1',
        totalAmount: 50000,
        balanceAmount: 30000,
      }),
    });
    const { db, onConflictDoUpdate } = createDbStub();
    const service = new PaymentsService(db, createOrdersStub() as any);

    await service.handleTossWebhook(webhook('PARTIAL_CANCELED'));
    await service.handleTossWebhook(webhook('PARTIAL_CANCELED'));

    expect(onConflictDoUpdate).toHaveBeenCalledTimes(2);
    for (const [arg] of onConflictDoUpdate.mock.calls as any[]) {
      expect(arg).toEqual(expect.objectContaining({ set: { refundedAmount: 20000 } }));
    }
  });

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

    expect(orders.payOrder).not.toHaveBeenCalled();
    expect(orders.cancelOrder).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
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
    expect(orders.payOrder).not.toHaveBeenCalled();
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
    const orders = createOrdersStub();
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
    expect(orders.payOrder).not.toHaveBeenCalled();
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
    expect(orders.payOrder).not.toHaveBeenCalled();
    expect(orders.cancelOrder).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
  });
});

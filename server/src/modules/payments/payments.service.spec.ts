import { describe, expect, it, vi } from 'vitest';
import { PaymentsService } from './payments.service.js';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

/**
 * Drizzle stub. insert().values() returns the conflict handlers the service
 * chains onto every payment write (unique on payments.orderId).
 */
function createDbStub() {
  const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const insertValues = vi.fn(() => ({ onConflictDoNothing, onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values: insertValues }));
  const tx = { insert };
  const transaction = vi.fn(async (fn: (txArg: unknown) => Promise<void>) => fn(tx));
  const db: any = { insert, transaction };
  return { db, tx, insertValues, onConflictDoNothing, onConflictDoUpdate, transaction };
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
    expect(orders.markCancelled).not.toHaveBeenCalled();
    expect(orders.markPaid).not.toHaveBeenCalled();
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
});

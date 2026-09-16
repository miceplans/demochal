import { describe, expect, it, vi } from 'vitest';
import { PaymentsService } from './payments.service.js';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

/** Chainable drizzle stub: select().from().where().limit() / insert().values() */
function createDbStub(existingPayment?: { id: string }) {
  const insertValues = vi.fn().mockResolvedValue(undefined);
  const limit = vi.fn().mockResolvedValue(existingPayment ? [existingPayment] : []);
  const selectStub: any = {
    from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit }) }),
  };
  const insertStub: any = { values: insertValues };
  const db: any = { select: vi.fn(() => selectStub), insert: vi.fn(() => insertStub) };
  return { db, insertValues, limit };
}

function createOrdersStub() {
  return {
    findByIdInternal: vi.fn().mockResolvedValue({ id: 'order-1', amount: 50000 }),
    markPaid: vi.fn().mockResolvedValue({}),
    markCancelled: vi.fn().mockResolvedValue({}),
  };
}

const webhook = (status: string) => ({
  eventType: `PAYMENT_${status}`,
  data: { paymentKey: 'pay-key-1', orderId: 'order-1', status },
});

describe('PaymentsService', () => {
  it('marks the order paid and persists a done payment for DONE', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'DONE', orderId: 'order-1', paymentKey: 'pay-key-1', totalAmount: 50000 }),
    });
    const { db, insertValues } = createDbStub();
    const orders = createOrdersStub();
    const service = new PaymentsService(db, orders as any);

    await service.handleTossWebhook(webhook('DONE'));

    expect(orders.markPaid).toHaveBeenCalledWith('order-1');
    expect(orders.markCancelled).not.toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        providerPaymentKey: 'pay-key-1',
        amount: 50000,
        status: 'paid',
      }),
    );
  });

  it('ignores non-DONE webhook events', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'PARTIAL_CANCELED', amount: 50000 }),
    });
    const { db, insertValues } = createDbStub();
    const orders = createOrdersStub();
    const service = new PaymentsService(db, orders as any);

    await service.handleTossWebhook(webhook('PARTIAL_CANCELED'));

    expect(orders.markCancelled).not.toHaveBeenCalled();
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

  it('does not duplicate an existing payment row', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: 'DONE', orderId: 'order-1', paymentKey: 'pay-key-1', totalAmount: 50000 }) });
    const { db, insertValues } = createDbStub({ id: 'payment-1' });
    const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    db.update = vi.fn().mockReturnValue({ set });
    const service = new PaymentsService(db, createOrdersStub() as any);

    await service.handleTossWebhook(webhook('DONE'));

    expect(insertValues).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
});

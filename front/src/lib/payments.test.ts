import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestPayment = vi.fn().mockResolvedValue(undefined);
vi.mock('@tosspayments/tosspayments-sdk', () => ({
  ANONYMOUS: 'ANONYMOUS',
  loadTossPayments: vi.fn().mockResolvedValue({ payment: () => ({ requestPayment }) }),
}));

const base = { orderId: 'order-1', amount: 50000, orderName: '챌린지 참가비' };

describe('requestTossPayment', () => {
  beforeEach(() => {
    vi.resetModules();
    requestPayment.mockClear();
    vi.stubEnv('NEXT_PUBLIC_TOSS_CLIENT_KEY', 'test_ck');
  });

  it('returns false without opening a window when the client key is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_TOSS_CLIENT_KEY', '');
    const { requestTossPayment } = await import('./payments');
    await expect(requestTossPayment(base)).resolves.toBe(false);
    expect(requestPayment).not.toHaveBeenCalled();
  });

  it('opens the card window by default', async () => {
    const { requestTossPayment } = await import('./payments');
    await requestTossPayment(base);
    expect(requestPayment).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'CARD', orderId: 'order-1' }),
    );
    expect(requestPayment.mock.calls[0]![0].card).toBeUndefined();
  });

  it.each(['TOSSPAY', 'KAKAOPAY', 'NAVERPAY'] as const)(
    'opens the %s app window directly via the card method',
    async (method) => {
      const { requestTossPayment } = await import('./payments');
      await requestTossPayment({ ...base, method });
      expect(requestPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'CARD',
          card: { flowMode: 'DIRECT', easyPay: method },
        }),
      );
    },
  );

  it('issues a virtual account with a 24h deposit window and no cash receipt', async () => {
    const { requestTossPayment } = await import('./payments');
    await requestTossPayment({ ...base, method: 'VIRTUAL_ACCOUNT', flow: 'ad' });
    expect(requestPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'VIRTUAL_ACCOUNT',
        virtualAccount: { cashReceipt: { type: '미발행' }, validHours: 24 },
        successUrl: expect.stringContaining('/payments/success?flow=ad'),
      }),
    );
  });
});

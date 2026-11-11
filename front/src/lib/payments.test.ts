import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestTossPayment } from './payments';

const mocks = vi.hoisted(() => ({
  requestPayment: vi.fn(),
  loadTossPayments: vi.fn(),
}));

vi.mock('@tosspayments/tosspayments-sdk', () => ({
  ANONYMOUS: 'ANONYMOUS',
  loadTossPayments: mocks.loadTossPayments,
}));

describe('requestTossPayment', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_TOSS_CLIENT_KEY', 'test-client-key');
    mocks.requestPayment.mockReset().mockResolvedValue(undefined);
    mocks.loadTossPayments.mockReset().mockResolvedValue({
      payment: () => ({ requestPayment: mocks.requestPayment }),
    });
  });

  it('광고 결제창을 현재 탭에서 열고 복귀 URL에 flow를 유지한다', async () => {
    await requestTossPayment({ orderId: 'order-1', amount: 100000, orderName: '광고', flow: 'ad' });

    expect(mocks.requestPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        windowTarget: 'self',
        method: 'CARD',
        orderId: 'order-1',
        successUrl: `${window.location.origin}/payments/success?flow=ad`,
        failUrl: `${window.location.origin}/payments/fail?flow=ad`,
      }),
    );
  });
});

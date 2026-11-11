import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestPayment, loadTossPayments } = vi.hoisted(() => ({
  requestPayment: vi.fn(),
  loadTossPayments: vi.fn(),
}));

vi.mock('@tosspayments/tosspayments-sdk', () => ({
  ANONYMOUS: '@@ANONYMOUS',
  loadTossPayments,
}));

import { CARD_COMPANIES_WITHOUT_BC, requestTossPayment } from './payments';

describe('requestTossPayment', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_TOSS_CLIENT_KEY', 'test_ck_example');
    requestPayment.mockReset();
    loadTossPayments.mockResolvedValue({ payment: () => ({ requestPayment }) });
  });

  it('excludes BC-family card company codes from the card window', async () => {
    await requestTossPayment({ orderId: 'order-1', amount: 1000, orderName: '광고' });

    expect(requestPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'CARD',
        card: { cardCompany: CARD_COMPANIES_WITHOUT_BC },
      }),
    );
    expect(CARD_COMPANIES_WITHOUT_BC).not.toMatch(/(^|\|)(3K|31|33)(\||$)/);
  });
});

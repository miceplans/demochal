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

describe('paymentProviderForHost', () => {
  it('uses Naver Pay only on the bz subdomain label', async () => {
    const { paymentProviderForHost } = await import('./payments');

    expect(paymentProviderForHost('bz.example.com')).toBe('naverpay');
    expect(paymentProviderForHost('BZ.example.com')).toBe('naverpay');
    expect(paymentProviderForHost('bz.example.com:443')).toBe('naverpay');
    expect(paymentProviderForHost('biz.example.com')).toBe('toss');
    expect(paymentProviderForHost('www.example.com')).toBe('toss');
    expect(paymentProviderForHost('bzexample.com')).toBe('toss');
    expect(paymentProviderForHost('localhost')).toBe('toss');
  });
});

describe('buildNaverPayPaymentParams', () => {
  it('carries the order id in the return URL and passes amount/tax fields', async () => {
    const { buildNaverPayPaymentParams } = await import('./payments');

    const params = buildNaverPayPaymentParams({
      orderId: 'order-1',
      amount: 15000,
      orderName: '광고',
      flow: 'ad',
      origin: 'https://bz.example.com',
    });

    expect(params.totalPayAmount).toBe(15000);
    expect(params.taxScopeAmount).toBe(15000);
    expect(params.taxExScopeAmount).toBe(0);
    expect(params.returnUrl).toBe(
      'https://bz.example.com/payments/success?orderId=order-1&flow=ad',
    );
    expect(params.callbackFunction).toBe('semochalNaverPayCallback');
    expect(params.isPopup).toBe(true);
    expect(params.productItems).toEqual([
      {
        categoryType: 'PRODUCT',
        categoryId: 'GENERAL',
        uid: 'order-1',
        name: '광고',
        count: 1,
        price: 15000,
      },
    ]);
  });
});

describe('requestNaverPayPayment', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns false without a client key, like the Toss flow', async () => {
    vi.stubEnv('NEXT_PUBLIC_NAVERPAY_CLIENT_ID', '');
    const { requestNaverPayPayment } = await import('./payments');

    await expect(
      requestNaverPayPayment({ orderId: 'order-1', amount: 1000, orderName: '광고' }),
    ).resolves.toBe(false);
    vi.unstubAllEnvs();
  });

  it('opens the Naver Pay window and converges the PC callback onto the success URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_NAVERPAY_CLIENT_ID', 'naver-client');
    const requestPayment = vi.fn();
    const create = vi.fn(() => ({ requestPayment }));
    (window as unknown as { Naver: unknown }).Naver = { Pay: { create } };

    const { requestNaverPayPayment, buildNaverPayCallbackUrl } = await import('./payments');
    await expect(
      requestNaverPayPayment({ orderId: 'order-9', amount: 3000, orderName: '광고', flow: 'ad' }),
    ).resolves.toBe(true);

    expect(create).toHaveBeenCalledWith({ mode: 'development', clientId: 'naver-client' });
    expect(requestPayment).toHaveBeenCalledWith(expect.objectContaining({ totalPayAmount: 3000 }));

    // PC 팝업 결과를 모바일 returnUrl과 동일한 success URL로 수렴시킨다(콜백 등록 확인).
    expect(window.semochalNaverPayCallback).toEqual(expect.any(Function));
    const calledUrl = buildNaverPayCallbackUrl({
      orderId: 'order-9',
      flow: 'ad',
      result: { resultCode: 'Success', paymentId: 'np-1' },
      origin: 'https://bz.example.com',
    });
    expect(calledUrl).toBe(
      'https://bz.example.com/payments/success?orderId=order-9&resultCode=Success&paymentId=np-1&flow=ad',
    );
    vi.unstubAllEnvs();
  });
});

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
  it('routes the bz subdomain label to the Naver Pay (KCP window) provider', async () => {
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

describe('requestBizPayment — bz (KCP window)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('opens the KCP Naver Pay window on the bz host', async () => {
    vi.stubEnv('NEXT_PUBLIC_BZ_SUBDOMAIN', 'bz');
    vi.stubEnv('NEXT_PUBLIC_KCP_SITE_CD', 'T0000');
    // PC 환경(모바일 UA 아님) — 허브 JS가 이미 로드된 것으로 간주해 폼·콜백 동선만 검증한다.
    const execute = vi.fn();
    (window as unknown as { KCP_Pay_Execute_Web: unknown }).KCP_Pay_Execute_Web = execute;
    // jsdom의 location 프로퍼티는 재정의가 불가능해 stubGlobal로 통째로 교체한다.
    vi.stubGlobal('location', { ...window.location, hostname: 'bz.example.com' });

    const { requestBizPayment } = await import('./payments');
    await expect(
      requestBizPayment({ orderId: 'order-1', amount: 1000, orderName: '광고' }),
    ).resolves.toBe(true);

    // KCP_Pay_Execute_Web에 네이버페이 단독 호출 폼이 전달됐는지 확인한다.
    const form = execute.mock.calls[0]?.[0] as HTMLFormElement;
    expect(form).toBeInstanceOf(HTMLFormElement);
    const field = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | null)?.value;
    expect(field('site_cd')).toBe('T0000');
    expect(field('pay_method')).toBe('100000000000');
    expect(field('naverpay_direct')).toBe('B');
    expect(field('ordr_idxx')).toBe('order-1');
    expect(field('good_mny')).toBe('1000');
    expect(field('good_name')).toBe('광고');
    expect(field('currency')).toBe('410');
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns false on the bz host without a KCP site code, like the Toss flow', async () => {
    vi.stubEnv('NEXT_PUBLIC_BZ_SUBDOMAIN', 'bz');
    vi.stubEnv('NEXT_PUBLIC_KCP_SITE_CD', '');
    vi.stubGlobal('location', { ...window.location, hostname: 'bz.example.com' });
    const { requestBizPayment } = await import('./payments');

    await expect(
      requestBizPayment({ orderId: 'order-1', amount: 1000, orderName: '광고' }),
    ).resolves.toBe(false);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});

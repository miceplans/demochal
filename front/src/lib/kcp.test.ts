import { beforeEach, describe, expect, it, vi } from 'vitest';

const { confirmKcp, registerKcp } = vi.hoisted(() => ({
  confirmKcp: vi.fn(),
  registerKcp: vi.fn(),
}));

vi.mock('@/lib/ad-api', () => ({
  adApi: { payments: { confirmKcp, registerKcp } },
}));

vi.mock('@/lib/api-error', () => ({
  apiErrorMessage: (_: unknown, fallback: string) => fallback,
}));

const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function fieldValue(form: HTMLFormElement, name: string): string | undefined {
  const field = form.elements.namedItem(name);
  return field && 'value' in field
    ? String((field as unknown as HTMLInputElement).value)
    : undefined;
}

async function importKcp() {
  return import('./kcp');
}

describe('isKcpMobileDevice', () => {
  it('detects mobile user agents the way the KCP window split requires', async () => {
    const { isKcpMobileDevice } = await importKcp();

    expect(isKcpMobileDevice(IPHONE_UA)).toBe(true);
    expect(isKcpMobileDevice('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36')).toBe(true);
    expect(isKcpMobileDevice(DESKTOP_UA)).toBe(false);
  });
});

describe('requestKcpNaverPayPayment — PC window', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    vi.stubEnv('NEXT_PUBLIC_KCP_SITE_CD', 'T0000');
    vi.stubEnv('NEXT_PUBLIC_KCP_SITE_NAME', '세모찰 테스트');
    (window as unknown as { KCP_Pay_Execute_Web: unknown }).KCP_Pay_Execute_Web = vi.fn();
    vi.stubGlobal('navigator', { userAgent: DESKTOP_UA });
  });

  it('returns false without a KCP site code, like the Toss flow', async () => {
    vi.stubEnv('NEXT_PUBLIC_KCP_SITE_CD', '');
    const { requestKcpNaverPayPayment } = await importKcp();

    await expect(
      requestKcpNaverPayPayment({ orderId: 'order-1', amount: 1000, orderName: '광고' }),
    ).resolves.toBe(false);
    vi.unstubAllEnvs();
  });

  it('confirms on the PC callback and converges onto the success URL', async () => {
    confirmKcp.mockResolvedValue({});
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const { requestKcpNaverPayPayment } = await importKcp();

    await expect(
      requestKcpNaverPayPayment({
        orderId: 'order-9',
        amount: 3000,
        orderName: '광고',
        flow: 'ad',
      }),
    ).resolves.toBe(true);

    const complete = window.m_Completepayment;
    expect(complete).toEqual(expect.any(Function));
    const closeEvent = vi.fn();
    complete?.(
      {
        res_cd: '0000',
        res_msg: '정상처리',
        enc_info: 'enc-i',
        enc_data: 'enc-d',
        tran_cd: '00100000',
      },
      closeEvent,
    );
    // 콜백은 동기적으로 결제창을 닫은 뒤 비동기 승인 → 성공 페이지 이동으로 이어진다.
    expect(closeEvent).toHaveBeenCalled();
    await vi.waitFor(() => expect(confirmKcp).toHaveBeenCalledTimes(1));
    expect(confirmKcp).toHaveBeenCalledWith({
      orderId: 'order-9',
      encData: 'enc-d',
      encInfo: 'enc-i',
      tranCd: '00100000',
    });
    await vi.waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    const successUrl = String(assign.mock.calls[0]?.[0]);
    expect(successUrl).toContain('/payments/success?');
    expect(successUrl).toContain('orderId=order-9');
    expect(successUrl).toContain('provider=kcp');
    expect(successUrl).toContain('flow=ad');
    vi.unstubAllGlobals();
  });

  it('redirects to the fail URL with the cancel code instead of confirming', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const { requestKcpNaverPayPayment } = await importKcp();
    await requestKcpNaverPayPayment({ orderId: 'order-9', amount: 3000, orderName: '광고' });

    window.m_Completepayment?.({ res_cd: '3001', res_msg: '사용자취소' }, vi.fn());

    await vi.waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    const failUrl = String(assign.mock.calls[0]?.[0]);
    expect(failUrl).toContain('/payments/fail?');
    expect(failUrl).toContain('orderId=order-9');
    expect(failUrl).toContain('code=3001');
    expect(confirmKcp).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('redirects to the fail URL when the server confirm rejects', async () => {
    confirmKcp.mockRejectedValue(new Error('network'));
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const { requestKcpNaverPayPayment } = await importKcp();
    await requestKcpNaverPayPayment({ orderId: 'order-9', amount: 3000, orderName: '광고' });

    window.m_Completepayment?.(
      { res_cd: '0000', enc_info: 'enc-i', enc_data: 'enc-d', tran_cd: '00100000' },
      vi.fn(),
    );

    await vi.waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    const failUrl = String(assign.mock.calls[0]?.[0]);
    expect(failUrl).toContain('/payments/fail?');
    expect(failUrl).toContain('code=confirm_failed');
    vi.unstubAllGlobals();
  });
});

describe('requestKcpNaverPayPayment — mobile window', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    vi.stubEnv('NEXT_PUBLIC_KCP_SITE_CD', 'T0000');
    vi.stubGlobal('navigator', { userAgent: IPHONE_UA });
  });

  it('registers the trade and submits the form to the KCP encoding filter', async () => {
    registerKcp.mockResolvedValue({
      approvalKey: 'approval-key',
      payUrl: 'https://testsmpay.kcp.co.kr/pay/mobileGW.kcp',
      retUrl: 'https://bz.example.com/payments/kcp/return',
    });
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
    const { requestKcpNaverPayPayment } = await importKcp();

    await expect(
      requestKcpNaverPayPayment({
        orderId: 'order-m',
        amount: 4500,
        orderName: '광고',
        flow: 'ad',
      }),
    ).resolves.toBe(true);

    expect(registerKcp).toHaveBeenCalledWith({
      orderId: 'order-m',
      orderName: '광고',
      flow: 'ad',
    });
    const form = document.querySelector<HTMLFormElement>('form[name="order_info"]');
    expect(form).not.toBeNull();
    // form.action 프로퍼티는 jsdom이 document base URL 기준으로 변환하므로 속성 원문을 검증한다.
    // 가이드 공식(PayUrl 마지막 '/' 앞 + 고정 경로)대로 /pay 디렉터리가 유지된다.
    expect(form?.getAttribute('action')).toBe(
      'https://testsmpay.kcp.co.kr/pay/jsp/encodingFilter/encodingFilter.jsp',
    );
    expect(fieldValue(form!, 'approval_key')).toBe('approval-key');
    expect(fieldValue(form!, 'PayUrl')).toBe('https://testsmpay.kcp.co.kr/pay/mobileGW.kcp');
    expect(fieldValue(form!, 'Ret_URL')).toBe('https://bz.example.com/payments/kcp/return');
    expect(fieldValue(form!, 'pay_method')).toBe('CARD');
    expect(fieldValue(form!, 'naverpay_direct')).toBe('B');
    expect(fieldValue(form!, 'encoding_trans')).toBe('UTF-8');
    expect(fieldValue(form!, 'ordr_idxx')).toBe('order-m');
    expect(fieldValue(form!, 'good_mny')).toBe('4500');
    expect(submit).toHaveBeenCalled();
    submit.mockRestore();
    vi.unstubAllGlobals();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { confirmKcpPayment, registerKcpTransaction } = vi.hoisted(() => ({
  confirmKcpPayment: vi.fn(),
  registerKcpTransaction: vi.fn(),
}));

// kcp.ts는 신규 엔드포인트를 orval 생성 클라이언트(공유 HttpClient 경유)로 호출한다 —
// generated 모듈의 해당 동작만 대역으로 교체하고 나머지는 실제 모듈을 쓴다.
vi.mock('@semochal/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@semochal/api-client')>();
  return {
    ...actual,
    generated: { ...actual.generated, confirmKcpPayment, registerKcpTransaction },
  };
});

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
    confirmKcpPayment.mockResolvedValue({});
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
    await vi.waitFor(() => expect(confirmKcpPayment).toHaveBeenCalledTimes(1));
    expect(confirmKcpPayment).toHaveBeenCalledWith({
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
    expect(confirmKcpPayment).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('redirects to the fail URL when the server confirm rejects', async () => {
    confirmKcpPayment.mockRejectedValue(new Error('network'));
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
    // orval 생성 함수는 { data, status, headers } 엔벨로프를 반환한다.
    registerKcpTransaction.mockResolvedValue({
      status: 200,
      data: {
        approvalKey: 'approval-key',
        payUrl: 'https://testsmpay.kcp.co.kr/pay/mobileGW.kcp',
        retUrl: 'https://bz.example.com/payments/kcp/return',
      },
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

    expect(registerKcpTransaction).toHaveBeenCalledWith({
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

describe('loadKcpHub — 허브 로더 대기', () => {
  beforeEach(() => {
    vi.resetModules();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    vi.stubEnv('NEXT_PUBLIC_KCP_SITE_CD', 'T0000');
    delete (window as unknown as { KCP_Pay_Execute_Web?: unknown }).KCP_Pay_Execute_Web;
    vi.stubGlobal('navigator', { userAgent: DESKTOP_UA });
  });

  it('허브 onload 이후 비동기로 정의되는 KCP_Pay_Execute_Web을 기다려 결제창을 연다', async () => {
    const { requestKcpNaverPayPayment } = await importKcp();
    const pending = requestKcpNaverPayPayment({
      orderId: 'order-hub',
      amount: 1000,
      orderName: '광고',
    });

    const script = document.head.querySelector('script');
    expect(script).not.toBeNull();
    // 실제 허브처럼 onload 시점에는 함수가 없고, 하위 스크립트가 나중에 정의한다.
    script!.dispatchEvent(new Event('load'));
    const execute = vi.fn();
    setTimeout(() => {
      (window as unknown as { KCP_Pay_Execute_Web: unknown }).KCP_Pay_Execute_Web = execute;
    }, 120);

    await expect(pending).resolves.toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('허브 로드 실패를 캐시하지 않아 다음 시도에서 다시 로드한다', async () => {
    const { requestKcpNaverPayPayment } = await importKcp();
    const first = requestKcpNaverPayPayment({ orderId: 'o1', amount: 1000, orderName: '광고' });
    document.head.querySelector('script')!.dispatchEvent(new Event('error'));
    await expect(first).resolves.toBe(false);

    const second = requestKcpNaverPayPayment({ orderId: 'o2', amount: 1000, orderName: '광고' });
    const script = document.head.querySelector('script');
    expect(script).not.toBeNull();
    const execute = vi.fn();
    (window as unknown as { KCP_Pay_Execute_Web: unknown }).KCP_Pay_Execute_Web = execute;
    script!.dispatchEvent(new Event('load'));
    await expect(second).resolves.toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});

describe('kcpHubUrl', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('운영 빌드라도 테스트 사이트코드(T0000)면 테스트 결제창을 쓴다', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_KCP_SITE_CD', 'T0000');
    const { kcpHubUrl } = await importKcp();
    expect(kcpHubUrl()).toBe('https://testspay.kcp.co.kr/plugin/kcp_spay_hub.js');
  });

  it('운영 빌드 + 계약 사이트코드면 운영 결제창을 쓴다', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_KCP_SITE_CD', 'A1B2C');
    const { kcpHubUrl } = await importKcp();
    expect(kcpHubUrl()).toBe('https://spay.kcp.co.kr/plugin/kcp_spay_hub.js');
  });

  it('NEXT_PUBLIC_KCP_JS_URL이 있으면 그 값을 우선한다', async () => {
    vi.stubEnv('NEXT_PUBLIC_KCP_JS_URL', 'https://example.test/hub.js');
    vi.stubEnv('NEXT_PUBLIC_KCP_SITE_CD', 'T0000');
    const { kcpHubUrl } = await importKcp();
    expect(kcpHubUrl()).toBe('https://example.test/hub.js');
  });
});

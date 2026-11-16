import { afterEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// env는 import 시점에 process.env를 파싱하므로 자격증명을 주입한 뒤 모듈을 새로 불러온다.
async function loadClient(vars: Record<string, string> = {}) {
  vi.resetModules();
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
  return import('./naverpay.client.js');
}

const CONFIGURED = {
  NAVERPAY_CLIENT_ID: 'np-client',
  NAVERPAY_CLIENT_SECRET: 'np-secret',
  NAVERPAY_CHAIN_ID: 'np-chain',
};

describe('naverpay.client', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    fetchMock.mockReset();
  });

  it('blocks with a gateway error when credentials are not configured', async () => {
    const client = await loadClient();
    await expect(client.fetchNaverPayPaymentDetail('np-1')).rejects.toThrow('구성되지 않았습니다');
    await expect(
      client.cancelNaverPayPayment({
        paymentId: 'np-1',
        orderId: 'order-1',
        cancelAmount: 50000,
        cancelReason: 'x',
      }),
    ).rejects.toThrow('구성되지 않았습니다');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches payment history with the merchant headers and parses the detail', async () => {
    const client = await loadClient(CONFIGURED);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: 'Success',
        body: { detail: { paymentId: 'np-1', paymentStatus: 'COMPLETED', totalPayAmount: 50000 } },
      }),
    });

    const detail = await client.fetchNaverPayPaymentDetail('np-1');

    expect(detail.paymentStatus).toBe('COMPLETED');
    expect(detail.totalPayAmount).toBe(50000);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      'https://apis.naver.com/npay/nnpay/payment/v2.2/getPaymentHistory?paymentId=np-1',
    );
    expect(init.headers).toMatchObject({
      'X-Naver-Client-Id': 'np-client',
      'X-Naver-Client-Secret': 'np-secret',
      'X-NaverPay-Chain-Id': 'np-chain',
    });
  });

  it('rejects when Naver Pay does not return a Success detail', async () => {
    const client = await loadClient(CONFIGURED);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: 'PaymentNotFound', body: null }),
    });

    await expect(client.fetchNaverPayPaymentDetail('np-1')).rejects.toThrow(
      '결제 서비스 응답이 올바르지 않습니다',
    );
  });

  it('rejects on transport failure without querying payment state', async () => {
    const client = await loadClient(CONFIGURED);
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));

    await expect(client.fetchNaverPayPaymentDetail('np-1')).rejects.toThrow(
      '결제 확인에 실패했습니다',
    );
  });

  it('cancels with an order-scoped idempotency key and amount body', async () => {
    const client = await loadClient(CONFIGURED);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: 'Success', body: { detail: { paymentId: 'np-1' } } }),
    });

    await client.cancelNaverPayPayment({
      paymentId: 'np-1',
      orderId: 'order-1',
      cancelAmount: 50000,
      cancelReason: '단순 변심',
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://apis.naver.com/npay/nnpay/payment/v2.2/cancel');
    expect(init.method).toBe('POST');
    expect(init.headers['X-NaverPay-Idempotency-Key']).toBe('cancel:order-1');
    expect(JSON.parse(init.body)).toEqual({
      paymentId: 'np-1',
      cancelAmount: 50000,
      cancelReason: '단순 변심',
    });
  });
});

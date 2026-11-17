import { generateKeyPairSync, createVerify } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// env는 import 시점에 process.env를 파싱하고 엔드포인트 URL도 모듈 로드 시 결정되므로
// 자격증명을 주입한 뒤 모듈을 새로 불러온다(naverpay.client.spec과 같은 방식).
async function loadClient(vars: Record<string, string> = {}) {
  vi.resetModules();
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
  return import('./kcp.client.js');
}

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PRIVATE_KEY_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const PUBLIC_KEY_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString();

const CONFIGURED = {
  KCP_SITE_CD: 'T0000',
  KCP_CERT_INFO: '-----BEGIN CERTIFICATE-----\nMIIBszCCAVmgAwIBAB=\n-----END CERTIFICATE-----',
  KCP_PRIVATE_KEY: PRIVATE_KEY_PEM,
};

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe('kcp.client', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    fetchMock.mockReset();
  });

  it('blocks with a gateway error when the site code or certificate is missing', async () => {
    const client = await loadClient();

    await expect(
      client.registerKcpTransaction({ orderId: 'order-1', goodName: '광고', amount: 1000 }),
    ).rejects.toThrow('구성되지 않았습니다');
    await expect(
      client.approveKcpPayment({
        orderId: 'order-1',
        amount: 1000,
        encData: 'enc',
        encInfo: 'info',
      }),
    ).rejects.toThrow('구성되지 않았습니다');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('registers a mobile trade against the test endpoint and maps the response', async () => {
    const client = await loadClient(CONFIGURED);
    fetchMock.mockResolvedValue(
      jsonResponse({
        Code: '0000',
        Message: '정상',
        approvalKey: 'ak-1',
        PayUrl: 'https://testsmpay.kcp.co.kr/pay/mobileGW.kcp',
      }),
    );

    const result = await client.registerKcpTransaction({
      orderId: 'order-1',
      goodName: '광고 상품',
      amount: 50000,
      flow: 'ad',
    });

    expect(result).toEqual({
      approvalKey: 'ak-1',
      payUrl: 'https://testsmpay.kcp.co.kr/pay/mobileGW.kcp',
      retUrl: 'http://localhost:3000/payments/kcp/return',
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://testsmpay.kcp.co.kr/trade/register.do');
    expect(JSON.parse(String(init.body))).toMatchObject({
      site_cd: 'T0000',
      ordr_idxx: 'order-1',
      good_name: '광고 상품',
      good_mny: '50000',
      pay_method: 'CARD',
      currency: '410',
      naverpay_direct: 'B',
      Ret_URL: 'http://localhost:3000/payments/kcp/return',
      param_opt_1: 'ad',
    });
  });

  it('rejects the trade registration when KCP returns a non-0000 Code', async () => {
    const client = await loadClient(CONFIGURED);
    fetchMock.mockResolvedValue(jsonResponse({ Code: '8200', Message: '오류' }, false, 200));

    await expect(
      client.registerKcpTransaction({ orderId: 'order-1', goodName: '광고', amount: 1000 }),
    ).rejects.toThrow('결제 준비에 실패했습니다');
  });

  it('approves with the verification parameters and checks the returned amount', async () => {
    const client = await loadClient(CONFIGURED);
    fetchMock.mockResolvedValue(
      jsonResponse({ res_cd: '0000', res_msg: '정상처리', tno: 'tno-1', amount: '50000' }),
    );

    const result = await client.approveKcpPayment({
      orderId: 'order-1',
      amount: 50000,
      encData: 'enc-data',
      encInfo: 'enc-info',
      tranCd: '00100000',
    });

    expect(result).toEqual({ tno: 'tno-1', amount: 50000 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://stg-spl.kcp.co.kr/gw/enc/v1/payment');
    expect(JSON.parse(String(init.body))).toMatchObject({
      site_cd: 'T0000',
      kcp_cert_info: CONFIGURED.KCP_CERT_INFO,
      tran_cd: '00100000',
      enc_data: 'enc-data',
      enc_info: 'enc-info',
      ordr_mony: '50000',
      ordr_no: 'order-1',
      pay_type: 'PACA',
    });
  });

  it('rejects the approval when the KCP amount differs from the order amount', async () => {
    const client = await loadClient(CONFIGURED);
    fetchMock.mockResolvedValue(jsonResponse({ res_cd: '0000', tno: 'tno-1', amount: '40000' }));

    await expect(
      client.approveKcpPayment({ orderId: 'order-1', amount: 50000, encData: 'e', encInfo: 'i' }),
    ).rejects.toThrow('결제 승인에 실패했습니다');
  });

  it('rejects the approval when KCP returns a non-0000 res_cd', async () => {
    const client = await loadClient(CONFIGURED);
    fetchMock.mockResolvedValue(jsonResponse({ res_cd: '3001', res_msg: '취소' }, false, 200));

    await expect(
      client.approveKcpPayment({ orderId: 'order-1', amount: 50000, encData: 'e', encInfo: 'i' }),
    ).rejects.toThrow('결제 승인에 실패했습니다');
  });

  it('cancels with a valid SHA256withRSA sign data over site_cd^tno^mod_type', async () => {
    const client = await loadClient(CONFIGURED);
    fetchMock.mockResolvedValue(jsonResponse({ res_cd: '0000', res_msg: '정상처리' }));

    await client.cancelKcpPayment({ tno: 'tno-9', cancelReason: '환불 사유' });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://stg-spl.kcp.co.kr/gw/mod/v1/cancel');
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      site_cd: 'T0000',
      tno: 'tno-9',
      mod_type: 'STSC',
      mod_desc: '환불 사유',
      mod_ip: '127.0.0.1',
      kcp_cert_info: CONFIGURED.KCP_CERT_INFO,
    });
    // 서명데이터 무결성 — KCP 규격 원문(site_cd^tno^mod_type)으로 공개키 검증에 통과해야 한다.
    const verify = createVerify('RSA-SHA256');
    verify.update('T0000^tno-9^STSC', 'utf8');
    expect(verify.verify(PUBLIC_KEY_PEM, body.kcp_sign_data, 'base64')).toBe(true);
  });

  it('blocks the cancel without a private key even when the cert is set', async () => {
    const client = await loadClient({
      KCP_SITE_CD: 'T0000',
      KCP_CERT_INFO: 'cert-pem',
    });

    await expect(client.cancelKcpPayment({ tno: 'tno-1', cancelReason: 'x' })).rejects.toThrow(
      '서명이 구성되지 않았습니다',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the production endpoints when KCP_PRODUCTION is true', async () => {
    const client = await loadClient({ ...CONFIGURED, KCP_PRODUCTION: 'true' });
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ res_cd: '0000', tno: 'tno-1', amount: '1000' }))
      .mockResolvedValueOnce(
        jsonResponse({
          Code: '0000',
          approvalKey: 'ak',
          PayUrl: 'https://smpay.kcp.co.kr/pay/mobileGW.kcp',
        }),
      );

    await client.approveKcpPayment({
      orderId: 'order-1',
      amount: 1000,
      encData: 'e',
      encInfo: 'i',
    });
    await client.registerKcpTransaction({ orderId: 'order-1', goodName: '광고', amount: 1000 });

    expect(fetchMock.mock.calls[0]![0]).toBe('https://spl.kcp.co.kr/gw/enc/v1/payment');
    expect(fetchMock.mock.calls[1]![0]).toBe('https://smpay.kcp.co.kr/trade/register.do');
  });
});

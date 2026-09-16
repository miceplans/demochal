import { afterEach, describe, expect, it, vi } from 'vitest';
import { NtsClient } from './nts.client.js';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function respondWith(body: unknown, status = 200) {
  fetchMock.mockResolvedValue({ ok: status === 200, status, json: async () => body });
}

describe('NtsClient', () => {
  afterEach(() => fetchMock.mockReset());

  it('posts the registration number to the status endpoint and parses a match', async () => {
    respondWith({
      request_cnt: 1,
      valid_cnt: 1,
      data: [{ b_no: '1234567890', valid: '01', b_stt: '계속사업자', b_stt_cd: '01' }],
    });

    const client = new NtsClient();
    const result = await client.verifyBusinessRegistration('123-45-67890', '주식회사 테스트');

    expect(result).toMatchObject({ valid: true, status: '계속사업자' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/status?serviceKey=');
    expect(JSON.parse(String(init.body))).toEqual({ b_no: ['1234567890'] });
  });

  it('rejects mismatched and closed registrations', async () => {
    const client = new NtsClient();
    respondWith({ data: [{ b_no: '1234567890', valid: '02', b_stt: '등록 정보 불일치' }] });
    await expect(client.verifyBusinessRegistration('1234567890', 'x')).resolves.toMatchObject({
      valid: false,
      status: '등록 정보 불일치',
    });

    respondWith({ data: [{ b_no: '1234567890', valid: '01', b_stt: '폐업자', b_stt_cd: '03' }] });
    await expect(client.verifyBusinessRegistration('1234567890', 'x')).resolves.toMatchObject({
      valid: false,
      status: '폐업자',
    });
  });

  it('reports unrecognized when the API returns no entry', async () => {
    respondWith({ data: [] });
    const client = new NtsClient();
    await expect(client.verifyBusinessRegistration('1234567890', 'x')).resolves.toMatchObject({
      valid: false,
      status: 'unrecognized',
    });
  });
});

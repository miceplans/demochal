import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { POST } from './route';

function formRequest(fields: Record<string, string>) {
  return new Request('https://bz.example.com/payments/kcp/return', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  });
}

describe('POST /payments/kcp/return (KCP 모바일 Ret_URL)', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('forwards the KCP fields to the API and redirects to the success page with provider=kcp', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ outcome: 'success', orderId: 'order-1', flow: 'ad' }),
    });

    const response = await POST(
      formRequest({ res_cd: '0000', ordr_idxx: 'order-1', enc_data: 'd' }),
    );

    expect(response.status).toBe(302);
    const location = response.headers.get('location') ?? '';
    expect(location).toContain('/payments/success?');
    expect(location).toContain('provider=kcp');
    expect(location).toContain('orderId=order-1');
    expect(location).toContain('flow=ad');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/payments/kcp/return');
    expect(JSON.parse(String(init.body))).toMatchObject({ res_cd: '0000', ordr_idxx: 'order-1' });
  });

  it('redirects to the fail page with the res code when the API reports a failure', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ outcome: 'failed', orderId: 'order-1', code: '3001' }),
    });

    const response = await POST(formRequest({ res_cd: '3001', ordr_idxx: 'order-1' }));

    expect(response.status).toBe(302);
    const location = response.headers.get('location') ?? '';
    expect(location).toContain('/payments/fail?');
    expect(location).toContain('code=3001');
    expect(location).toContain('orderId=order-1');
    expect(location).not.toContain('provider=kcp');
  });

  it('falls back to the fail page when the API is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('API down'));

    const response = await POST(formRequest({ res_cd: '0000' }));

    expect(response.status).toBe(302);
    const location = response.headers.get('location') ?? '';
    expect(location).toContain('/payments/fail?');
    expect(location).toContain('code=res_error');
  });
});

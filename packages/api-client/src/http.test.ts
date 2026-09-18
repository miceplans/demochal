import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, HttpClient } from './http';
import { apiFetch, configureGeneratedApi } from './mutator';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('HttpClient.send (orval 경로)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('성공 응답을 {data, status, headers} 엔벨로프로 반환한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{ id: 1 }]));
    vi.stubGlobal('fetch', fetchMock);

    const http = new HttpClient({ baseUrl: 'http://api.test' });
    const result = await http.send<Array<{ id: number }>>('/items');

    expect(result.data).toEqual([{ id: 1 }]);
    expect(result.status).toBe(200);
    expect(result.headers.get('Content-Type')).toBe('application/json');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/items',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('204 응답은 data가 undefined인 엔벨로프로 반환한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    const http = new HttpClient({ baseUrl: 'http://api.test' });
    const result = await http.send('/items/1', { method: 'DELETE' });

    expect(result.status).toBe(204);
    expect(result.data).toBeUndefined();
  });

  it('비-2xx 응답은 ApiError를 던진다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ message: 'unauthorized' }, 401)),
    );

    const http = new HttpClient({ baseUrl: 'http://api.test' });
    const error = await http.get('/me').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect((error as ApiError).body).toEqual({ message: 'unauthorized' });
  });
});

describe('HttpClient 메서드 (수동 경로)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('여전히 원문 바디만 반환한다 (엔벨로프 미적용)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ id: 7 }))),
    );

    const http = new HttpClient({ baseUrl: 'http://api.test' });
    await expect(http.get<{ id: number }>('/me')).resolves.toEqual({ id: 7 });
    await expect(http.post('/items', { a: 1 })).resolves.toEqual({ id: 7 });
  });
});

describe('apiFetch (orval mutator)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('generated 코드가 기대하는 엔벨로프를 그대로 반환한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }, 201));
    vi.stubGlobal('fetch', fetchMock);

    configureGeneratedApi({ baseUrl: 'http://api.test' });
    const result = await apiFetch<{ data: { ok: boolean }; status: number }>('/items', {
      method: 'POST',
      body: JSON.stringify({ a: 1 }),
    });

    expect(result.status).toBe(201);
    expect(result.data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/items',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ a: 1 }) }),
    );
  });
});

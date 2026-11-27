import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: { href?: string }) => ({ kind: 'redirect', url: url.href })),
  rewrite: vi.fn((url: URL) => ({ kind: 'rewrite', url: url.toString() })),
  next: vi.fn((options?: { request: { headers: Headers } }) =>
    options ? { kind: 'next', headers: options.request.headers } : { kind: 'next' },
  ),
}));

vi.mock('next/server', () => ({
  NextResponse: { redirect: mocks.redirect, rewrite: mocks.rewrite, next: mocks.next },
}));

import { config, proxy } from './proxy';

// NextRequest 대역 — proxy()가 쓰는 필드(host 헤더·nextUrl·url)만 구현한다.
function makeRequest(host: string, pathname: string, search = '', extraHeaders?: HeadersInit) {
  const headers = new Headers(extraHeaders);
  headers.set('host', host);
  return {
    url: `https://${host}${pathname}${search}`,
    headers,
    nextUrl: {
      pathname,
      search,
      clone() {
        const base = this as { pathname: string; search: string };
        return {
          get pathname() {
            return base.pathname;
          },
          set pathname(value: string) {
            base.pathname = value;
          },
          get href() {
            return `https://${host}${base.pathname}${base.search}`;
          },
        };
      },
    },
  } as never;
}

describe('proxy subdomain routing', () => {
  beforeEach(() => {
    mocks.redirect.mockClear();
    mocks.rewrite.mockClear();
    mocks.next.mockClear();
  });

  it('rewrites the bz host root to the biz area', () => {
    const result = proxy(makeRequest('bz.example.com', '/'));
    expect(result).toEqual({ kind: 'rewrite', url: 'https://bz.example.com/biz' });
  });

  it('rewrites bz host paths into /biz paths', () => {
    const result = proxy(makeRequest('bz.example.com', '/dashboard'));
    expect(result).toEqual({ kind: 'rewrite', url: 'https://bz.example.com/biz/dashboard' });
  });

  it('strips the /biz prefix on the bz host via redirect, like the biz host does', () => {
    const result = proxy(makeRequest('bz.example.com', '/biz/dashboard'));
    expect(result).toEqual({ kind: 'redirect', url: 'https://bz.example.com/dashboard' });
  });

  it('lets /payments result pages pass through on the bz host for the Naver Pay return URL', () => {
    const result = proxy(makeRequest('bz.example.com', '/payments/success', '?orderId=1'));
    expect(result).toEqual({ kind: 'next' });
    expect(mocks.rewrite).not.toHaveBeenCalled();
  });

  it('lets /payments result pages pass through on the biz host for the Toss success URL', () => {
    const result = proxy(makeRequest('biz.example.com', '/payments/success', '?orderId=1'));
    expect(result).toEqual({ kind: 'next' });
    expect(mocks.rewrite).not.toHaveBeenCalled();
  });

  it('keeps the biz host routing unchanged', () => {
    expect(proxy(makeRequest('biz.example.com', '/'))).toEqual({
      kind: 'rewrite',
      url: 'https://biz.example.com/biz',
    });
    expect(proxy(makeRequest('biz.example.com', '/biz/ads'))).toEqual({
      kind: 'redirect',
      url: 'https://biz.example.com/ads',
    });
  });

  it('keeps the admin host routing unchanged', () => {
    expect(proxy(makeRequest('admin.example.com', '/users'))).toEqual({
      kind: 'rewrite',
      url: 'https://admin.example.com/admin/users',
    });
  });

  it('serves the main site untouched on the root host', () => {
    expect(proxy(makeRequest('www.example.com', '/'))).toEqual({ kind: 'next' });
  });

  it('uses the shared BZ label resolution (NEXT_PUBLIC_BZ_SUBDOMAIN override)', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_BZ_SUBDOMAIN', 'pay');
    const { proxy: proxyWithCustomBz } = await import('./proxy');

    expect(proxyWithCustomBz(makeRequest('pay.example.com', '/'))).toEqual({
      kind: 'rewrite',
      url: 'https://pay.example.com/biz',
    });
    expect(proxyWithCustomBz(makeRequest('pay.example.com', '/payments/success'))).toEqual({
      kind: 'next',
    });
    expect(proxyWithCustomBz(makeRequest('bz.example.com', '/'))).toEqual({ kind: 'next' });
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

describe('signed API client IP', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('includes API paths in the Proxy matcher and signs only the Vercel-observed IP', () => {
    expect(config.matcher).toContain('/api/:path*');
    vi.stubEnv('API_PROXY_IP_SECRET', 's'.repeat(32));
    const result = proxy(
      makeRequest('www.example.com', '/api/health', '', {
        'x-forwarded-for': '198.51.100.7',
        'x-semochal-client-ip': '203.0.113.9',
        'x-semochal-client-ip-signature': 'forged',
      }),
    ) as unknown as { kind: string; headers: Headers };
    expect(result.kind).toBe('next');
    expect(result.headers.get('x-semochal-client-ip')).toBe('198.51.100.7');
    const timestamp = result.headers.get('x-semochal-client-ip-time') ?? '';
    expect(result.headers.get('x-semochal-client-ip-signature')).toBe(
      createHmac('sha256', 's'.repeat(32)).update(`${timestamp}.198.51.100.7`).digest('hex'),
    );
  });

  it('passes API paths through on biz/admin hosts instead of rewriting them', () => {
    mocks.rewrite.mockClear();
    vi.stubEnv('API_PROXY_IP_SECRET', '');
    for (const host of ['biz.example.com', 'admin.example.com']) {
      const result = proxy(makeRequest(host, '/api/health')) as unknown as { kind: string };
      expect(result.kind).toBe('next');
    }
    expect(mocks.rewrite).not.toHaveBeenCalled();
  });

  it('discards spoofed headers when the secret or a single valid IP is absent', () => {
    vi.stubEnv('API_PROXY_IP_SECRET', '');
    const unsigned = proxy(
      makeRequest('www.example.com', '/api/health', '', {
        'x-forwarded-for': '198.51.100.7',
        'x-semochal-client-ip': '203.0.113.9',
        'x-semochal-client-ip-time': '123',
        'x-semochal-client-ip-signature': 'forged',
      }),
    ) as { headers: Headers };
    expect(unsigned.headers.get('x-semochal-client-ip')).toBeNull();
    expect(unsigned.headers.get('x-semochal-client-ip-time')).toBeNull();
    expect(unsigned.headers.get('x-semochal-client-ip-signature')).toBeNull();

    vi.stubEnv('API_PROXY_IP_SECRET', 's'.repeat(32));
    const invalid = proxy(
      makeRequest('www.example.com', '/api/health', '', {
        'x-forwarded-for': '198.51.100.7, 203.0.113.9',
      }),
    ) as { headers: Headers };
    expect(invalid.headers.get('x-semochal-client-ip')).toBeNull();
  });
});

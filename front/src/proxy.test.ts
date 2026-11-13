import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: { href?: string }) => ({ kind: 'redirect', url: url.href })),
  rewrite: vi.fn((url: URL) => ({ kind: 'rewrite', url: url.toString() })),
  next: vi.fn(() => ({ kind: 'next' })),
}));

vi.mock('next/server', () => ({
  NextResponse: { redirect: mocks.redirect, rewrite: mocks.rewrite, next: mocks.next },
}));

import { proxy } from './proxy';

// NextRequest 대역 — proxy()가 쓰는 필드(host 헤더·nextUrl·url)만 구현한다.
function makeRequest(host: string, pathname: string, search = '') {
  return {
    url: `https://${host}${pathname}${search}`,
    headers: { get: (name: string) => (name.toLowerCase() === 'host' ? host : null) },
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
});

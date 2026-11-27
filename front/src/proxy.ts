import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { NextResponse, type NextRequest } from 'next/server';

import { BZ_SUBDOMAIN } from '@/lib/bz-subdomain';

const CLIENT_IP_HEADER = 'x-semochal-client-ip';
const TIMESTAMP_HEADER = 'x-semochal-client-ip-time';
const SIGNATURE_HEADER = 'x-semochal-client-ip-signature';

const BIZ_SUBDOMAIN = process.env.BIZ_SUBDOMAIN ?? 'biz';
const BIZ_ORIGIN = process.env.BIZ_ORIGIN;
const BIZ_PATH = '/biz';

const ADMIN_SUBDOMAIN = process.env.ADMIN_SUBDOMAIN ?? 'admin';
const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN;
const ADMIN_PATH = '/admin';

function isSubdomainHost(host: string, subdomain: string): boolean {
  const labels = host.split('.');
  return labels.length > 2 && labels[0] === subdomain;
}

// /api 요청은 next.config rewrite로 API(ALB)에 전달된다. API는 ALB 한 홉만 신뢰하므로
// Vercel이 덮어쓴 단일 X-Forwarded-For(관측 클라이언트 IP)를 HMAC 서명해 넘기고,
// API가 서명을 검증한 경우에만 req.ip로 쓴다(docs/proxy-client-ip.md).
// https://vercel.com/docs/headers/request-headers#x-forwarded-for
function signedApiHeaders(source: Headers): Headers {
  const headers = new Headers(source);
  // 브라우저가 보낸 같은 이름의 헤더는 절대 전달하지 않는다.
  headers.delete(CLIENT_IP_HEADER);
  headers.delete(TIMESTAMP_HEADER);
  headers.delete(SIGNATURE_HEADER);
  const secret = process.env.API_PROXY_IP_SECRET;
  // 목록·형식 오류 값은 서명하지 않는다 — API는 기존 한 홉 IP로 처리한다.
  const ip = source.get('x-forwarded-for')?.trim();
  if (secret && ip && isIP(ip) !== 0) {
    const timestamp = String(Date.now());
    headers.set(CLIENT_IP_HEADER, ip);
    headers.set(TIMESTAMP_HEADER, timestamp);
    headers.set(
      SIGNATURE_HEADER,
      createHmac('sha256', secret).update(`${timestamp}.${ip}`).digest('hex'),
    );
  }
  return headers;
}

export function proxy(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').split(':')[0].toLowerCase();
  const { pathname, search } = request.nextUrl;
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return NextResponse.next({ request: { headers: signedApiHeaders(request.headers) } });
  }
  const underBizPath = pathname === BIZ_PATH || pathname.startsWith(`${BIZ_PATH}/`);
  const underAdminPath = pathname === ADMIN_PATH || pathname.startsWith(`${ADMIN_PATH}/`);

  // biz/bz 호스트는 같은 /biz 콘텐츠를 서비스한다(bz는 결제만 네이버페이로 분기 — lib/payments).
  if (isSubdomainHost(host, BIZ_SUBDOMAIN) || isSubdomainHost(host, BZ_SUBDOMAIN)) {
    // /payments는 앱 레벨 공유 페이지(토스 successUrl·네이버페이 returnUrl)라 /biz catch-all로
    // rewrite되면 결제 결과 리다이렉트가 도달하지 못한다.
    if (pathname.startsWith('/payments/')) {
      return NextResponse.next();
    }
    if (underBizPath) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.slice(BIZ_PATH.length) || '/';
      return NextResponse.redirect(url);
    }
    return NextResponse.rewrite(
      new URL(`${BIZ_PATH}${pathname === '/' ? '' : pathname}${search}`, request.url),
    );
  }

  if (isSubdomainHost(host, ADMIN_SUBDOMAIN)) {
    if (underAdminPath) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.slice(ADMIN_PATH.length) || '/';
      return NextResponse.redirect(url);
    }
    return NextResponse.rewrite(
      new URL(`${ADMIN_PATH}${pathname === '/' ? '' : pathname}${search}`, request.url),
    );
  }

  if (BIZ_ORIGIN && underBizPath) {
    return NextResponse.redirect(
      new URL(`${pathname.slice(BIZ_PATH.length) || '/'}${search}`, BIZ_ORIGIN),
    );
  }

  if (ADMIN_ORIGIN && underAdminPath) {
    return NextResponse.redirect(
      new URL(`${pathname.slice(ADMIN_PATH.length) || '/'}${search}`, ADMIN_ORIGIN),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!api|_next/static|_next/image|favicon.ico|assets|fonts|robots.txt|sitemap.xml|.*\\..*).*)',
  ],
};

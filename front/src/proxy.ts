import { NextResponse, type NextRequest } from 'next/server';

const BIZ_SUBDOMAIN = process.env.BIZ_SUBDOMAIN ?? 'biz';
const BIZ_ORIGIN = process.env.BIZ_ORIGIN;
const BIZ_PATH = '/biz';

// bz 호스트는 biz와 동일한 콘텐츠를 서비스하되 결제만 네이버페이로 쓴다.
// NEXT_PUBLIC_BZ_SUBDOMAIN은 프론트 결제 분기(lib/payments)와 같은 값을 쓰게 하는 클라이언트 공개 변수다.
const BZ_SUBDOMAIN = process.env.BZ_SUBDOMAIN ?? process.env.NEXT_PUBLIC_BZ_SUBDOMAIN ?? 'bz';

const ADMIN_SUBDOMAIN = process.env.ADMIN_SUBDOMAIN ?? 'admin';
const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN;
const ADMIN_PATH = '/admin';

function isSubdomainHost(host: string, subdomain: string): boolean {
  const labels = host.split('.');
  return labels.length > 2 && labels[0] === subdomain;
}

export function proxy(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').split(':')[0].toLowerCase();
  const { pathname, search } = request.nextUrl;
  const underBizPath = pathname === BIZ_PATH || pathname.startsWith(`${BIZ_PATH}/`);
  const underAdminPath = pathname === ADMIN_PATH || pathname.startsWith(`${ADMIN_PATH}/`);

  if (isSubdomainHost(host, BIZ_SUBDOMAIN)) {
    if (underBizPath) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.slice(BIZ_PATH.length) || '/';
      return NextResponse.redirect(url);
    }
    return NextResponse.rewrite(
      new URL(`${BIZ_PATH}${pathname === '/' ? '' : pathname}${search}`, request.url),
    );
  }

  if (isSubdomainHost(host, BZ_SUBDOMAIN)) {
    // /payments는 앱 레벨 공유 페이지(결제 결과)라 /biz rewrite 대상에서 제외해야
    // 네이버페이 returnUrl 리다이렉트가 그대로 도달한다. 나머지 경로는 biz와 동일 규칙.
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
    '/((?!api|_next/static|_next/image|favicon.ico|assets|fonts|robots.txt|sitemap.xml|.*\\..*).*)',
  ],
};

import { NextResponse, type NextRequest } from 'next/server';

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

import { NextResponse, type NextRequest } from 'next/server';

const BIZ_SUBDOMAIN = process.env.BIZ_SUBDOMAIN ?? 'biz';
const BIZ_ORIGIN = process.env.BIZ_ORIGIN;
const BIZ_PATH = '/biz';

function isBizHost(host: string): boolean {
  const labels = host.split('.');
  return labels.length > 2 && labels[0] === BIZ_SUBDOMAIN;
}

export function proxy(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').split(':')[0].toLowerCase();
  const { pathname, search } = request.nextUrl;
  const underBizPath = pathname === BIZ_PATH || pathname.startsWith(`${BIZ_PATH}/`);

  if (isBizHost(host)) {
    if (underBizPath) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.slice(BIZ_PATH.length) || '/';
      return NextResponse.redirect(url);
    }
    return NextResponse.rewrite(
      new URL(`${BIZ_PATH}${pathname === '/' ? '' : pathname}${search}`, request.url),
    );
  }

  if (BIZ_ORIGIN && underBizPath) {
    return NextResponse.redirect(
      new URL(`${pathname.slice(BIZ_PATH.length) || '/'}${search}`, BIZ_ORIGIN),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|assets|fonts|robots.txt|sitemap.xml|.*\\..*).*)',
  ],
};

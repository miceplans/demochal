export const BIZ_SUBDOMAIN = process.env.BIZ_SUBDOMAIN ?? 'biz';
// bz 호스트(네이버페이 결제용)도 biz 호스트와 같은 구조로 /biz를 숨겨 서빙한다(proxy.ts와 같은 레이블).
const BZ_SUBDOMAIN = process.env.NEXT_PUBLIC_BZ_SUBDOMAIN ?? process.env.BZ_SUBDOMAIN ?? 'bz';
export const BIZ_PATH_PREFIX = '/biz';
export const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? '';
export const DEFAULT_SITE_ORIGIN = 'https://www.semochall.com';

export function isBizHostHeader(host: string | null): boolean {
  if (!host) return false;
  const labels = host.split(':')[0].toLowerCase().split('.');
  return (
    labels.length > 2 && (labels[0] === BIZ_SUBDOMAIN || labels[0] === BZ_SUBDOMAIN.toLowerCase())
  );
}

export function siteHref(path: string): string {
  return `${SITE_ORIGIN}${path}`;
}

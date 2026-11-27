import { BZ_SUBDOMAIN } from './bz-subdomain';

export const BIZ_SUBDOMAIN = process.env.BIZ_SUBDOMAIN ?? 'biz';
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

// bz 호스트(광고형 상품·네이버페이)인지 판별한다. biz 호스트는 구독형 상품 문서를 쓴다.
export function isBzHostHeader(host: string | null): boolean {
  if (!host) return false;
  const labels = host.split(':')[0].toLowerCase().split('.');
  return labels.length > 2 && labels[0] === BZ_SUBDOMAIN.toLowerCase();
}

export function siteHref(path: string): string {
  return `${SITE_ORIGIN}${path}`;
}

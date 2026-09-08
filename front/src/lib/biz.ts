export const BIZ_SUBDOMAIN = process.env.BIZ_SUBDOMAIN ?? 'biz';
export const BIZ_PATH_PREFIX = '/biz';
export const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? '';

export function isBizHostHeader(host: string | null): boolean {
  if (!host) return false;
  const labels = host.split(':')[0].toLowerCase().split('.');
  return labels.length > 2 && labels[0] === BIZ_SUBDOMAIN;
}

export function siteHref(path: string): string {
  return `${SITE_ORIGIN}${path}`;
}

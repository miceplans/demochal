export const ADMIN_SUBDOMAIN = process.env.ADMIN_SUBDOMAIN ?? 'admin';
export const ADMIN_PATH_PREFIX = '/admin';

export function isAdminHostHeader(host: string | null): boolean {
  if (!host) return false;
  const labels = host.split(':')[0].toLowerCase().split('.');
  return labels.length > 2 && labels[0] === ADMIN_SUBDOMAIN;
}

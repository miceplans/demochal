// Mirrors server/src/modules/auth/next-path.ts — the server re-validates, this
// only guards client-side navigation after email login.
const AUTH_PATH_PREFIXES = ['/login', '/auth', '/onboarding'];

export function sanitizeNextPath(value: string | null | undefined): string | null {
  if (!value || value.length > 512) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return null;
  const pathname = value.split(/[?#]/, 1)[0] ?? '';
  if (AUTH_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  return value;
}

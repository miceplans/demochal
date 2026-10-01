export const LOGIN_NEXT_COOKIE_NAME = 'semochal_login_next';

const MAX_NEXT_LENGTH = 512;
// Never send a user back to the auth pages themselves (redirect loop).
const AUTH_PATH_PREFIXES = ['/login', '/auth', '/onboarding'];

/**
 * Returns `value` only when it is a same-origin relative path; otherwise null.
 * Rejects scheme/host forms (`//evil.com`, `https://…`, `/\evil.com`) so the
 * post-login redirect can't be used as an open redirect.
 */
export function sanitizeNextPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_NEXT_LENGTH) {
    return null;
  }
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  // Backslashes and control characters are normalised by browsers into `/` or
  // dropped, which can turn `/\evil.com` or `/\t/evil.com` into a host.
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return null;
  const pathname = value.split(/[?#]/, 1)[0] ?? '';
  if (AUTH_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  return value;
}

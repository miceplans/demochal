import type { CookieOptions, Request } from 'express';
import { env } from '../../config/env.js';

export const AUTH_COOKIE_NAME = 'semochal_access_token';
export const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const authCookieOptions: CookieOptions = {
  httpOnly: true,
  maxAge: AUTH_COOKIE_MAX_AGE_MS,
  path: '/',
  sameSite: 'lax',
  secure: env.nodeEnv === 'production',
};

export const authCookieClearOptions: CookieOptions = {
  httpOnly: true,
  path: '/',
  sameSite: 'lax',
  secure: env.nodeEnv === 'production',
};

/** Reads the signed JWT from the HttpOnly session cookie without a cookie-parser dependency. */
export function getAuthToken(request: Request): string | undefined {
  const cookies = request.headers.cookie;
  if (!cookies) return undefined;

  const value = cookies
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.slice(AUTH_COOKIE_NAME.length + 1);

  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

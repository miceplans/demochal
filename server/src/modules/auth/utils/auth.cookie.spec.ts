import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { AUTH_COOKIE_NAME, authCookieOptions, getAuthToken } from './auth.cookie.js';

function requestWithCookie(cookie?: string): Request {
  return { headers: { cookie } } as Request;
}

describe('authentication cookie', () => {
  it('reads only the configured cookie and decodes its JWT value', () => {
    const token = getAuthToken(
      requestWithCookie(`theme=dark; ${AUTH_COOKIE_NAME}=header.payload%2Esignature; other=value`),
    );

    expect(token).toBe('header.payload.signature');
  });

  it('does not accept a missing or malformed session cookie', () => {
    expect(getAuthToken(requestWithCookie('another_cookie=value'))).toBeUndefined();
    expect(getAuthToken(requestWithCookie(`${AUTH_COOKIE_NAME}=%`))).toBeUndefined();
  });

  it('keeps the session token inaccessible to browser JavaScript', () => {
    expect(authCookieOptions).toMatchObject({ httpOnly: true, path: '/', sameSite: 'lax' });
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import request from 'supertest';
import {
  AUTH_COOKIE_NAME,
  authCookieDomain,
  authCookieOptions,
  getAuthToken,
} from './auth.cookie.js';

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

describe('authCookieDomain', () => {
  it('shares the session with the HTTPS frontend parent domain', () => {
    expect(authCookieDomain('https://server.semochall.com', 'https://semochall.com')).toBe(
      'semochall.com',
    );
  });

  it.each([
    ['http://localhost:3001', 'http://localhost:3000'],
    ['https://server.semochall.com', 'http://semochall.com'],
    ['https://server.semochall.com', 'https://other.example.com'],
    ['https://server.semochall.com.evil.example', 'https://semochall.com'],
    ['https://server.semochall.com', 'https://com'],
  ])('keeps a host-only cookie for unrelated or insecure origins', (api, frontend) => {
    expect(authCookieDomain(api, frontend)).toBeUndefined();
  });

  it('uses the same domain for setting and clearing the session cookie', async () => {
    vi.resetModules();
    vi.stubEnv('API_PUBLIC_URL', 'https://server.semochall.com');
    vi.stubEnv('FRONTEND_ORIGIN', 'https://semochall.com');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', 'a'.repeat(32));
    vi.stubEnv('TOSS_SECRET_KEY', '');
    const { authCookieOptions, authCookieClearOptions } = await import('./auth.cookie.js');

    expect(authCookieOptions).toMatchObject({
      domain: 'semochall.com',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });
    expect(authCookieClearOptions).toMatchObject({
      domain: 'semochall.com',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });

    const app = new ExpressAdapter().getInstance();
    app.get('/set', (_req: Request, res: Response) => {
      res.cookie('semochal_access_token', 'test-token', authCookieOptions).sendStatus(204);
    });
    app.get('/clear', (_req: Request, res: Response) => {
      res.clearCookie('semochal_access_token', authCookieClearOptions).sendStatus(204);
    });
    const setCookie = (await request(app).get('/set')).headers['set-cookie'];
    const clearCookie = (await request(app).get('/clear')).headers['set-cookie'];
    expect(setCookie?.[0]).toContain('Domain=semochall.com');
    expect(clearCookie?.[0]).toContain('Domain=semochall.com');
    expect(setCookie?.[0]).toContain('HttpOnly');
    expect(setCookie?.[0]).toContain('Secure');
    expect(setCookie?.[0]).toContain('SameSite=Lax');
  });
});

afterEach(() => vi.unstubAllEnvs());

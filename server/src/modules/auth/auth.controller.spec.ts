import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller.js';
import { AUTH_COOKIE_NAME, authCookieOptions } from './auth.cookie.js';
import type { AuthService } from './auth.service.js';
import type { ContactVerificationsService } from './contact-verifications.service.js';
import { SKIP_INPUT_SECURITY_KEY } from '../../common/security/skip-input-security.decorator.js';
import { fetchJson } from '../../common/http/fetch-json.js';

vi.mock('../../common/http/fetch-json.js', () => ({ fetchJson: vi.fn() }));

const user = { id: 'user-1', email: 'member@semochal.kr', name: '회원' };
const testPassword = ['test', 'password'].join('-');

function response() {
  return { cookie: vi.fn(), clearCookie: vi.fn(), redirect: vi.fn() } as unknown as Response;
}

function createController() {
  const service = {
    login: vi.fn().mockResolvedValue({ accessToken: 'signed.jwt', user }),
    register: vi.fn().mockResolvedValue({ accessToken: 'signed.jwt', user }),
    me: vi.fn().mockResolvedValue(user),
  };
  return {
    controller: new AuthController(
      service as unknown as AuthService,
      {} as unknown as ContactVerificationsService,
    ),
    service,
  };
}

describe('AuthController cookie session flow', () => {
  it('sets an HttpOnly cookie on login and does not expose the JWT in JSON', async () => {
    const { controller, service } = createController();
    const res = response();

    await expect(
      controller.login({ email: user.email, password: testPassword }, res),
    ).resolves.toEqual({
      user,
    });
    expect(service.login).toHaveBeenCalledWith(user.email, testPassword);
    expect(res.cookie).toHaveBeenCalledWith(AUTH_COOKIE_NAME, 'signed.jwt', authCookieOptions);
  });

  it('uses the session cookie to identify the current user', async () => {
    const { controller, service } = createController();
    const request = {
      headers: { cookie: `theme=dark; ${AUTH_COOKIE_NAME}=signed.jwt` },
    } as Request;

    await expect(controller.me(request)).resolves.toEqual(user);
    expect(service.me).toHaveBeenCalledWith('signed.jwt');
  });

  it('clears the same session cookie on logout', () => {
    const { controller } = createController();
    const res = response();

    controller.logout(res);
    expect(res.clearCookie).toHaveBeenCalledWith(
      AUTH_COOKIE_NAME,
      expect.objectContaining({ path: '/' }),
    );
  });
});

describe('AuthController Google callback input-security opt-out', () => {
  const reflector = new Reflector();

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('opts only the Google callback out of the global input-security pipe', () => {
    expect(reflector.get(SKIP_INPUT_SECURITY_KEY, AuthController.prototype.googleCallback)).toBe(
      true,
    );
    // Every other handler — including the Naver callback — keeps default checks.
    for (const handler of [
      AuthController.prototype.login,
      AuthController.prototype.register,
      AuthController.prototype.googleLogin,
      AuthController.prototype.naverLogin,
      AuthController.prototype.naverCallback,
      AuthController.prototype.logout,
    ]) {
      expect(reflector.get(SKIP_INPUT_SECURITY_KEY, handler)).toBeUndefined();
    }
  });

  it('still verifies the signed state before exchanging an opaque code containing `--`', async () => {
    vi.resetModules();
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-google-client-id');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-google-client-secret');
    const { AuthController: FreshController } = await import('./auth.controller.js');
    const { fetchJson: fetchJsonMock } = await import('../../common/http/fetch-json.js');
    const mockedFetchJson = vi.mocked(fetchJsonMock);

    const service = { loginWithGoogle: vi.fn() };
    const controller = new FreshController(
      service as unknown as AuthService,
      {} as unknown as ContactVerificationsService,
    );
    const res = response();
    const request = { headers: { cookie: 'semochal_google_oauth_state=nonce-value' } } as Request;

    // A syntactically valid-looking state that does not match the cookie nonce.
    await controller.googleCallback(
      '4/0AeaYUB--opaque--code',
      'tampered--nonce.dGltZWRfb3V0',
      undefined,
      request,
      res,
    );

    expect(mockedFetchJson).not.toHaveBeenCalled();
    expect(service.loginWithGoogle).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(
      'http://localhost:3000/login?error=google_login_failed',
    );
  });

  it('exchanges the authorization code with `--` once the signed state matches', async () => {
    vi.resetModules();
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-google-client-id');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-google-client-secret');
    const { AuthController: FreshController } = await import('./auth.controller.js');
    const { env } = await import('../../config/env.js');
    const { fetchJson: fetchJsonMock } = await import('../../common/http/fetch-json.js');
    const mockedFetchJson = vi.mocked(fetchJsonMock);

    const nonce = 'state-nonce-with-enough-entropy';
    const signature = createHmac('sha256', env.jwtSecret).update(nonce).digest('base64url');
    const service = {
      loginWithGoogle: vi.fn().mockResolvedValue({
        accessToken: 'signed.jwt',
        user: { ...user, onboardingSurvey: true },
      }),
    };
    const controller = new FreshController(
      service as unknown as AuthService,
      {} as unknown as ContactVerificationsService,
    );
    const res = response();
    const request = { headers: { cookie: `semochal_google_oauth_state=${nonce}` } } as Request;

    mockedFetchJson
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'google-access-token' }),
      } as unknown as Awaited<ReturnType<typeof fetchJson>>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 'google-sub-1',
          email: 'Member@Gmail.com',
          email_verified: true,
          name: '구글회원',
        }),
      } as unknown as Awaited<ReturnType<typeof fetchJson>>);

    const code = '4/0AeaYUB--opaque--code';
    await controller.googleCallback(code, `${nonce}.${signature}`, undefined, request, res);

    expect(mockedFetchJson).toHaveBeenCalledTimes(2);
    const tokenExchangeBody = new URLSearchParams(String(mockedFetchJson.mock.calls[0]?.[1]?.body));
    expect(tokenExchangeBody.get('code')).toBe(code);
    expect(service.loginWithGoogle).toHaveBeenCalledWith({
      subject: 'google-sub-1',
      email: 'member@gmail.com',
      name: '구글회원',
    });
    expect(res.cookie).toHaveBeenCalledWith(AUTH_COOKIE_NAME, 'signed.jwt', authCookieOptions);
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:3000/');
  });
});

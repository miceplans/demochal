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

const user = { id: 'user-1', email: 'member@semochal.kr', name: '회원', role: 'user' };
const testPassword = ['test', 'password'].join('-');

function response() {
  return { cookie: vi.fn(), clearCookie: vi.fn(), redirect: vi.fn() } as unknown as Response;
}

function createController() {
  const service = {
    login: vi.fn().mockResolvedValue({ accessToken: 'signed.jwt', user }),
    register: vi.fn().mockResolvedValue({ accessToken: 'signed.jwt', user }),
    me: vi.fn().mockResolvedValue(user),
    withdraw: vi.fn().mockResolvedValue(undefined),
    changePassword: vi.fn().mockResolvedValue(undefined),
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

  it('withdraws the authenticated account and clears its session cookie', async () => {
    const { controller, service } = createController();
    const res = response();
    await expect(
      controller.withdraw({ password: testPassword, confirmation: '회원 탈퇴' }, user, res),
    ).resolves.toBeUndefined();
    expect(service.withdraw).toHaveBeenCalledWith(user.id, {
      password: testPassword,
      confirmation: '회원 탈퇴',
    });
    expect(res.clearCookie).toHaveBeenCalledWith(
      AUTH_COOKIE_NAME,
      expect.objectContaining({ path: '/' }),
    );
  });

  it('changes the authenticated user password without returning credentials', async () => {
    const { controller, service } = createController();
    const dto = {
      currentPassword: testPassword,
      newPassword: ['new', 'password'].join('-'),
      confirmNewPassword: ['new', 'password'].join('-'),
    };

    await expect(controller.changePassword(dto, user)).resolves.toEqual({ changed: true });
    expect(service.changePassword).toHaveBeenCalledWith(user.id, dto);
  });
});

describe('AuthController Google callback input-security opt-out', () => {
  const reflector = new Reflector();

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('opts only the OAuth callbacks out of the global input-security pipe', () => {
    for (const callback of [
      AuthController.prototype.googleCallback,
      AuthController.prototype.naverCallback,
      AuthController.prototype.kakaoCallback,
    ]) {
      expect(reflector.get(SKIP_INPUT_SECURITY_KEY, callback)).toBe(true);
    }
    // Every other handler keeps default checks.
    for (const handler of [
      AuthController.prototype.login,
      AuthController.prototype.register,
      AuthController.prototype.googleLogin,
      AuthController.prototype.naverLogin,
      AuthController.prototype.kakaoLogin,
      AuthController.prototype.logout,
      AuthController.prototype.withdraw,
      AuthController.prototype.changePassword,
    ]) {
      expect(reflector.get(SKIP_INPUT_SECURITY_KEY, handler)).toBeUndefined();
    }
    expect(reflector.get('isPublic', AuthController.prototype.withdraw)).toBe(false);
    expect(reflector.get('isPublic', AuthController.prototype.changePassword)).toBe(false);
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
    const signature = createHmac('sha256', env.oauthStateSecret).update(nonce).digest('base64url');
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

describe('AuthController Naver callback', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function setup() {
    vi.resetModules();
    vi.stubEnv('NAVER_CLIENT_ID', 'test-naver-client-id');
    vi.stubEnv('NAVER_CLIENT_SECRET', 'test-naver-client-secret');
    const { AuthController: FreshController } = await import('./auth.controller.js');
    const { env } = await import('../../config/env.js');
    const { fetchJson: fetchJsonMock } = await import('../../common/http/fetch-json.js');
    const mockedFetchJson = vi.mocked(fetchJsonMock);
    mockedFetchJson.mockReset();

    const nonce = 'naver-state-nonce-with-entropy';
    const signature = createHmac('sha256', env.oauthStateSecret).update(nonce).digest('base64url');
    const service = {
      loginWithNaver: vi.fn().mockResolvedValue({
        accessToken: 'signed.jwt',
        user: { ...user, onboardingSurvey: true },
      }),
    };
    const controller = new FreshController(
      service as unknown as AuthService,
      {} as unknown as ContactVerificationsService,
    );
    const request = { headers: { cookie: `semochal_naver_oauth_state=${nonce}` } } as Request;
    return { controller, service, mockedFetchJson, request, state: `${nonce}.${signature}` };
  }

  it('rejects a state that does not match the cookie nonce without exchanging the code', async () => {
    const { controller, service, mockedFetchJson, request } = await setup();
    const res = response();

    await controller.naverCallback('naver--code', 'tampered--nonce.c2ln', undefined, request, res);

    expect(mockedFetchJson).not.toHaveBeenCalled();
    expect(service.loginWithNaver).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(
      'http://localhost:3000/login?error=naver_login_failed',
    );
  });

  it('exchanges an authorization code containing `--` once the signed state matches', async () => {
    const { controller, service, mockedFetchJson, request, state } = await setup();
    mockedFetchJson
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'naver-access-token' }),
      } as unknown as Awaited<ReturnType<typeof fetchJson>>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resultcode: '00',
          response: { id: 'naver-id-1', email: 'Member@Naver.com', name: '네이버회원' },
        }),
      } as unknown as Awaited<ReturnType<typeof fetchJson>>);
    const res = response();

    await controller.naverCallback('naver--opaque--code', state, undefined, request, res);

    const tokenUrl = new URL(String(mockedFetchJson.mock.calls[0]?.[0]));
    expect(tokenUrl.searchParams.get('code')).toBe('naver--opaque--code');
    expect(service.loginWithNaver).toHaveBeenCalledWith({
      subject: 'naver-id-1',
      email: 'member@naver.com',
      name: '네이버회원',
    });
    expect(res.cookie).toHaveBeenCalledWith(AUTH_COOKIE_NAME, 'signed.jwt', authCookieOptions);
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:3000/');
  });
});

describe('AuthController Kakao callback', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function setup() {
    vi.resetModules();
    vi.stubEnv('KAKAO_CLIENT_ID', 'test-kakao-rest-api-key');
    const { AuthController: FreshController } = await import('./auth.controller.js');
    const { env } = await import('../../config/env.js');
    const { fetchJson: fetchJsonMock } = await import('../../common/http/fetch-json.js');
    const mockedFetchJson = vi.mocked(fetchJsonMock);
    mockedFetchJson.mockReset();

    const nonce = 'kakao-state-nonce-with-entropy';
    const signature = createHmac('sha256', env.oauthStateSecret).update(nonce).digest('base64url');
    const service = {
      loginWithKakao: vi.fn().mockResolvedValue({
        accessToken: 'signed.jwt',
        user: { ...user, onboardingSurvey: false },
      }),
    };
    const controller = new FreshController(
      service as unknown as AuthService,
      {} as unknown as ContactVerificationsService,
    );
    const request = { headers: { cookie: `semochal_kakao_oauth_state=${nonce}` } } as Request;
    return { controller, service, mockedFetchJson, request, state: `${nonce}.${signature}` };
  }

  function mockKakaoResponses(
    mockedFetchJson: ReturnType<typeof vi.mocked<typeof fetchJson>>,
    account: Record<string, unknown>,
  ) {
    mockedFetchJson
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'kakao-access-token' }),
      } as unknown as Awaited<ReturnType<typeof fetchJson>>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1234567890, kakao_account: account }),
      } as unknown as Awaited<ReturnType<typeof fetchJson>>);
  }

  it('rejects a state that does not match the cookie nonce without exchanging the code', async () => {
    const { controller, service, mockedFetchJson, request } = await setup();
    const res = response();

    await controller.kakaoCallback('kakao--code', 'tampered.c2ln', undefined, request, res);

    expect(mockedFetchJson).not.toHaveBeenCalled();
    expect(service.loginWithKakao).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(
      'http://localhost:3000/login?error=kakao_login_failed',
    );
  });

  it('logs in with a verified Kakao email and redirects to onboarding', async () => {
    const { controller, service, mockedFetchJson, request, state } = await setup();
    mockKakaoResponses(mockedFetchJson, {
      email: 'Member@Kakao.com',
      is_email_valid: true,
      is_email_verified: true,
      profile: { nickname: '카카오회원' },
    });
    const res = response();

    await controller.kakaoCallback('kakao--code', state, undefined, request, res);

    const tokenExchangeBody = new URLSearchParams(String(mockedFetchJson.mock.calls[0]?.[1]?.body));
    expect(tokenExchangeBody.get('code')).toBe('kakao--code');
    expect(tokenExchangeBody.get('client_id')).toBe('test-kakao-rest-api-key');
    expect(tokenExchangeBody.has('client_secret')).toBe(false);
    expect(service.loginWithKakao).toHaveBeenCalledWith({
      subject: '1234567890',
      email: 'member@kakao.com',
      name: '카카오회원',
    });
    expect(res.cookie).toHaveBeenCalledWith(AUTH_COOKIE_NAME, 'signed.jwt', authCookieOptions);
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:3000/onboarding/activity');
  });

  it('refuses an unverified Kakao email so it cannot be linked to an existing account', async () => {
    const { controller, service, mockedFetchJson, request, state } = await setup();
    mockKakaoResponses(mockedFetchJson, {
      email: 'member@kakao.com',
      is_email_valid: true,
      is_email_verified: false,
    });
    const res = response();

    await controller.kakaoCallback('kakao-code', state, undefined, request, res);

    expect(service.loginWithKakao).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(
      'http://localhost:3000/login?error=kakao_login_failed',
    );
  });
});

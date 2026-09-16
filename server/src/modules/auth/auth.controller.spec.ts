import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller.js';
import { AUTH_COOKIE_NAME, authCookieOptions } from './auth.cookie.js';
import type { AuthService } from './auth.service.js';

const user = { id: 'user-1', email: 'member@semochal.kr', name: '회원' };
const testPassword = ['test', 'password'].join('-');

function response() {
  return { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as Response;
}

function createController() {
  const service = {
    login: vi.fn().mockResolvedValue({ accessToken: 'signed.jwt', user }),
    register: vi.fn().mockResolvedValue({ accessToken: 'signed.jwt', user }),
    me: vi.fn().mockResolvedValue(user),
  };
  return { controller: new AuthController(service as unknown as AuthService), service };
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

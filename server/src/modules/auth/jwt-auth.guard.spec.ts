import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../../db/drizzle.provider.js';
import { JwtAuthGuard, OptionalJwtAuthGuard } from './jwt-auth.guard.js';

function context(request: object): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => class TestController {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const dbReturning = (rows: object[]) =>
  ({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  }) as unknown as Database;

const AUTH_COOKIE = 'semochal_access_token';

describe('JwtAuthGuard', () => {
  it('skips authentication for @Public() endpoints before reading a cookie', async () => {
    const jwtService = { verifyAsync: vi.fn() } as unknown as JwtService;
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const guard = new JwtAuthGuard(jwtService, reflector, {} as Database);

    await expect(guard.canActivate(context({}))).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects a protected endpoint with no authentication cookie', async () => {
    const jwtService = { verifyAsync: vi.fn() } as unknown as JwtService;
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const guard = new JwtAuthGuard(jwtService, reflector, {} as Database);

    await expect(guard.canActivate(context({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('OptionalJwtAuthGuard', () => {
  it('passes anonymously when no cookie is present', async () => {
    const jwtService = { verifyAsync: vi.fn() } as unknown as JwtService;
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const guard = new OptionalJwtAuthGuard(jwtService, reflector, {} as Database);
    const request = { headers: {} };

    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(request).not.toHaveProperty('user');
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('passes anonymously when the token is invalid', async () => {
    const jwtService = {
      verifyAsync: vi.fn().mockRejectedValue(new Error('expired')),
    } as unknown as JwtService;
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const guard = new OptionalJwtAuthGuard(jwtService, reflector, {} as Database);
    const request = { headers: { cookie: `${AUTH_COOKIE}=bad-token` } };

    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(request).not.toHaveProperty('user');
  });

  it('attaches request.user when a valid cookie is present', async () => {
    const jwtService = {
      verifyAsync: vi.fn().mockResolvedValue({ sub: 'u1', email: 'a@x.com', role: 'user' }),
    } as unknown as JwtService;
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const db = dbReturning([
      { name: '홍길동', role: 'user', suspended: false, suspendedReason: null, withdrawnAt: null },
    ]);
    const guard = new OptionalJwtAuthGuard(jwtService, reflector, db);
    const request = { headers: { cookie: `${AUTH_COOKIE}=valid-token` } };

    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(request).toHaveProperty('user', {
      id: 'u1',
      email: 'a@x.com',
      name: '홍길동',
      role: 'user',
    });
  });
});

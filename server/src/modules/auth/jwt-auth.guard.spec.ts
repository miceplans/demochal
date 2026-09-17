import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../../db/drizzle.provider.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

function context(request: object): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => class TestController {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

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

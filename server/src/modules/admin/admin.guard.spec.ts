import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AUTH_COOKIE_NAME } from '../auth/auth.cookie.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminController } from './admin.controller.js';
import { AdminRoleGuard } from './admin-role.guard.js';

/** Auto-chaining thenable stand-in for a drizzle select builder (see admin.service.spec.ts). */
function chainable(resolved: unknown) {
  const proxy: any = new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === 'then') {
        return (onFulfilled: (value: unknown) => unknown) => onFulfilled(resolved);
      }
      return () => proxy;
    },
  });
  return proxy;
}

function createDbStub(selectResult: unknown) {
  return { select: vi.fn(() => chainable(selectResult)) } as any;
}

function httpContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => class TestController {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function cookieHeader(token: string) {
  return { cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}` };
}

function createGuard(db: unknown, verifyAsync = vi.fn()) {
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as never;
  return { guard: new JwtAuthGuard({ verifyAsync } as never, reflector, db as never), verifyAsync };
}

describe('AdminController guard wiring', () => {
  it('applies AdminRoleGuard on top of the global JwtAuthGuard', () => {
    // JwtAuthGuard is registered as the global APP_GUARD (app.module.ts) since
    // it must run before every route; only the admin-only check is per-controller.
    const guards = Reflect.getMetadata('__guards__', AdminController);
    expect(guards).toEqual([AdminRoleGuard]);
  });
});

describe('AdminRoleGuard', () => {
  const guard = new AdminRoleGuard();

  it.each([
    ['an anonymous request', undefined],
    ['a non-admin user', { id: 'u1', email: 'member@semochal.kr', role: 'user' }],
  ])('forbids %s', (_label, user) => {
    expect(() => guard.canActivate(httpContext({ user }))).toThrow(ForbiddenException);
  });

  it('allows admin users through', () => {
    const request = { user: { id: 'a1', email: 'admin@semochal.kr', role: 'admin' } };
    expect(guard.canActivate(httpContext(request))).toBe(true);
  });
});

describe('JwtAuthGuard', () => {
  it('rejects requests without the auth cookie and never verifies a token', async () => {
    const { guard, verifyAsync } = createGuard(createDbStub([]));

    await expect(guard.canActivate(httpContext({ headers: {} }))).rejects.toThrow(
      new UnauthorizedException('Missing authentication cookie'),
    );
    expect(verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects an invalid or expired token', async () => {
    const { guard } = createGuard(
      createDbStub([]),
      vi.fn().mockRejectedValue(new Error('bad signature')),
    );

    await expect(
      guard.canActivate(httpContext({ headers: cookieHeader('tampered.jwt') })),
    ).rejects.toThrow(new UnauthorizedException('Invalid or expired token'));
  });

  it('rejects a token whose payload is missing required claims', async () => {
    const { guard } = createGuard(createDbStub([]), vi.fn().mockResolvedValue({ sub: 'u1' }));

    await expect(
      guard.canActivate(httpContext({ headers: cookieHeader('incomplete.jwt') })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('forbids suspended users even with a valid token', async () => {
    const { guard } = createGuard(
      createDbStub([{ suspended: true, suspendedReason: '정지 사유' }]),
      vi.fn().mockResolvedValue({ sub: 'u1', email: 'u@semochal.kr', role: 'admin' }),
    );

    await expect(
      guard.canActivate(httpContext({ headers: cookieHeader('valid.jwt') })),
    ).rejects.toThrow(new ForbiddenException('정지 사유'));
  });

  it('attaches the verified user to the request', async () => {
    const request: Record<string, unknown> = { headers: cookieHeader('valid.jwt') };
    const { guard, verifyAsync } = createGuard(
      createDbStub([{ suspended: false, suspendedReason: null }]),
      vi.fn().mockResolvedValue({ sub: 'u1', email: 'u@semochal.kr', role: 'admin' }),
    );

    await expect(guard.canActivate(httpContext(request))).resolves.toBe(true);
    expect(verifyAsync).toHaveBeenCalledWith('valid.jwt');
    expect(request.user).toEqual({ id: 'u1', email: 'u@semochal.kr', role: 'admin' });
  });
});

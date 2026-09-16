import { describe, expect, it } from 'vitest';
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Database } from '../../db/drizzle.provider.js';
import { AUTH_COOKIE_NAME } from '../../modules/auth/auth.cookie.js';
import { AuthGuard } from './auth.guard.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { ROLES_KEY } from './roles.decorator.js';

const jwtService = new JwtService({ secret: 'test-secret' });

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  suspendedReason: string | null;
}

const activeUser: UserRow = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'Test User',
  role: 'user',
  status: 'active',
  suspendedReason: null,
};

function dbReturning(rows: UserRow[]): Database {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => rows,
        }),
      }),
    }),
  } as unknown as Database;
}

function reflectorWith(metadata: Record<string, unknown>): Reflector {
  return {
    getAllAndOverride: (key: string) => metadata[key],
  } as unknown as Reflector;
}

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function cookieRequest(token?: string): { headers: Record<string, string>; user?: unknown } {
  return {
    headers: token ? { cookie: `${AUTH_COOKIE_NAME}=${token}` } : {},
  };
}

function guardFor(db: Database, metadata: Record<string, unknown> = {}) {
  return new AuthGuard(jwtService, reflectorWith(metadata), db);
}

async function signToken(overrides: Record<string, unknown> = {}) {
  return jwtService.signAsync({
    sub: activeUser.id,
    email: activeUser.email,
    role: activeUser.role,
    ...overrides,
  });
}

describe('AuthGuard', () => {
  it('passes @Public routes without a token and leaves request.user unset', async () => {
    const request = cookieRequest();
    const guard = guardFor(dbReturning([]), { [IS_PUBLIC_KEY]: true });

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('still verifies the token and attaches request.user on @Public routes when one is present', async () => {
    const request = cookieRequest(await signToken());
    const guard = guardFor(dbReturning([activeUser]), { [IS_PUBLIC_KEY]: true });

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({
      id: activeUser.id,
      email: activeUser.email,
      name: activeUser.name,
      role: activeUser.role,
    });
  });

  it('rejects requests without a token', async () => {
    const guard = guardFor(dbReturning([]));

    await expect(guard.canActivate(contextFor(cookieRequest()))).rejects.toThrow(
      new UnauthorizedException('Authentication required'),
    );
  });

  it('rejects tampered tokens', async () => {
    const guard = guardFor(dbReturning([activeUser]));

    await expect(guard.canActivate(contextFor(cookieRequest('not-a-jwt')))).rejects.toThrow(
      new UnauthorizedException('Invalid or expired session'),
    );
  });

  it('rejects tokens whose payload has no subject', async () => {
    const token = await jwtService.signAsync({ email: activeUser.email, role: activeUser.role });
    const guard = guardFor(dbReturning([activeUser]));

    await expect(guard.canActivate(contextFor(cookieRequest(token)))).rejects.toThrow(
      new UnauthorizedException('Invalid or expired session'),
    );
  });

  it('attaches request.user for a valid token', async () => {
    const request = cookieRequest(await signToken());
    const guard = guardFor(dbReturning([activeUser]));

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({
      id: activeUser.id,
      email: activeUser.email,
      name: activeUser.name,
      role: activeUser.role,
    });
  });

  it('rejects tokens for accounts that no longer exist', async () => {
    const guard = guardFor(dbReturning([]));

    await expect(guard.canActivate(contextFor(cookieRequest(await signToken())))).rejects.toThrow(
      new UnauthorizedException('Account no longer exists'),
    );
  });

  it('rejects suspended accounts with their suspension reason', async () => {
    const suspended = { ...activeUser, status: 'suspended', suspendedReason: 'terms violation' };
    const guard = guardFor(dbReturning([suspended]));

    await expect(guard.canActivate(contextFor(cookieRequest(await signToken())))).rejects.toThrow(
      new ForbiddenException('terms violation'),
    );
  });

  it('rejects suspended accounts without a reason using the default message', async () => {
    const suspended = { ...activeUser, status: 'suspended', suspendedReason: null };
    const guard = guardFor(dbReturning([suspended]));

    await expect(guard.canActivate(contextFor(cookieRequest(await signToken())))).rejects.toThrow(
      new ForbiddenException('Account is suspended'),
    );
  });

  it('enforces @Roles metadata', async () => {
    const guard = guardFor(dbReturning([activeUser]), { [ROLES_KEY]: ['admin'] });

    await expect(guard.canActivate(contextFor(cookieRequest(await signToken())))).rejects.toThrow(
      new ForbiddenException('Insufficient permissions'),
    );
  });

  it('allows requests whose role satisfies @Roles metadata', async () => {
    const admin = { ...activeUser, role: 'admin' };
    const request = cookieRequest(await signToken({ role: 'admin' }));
    const guard = guardFor(dbReturning([admin]), { [ROLES_KEY]: ['admin'] });

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toMatchObject({ role: 'admin' });
  });
});

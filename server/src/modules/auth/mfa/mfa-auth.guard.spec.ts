import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '../../../db/drizzle.provider.js';
import { MfaAuthGuard } from './mfa-auth.guard.js';
import { AUTH_COOKIE_NAME } from '../auth.cookie.js';

function contextFor(request: object): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => class TestController {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function guardWith({
  flow,
  verifyAsync,
  limitRows = [],
}: {
  flow?: string;
  verifyAsync: (token: string) => Promise<unknown>;
  limitRows?: unknown[][];
}) {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(flow),
  } as unknown as Reflector;
  const jwtService = { verifyAsync: vi.fn(verifyAsync) } as unknown as JwtService;
  const limits = limitRows.map((rows) => {
    const limit = vi.fn().mockResolvedValue(rows);
    return { from: vi.fn(() => ({ where: vi.fn(() => ({ limit })) })) };
  });
  const select = vi.fn();
  for (const chain of limits) select.mockReturnValueOnce(chain);
  const db = { select } as unknown as Database;
  return { guard: new MfaAuthGuard(jwtService, reflector, db), jwtService, db };
}

const cookieHeader = (token: string) => ({ headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` } });
const bodyRequest = (body: object) => ({ headers: {}, body });

describe('MfaAuthGuard manage 흐름', () => {
  beforeEach(() => vi.clearAllMocks());

  it('쿠키 없이 manage 엔드포인트에 접근하면 401을 던진다', async () => {
    const { guard } = guardWith({ flow: 'manage', verifyAsync: async () => ({}) });

    await expect(guard.canActivate(contextFor(bodyRequest({})))).rejects.toThrow(
      new UnauthorizedException('로그인이 필요합니다.'),
    );
  });

  it('일반 user 역할의 세션은 관리 엔드포인트를 거부한다(역할 격리)', async () => {
    const { guard } = guardWith({
      flow: 'manage',
      verifyAsync: async () => ({ sub: 'u1', email: 'user@semochal.kr', role: 'user' }),
      limitRows: [[{ name: '회원', role: 'user', suspended: false, withdrawnAt: null }]],
    });

    await expect(guard.canActivate(contextFor(cookieHeader('session-token')))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('admin 세션은 사용자를 부착하고 통과시킨다', async () => {
    const { guard } = guardWith({
      flow: 'manage',
      verifyAsync: async () => ({
        sub: 'a1',
        email: 'admin@semochal.kr',
        role: 'admin',
        mfa: true,
      }),
      limitRows: [[{ name: '관리자', role: 'admin', suspended: false, withdrawnAt: null }]],
    });
    const request = cookieHeader('session-token');

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request).toHaveProperty('user', {
      id: 'a1',
      email: 'admin@semochal.kr',
      name: '관리자',
      role: 'admin',
    });
  });
});

describe('MfaAuthGuard enroll 흐름', () => {
  it('세션 없이 mfa-enroll 토큰으로 등록 엔드포인트에 접근할 수 있다', async () => {
    const { guard } = guardWith({
      flow: 'enroll',
      verifyAsync: async () => ({ sub: 'b1', purpose: 'mfa-enroll' }),
      limitRows: [
        [
          {
            email: 'biz@semochal.kr',
            name: '사업자',
            role: 'business',
            suspended: false,
            withdrawnAt: null,
          },
        ],
      ],
    });
    const request = bodyRequest({ mfaToken: 'enroll-token' });

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request).toHaveProperty('user.role', 'business');
  });

  it('purpose가 다른 토큰(mfa-pending)으로 등록을 거부한다', async () => {
    const { guard } = guardWith({
      flow: 'enroll',
      verifyAsync: async () => ({ sub: 'b1', purpose: 'mfa-pending' }),
    });

    await expect(
      guard.canActivate(contextFor(bodyRequest({ mfaToken: 'pending-token' }))),
    ).rejects.toThrow(new UnauthorizedException('이 요청에 사용할 수 없는 MFA 토큰입니다.'));
  });

  it('다른 사용자의 mfaToken을 써도 DB의 최신 역할을 다시 확인한다', async () => {
    // 토큰의 role 클레임은 admin이지만 DB에선 user로 강등된 경우.
    const { guard } = guardWith({
      flow: 'enroll',
      verifyAsync: async () => ({ sub: 'u1', role: 'admin', purpose: 'mfa-enroll' }),
      limitRows: [
        [
          {
            email: 'user@semochal.kr',
            name: '회원',
            role: 'user',
            suspended: false,
            withdrawnAt: null,
          },
        ],
      ],
    });

    await expect(
      guard.canActivate(contextFor(bodyRequest({ mfaToken: 'stolen-token' }))),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('MfaAuthGuard pending 흐름', () => {
  const dbUser = {
    email: 'admin@semochal.kr',
    name: '관리자',
    role: 'admin',
    suspended: false,
    withdrawnAt: null,
  };
  const usableMethods = [
    [{ userId: 'a1' }], // verified totp
    [], // passkey
    [], // recovery
  ];

  it('유효한 mfa-pending 토큰과 검증 수단이 있으면 통과한다', async () => {
    const { guard } = guardWith({
      flow: 'pending',
      verifyAsync: async () => ({ sub: 'a1', purpose: 'mfa-pending' }),
      limitRows: [[dbUser], ...usableMethods],
    });
    const request = bodyRequest({ mfaToken: 'pending-token', code: '123456' });

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request).toHaveProperty('user.role', 'admin');
  });

  it('토큰이 없거나 위조되면 거부한다', async () => {
    const missing = guardWith({ flow: 'pending', verifyAsync: async () => ({}) });
    await expect(
      missing.guard.canActivate(contextFor(bodyRequest({ code: '123456' }))),
    ).rejects.toThrow(new UnauthorizedException('MFA 토큰이 필요합니다. 다시 로그인해 주세요.'));

    const invalid = guardWith({
      flow: 'pending',
      verifyAsync: async () => {
        throw new Error('expired');
      },
    });
    await expect(
      invalid.guard.canActivate(contextFor(bodyRequest({ mfaToken: 'bad' }))),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('검증 가능한 수단이 없는 계정은 거부한다', async () => {
    const { guard } = guardWith({
      flow: 'pending',
      verifyAsync: async () => ({ sub: 'a1', purpose: 'mfa-pending' }),
      limitRows: [[dbUser], [], [], []],
    });

    await expect(
      guard.canActivate(contextFor(bodyRequest({ mfaToken: 'pending-token' }))),
    ).rejects.toThrow(
      new BadRequestException('등록된 2단계 인증 수단이 없습니다. 먼저 등록해 주세요.'),
    );
  });

  it('정지된 계정과 일반 user 역할은 거부한다', async () => {
    const suspended = guardWith({
      flow: 'pending',
      verifyAsync: async () => ({ sub: 'a1', purpose: 'mfa-pending' }),
      limitRows: [[{ ...dbUser, suspended: true }]],
    });
    await expect(
      suspended.guard.canActivate(contextFor(bodyRequest({ mfaToken: 't' }))),
    ).rejects.toThrow(new ForbiddenException('정지된 계정입니다.'));

    const regular = guardWith({
      flow: 'pending',
      verifyAsync: async () => ({ sub: 'u1', purpose: 'mfa-pending' }),
      limitRows: [[{ ...dbUser, role: 'user' }]],
    });
    await expect(
      regular.guard.canActivate(contextFor(bodyRequest({ mfaToken: 't' }))),
    ).rejects.toThrow(ForbiddenException);
  });
});

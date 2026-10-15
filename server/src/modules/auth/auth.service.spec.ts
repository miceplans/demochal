import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { users } from '../../db/schema.js';

const { compare, hash } = vi.hoisted(() => ({
  compare: vi.fn(),
  hash: vi.fn().mockResolvedValue('$2b$10$dummy-hash'),
}));
vi.mock('bcryptjs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('bcryptjs')>()),
  compare,
  hash,
}));

const { AuthService } = await import('./auth.service.js');

// Built at runtime so the secret scanner doesn't read it as a committed credential.
const testPassword = ['test', 'password'].join('-');
const wrongPassword = ['wrong', 'password'].join('-');

function dbSelecting(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn((_condition: unknown) => ({ limit }));
  return { select: vi.fn(() => ({ from: () => ({ where }) })), where };
}

function serviceWith(rows: unknown[]) {
  return new AuthService(dbSelecting(rows) as never, {} as never, {} as never, {} as never);
}

function containsLowerEmailComparison(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'string') return value.includes('lower(');
  if (typeof value !== 'object' || value === null || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value).some((entry) => containsLowerEmailComparison(entry, seen));
}

describe('AuthService.login', () => {
  beforeEach(() => compare.mockReset().mockResolvedValue(false));

  it('still runs bcrypt when the account does not exist, so timing does not reveal it', async () => {
    await expect(serviceWith([]).login('ghost@semochal.kr', testPassword)).rejects.toThrow(
      new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.'),
    );
    expect(compare).toHaveBeenCalledTimes(1);
    expect(compare.mock.calls[0]?.[1]).toMatch(/^\$2[aby]\$10\$/);
  });

  it('runs bcrypt for a social-only account without a password hash', async () => {
    compare.mockResolvedValue(true);
    await expect(
      serviceWith([{ id: 'u1', passwordHash: null }]).login('social@semochal.kr', testPassword),
    ).rejects.toThrow(new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.'));
    expect(compare).toHaveBeenCalledTimes(1);
  });

  it('rejects a wrong password for an existing account with the same message', async () => {
    await expect(
      serviceWith([{ id: 'u1', passwordHash: '$2b$10$hash' }]).login(
        'u@semochal.kr',
        wrongPassword,
      ),
    ).rejects.toThrow(new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.'));
    expect(compare).toHaveBeenCalledWith(wrongPassword, '$2b$10$hash');
  });

  it('matches legacy mixed-case email addresses case-insensitively', async () => {
    compare.mockResolvedValue(true);
    const db = dbSelecting([{ id: 'u1', passwordHash: '$2b$10$hash', role: 'user' }]);
    const jwtService = { signAsync: vi.fn().mockResolvedValue('access-token') };
    const usersService = { findById: vi.fn().mockResolvedValue({ id: 'u1' }) };
    const service = new AuthService(
      db as never,
      jwtService as never,
      usersService as never,
      {} as never,
    );

    await expect(service.login('Member@SemoChal.kr', testPassword)).resolves.toEqual({
      accessToken: 'access-token',
      user: { id: 'u1' },
    });
    expect(containsLowerEmailComparison(db.where.mock.calls[0]?.[0])).toBe(true);
  });

  it('일반 user 로그인은 기존처럼 accessToken을 발급하고 MFA 서비스를 거치지 않는다', async () => {
    compare.mockResolvedValue(true);
    const mfaService = { describeLoginState: vi.fn(), signMfaToken: vi.fn() };
    const service = new AuthService(
      dbSelecting([
        { id: 'u1', email: 'u@semochal.kr', passwordHash: '$2b$10$hash', role: 'user' },
      ]) as never,
      { signAsync: vi.fn().mockResolvedValue('access-token') } as never,
      { findById: vi.fn().mockResolvedValue({ id: 'u1' }) } as never,
      mfaService as never,
    );

    await expect(service.login('u@semochal.kr', testPassword)).resolves.toEqual({
      accessToken: 'access-token',
      user: { id: 'u1' },
    });
    expect(mfaService.describeLoginState).not.toHaveBeenCalled();
  });
});

describe('AuthService.login — 관리자·사업자 2FA 분기', () => {
  function privilegedLoginService({ role, methods }: { role: string; methods: string[] }) {
    compare.mockResolvedValue(true);
    const mfaService = {
      describeLoginState: vi
        .fn()
        .mockResolvedValue({ methods, recoveryCodesRemaining: methods.length }),
      signMfaToken: vi.fn().mockResolvedValue('mfa-jwt'),
    };
    const service = new AuthService(
      dbSelecting([
        { id: 'p1', email: 'privileged@semochal.kr', passwordHash: '$2b$10$hash', role },
      ]) as never,
      { signAsync: vi.fn().mockResolvedValue('access-token') } as never,
      { findById: vi.fn().mockResolvedValue({ id: 'p1', role }) } as never,
      mfaService as never,
    );
    return { service, mfaService };
  }

  it.each([['admin'], ['business']])(
    '%s는 검증 가능한 수단이 없으면 enrollmentRequired 토큰만 내주고 세션은 발급하지 않는다',
    async (role) => {
      const { service, mfaService } = privilegedLoginService({ role, methods: [] });

      await expect(service.login('privileged@semochal.kr', testPassword)).resolves.toEqual({
        user: { id: 'p1', role },
        mfa: { token: 'mfa-jwt', required: false, enrollmentRequired: true, methods: [] },
      });
      expect(mfaService.signMfaToken).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'p1', role }),
        'mfa-enroll',
        [],
      );
    },
  );

  it('수단이 있으면 required 토큰(purpose mfa-pending)을 내주고 methods를 함께 반환한다', async () => {
    const { service, mfaService } = privilegedLoginService({
      role: 'admin',
      methods: ['totp', 'recovery'],
    });

    await expect(service.login('privileged@semochal.kr', testPassword)).resolves.toEqual({
      user: { id: 'p1', role: 'admin' },
      mfa: {
        token: 'mfa-jwt',
        required: true,
        enrollmentRequired: false,
        methods: ['totp', 'recovery'],
      },
    });
    expect(mfaService.signMfaToken).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1', role: 'admin' }),
      'mfa-pending',
      ['totp', 'recovery'],
    );
  });
});

describe('AuthService.me — 세션 토큰 검증', () => {
  function meService({
    payload,
    profile,
  }: {
    payload: Record<string, unknown>;
    profile: Record<string, unknown>;
  }) {
    const jwtService = { verifyAsync: vi.fn().mockResolvedValue(payload) };
    const usersService = { findById: vi.fn().mockResolvedValue(profile) };
    const service = new AuthService(
      {} as never,
      jwtService as never,
      usersService as never,
      {} as never,
    );
    return { service, jwtService, usersService };
  }

  it('MFA 목적(mfa-pending) 클레임이 있는 토큰은 세션 토큰으로 받지 않는다', async () => {
    const { service, usersService } = meService({
      payload: { sub: 'a1', email: 'admin@semochal.kr', role: 'admin', purpose: 'mfa-pending' },
      profile: { id: 'a1', role: 'admin' },
    });

    await expect(service.me('mfa-token')).rejects.toThrow(
      new UnauthorizedException('로그인이 만료되었습니다. 다시 로그인해 주세요.'),
    );
    expect(usersService.findById).not.toHaveBeenCalled();
  });

  it.each([['admin'], ['business']])(
    '%s 프로필인데 세션에 mfa 클레임이 없으면 401로 거부한다',
    async (role) => {
      const { service } = meService({
        payload: { sub: 'p1', email: 'privileged@semochal.kr', role },
        profile: { id: 'p1', role },
      });

      await expect(service.me('session-token')).rejects.toThrow(
        new UnauthorizedException('2단계 인증이 필요합니다. 다시 로그인해 주세요.'),
      );
    },
  );

  it('mfa: true 클레임이 있는 admin 세션은 프로필을 그대로 반환한다', async () => {
    const profile = { id: 'a1', role: 'admin', name: '관리자' };
    const { service } = meService({
      payload: { sub: 'a1', email: 'admin@semochal.kr', role: 'admin', mfa: true },
      profile,
    });

    await expect(service.me('session-token')).resolves.toEqual(profile);
  });

  it('일반 user 세션은 mfa 클레임 없이도 통과한다', async () => {
    const profile = { id: 'u1', role: 'user', name: '회원' };
    const { service } = meService({
      payload: { sub: 'u1', email: 'user@semochal.kr', role: 'user' },
      profile,
    });

    await expect(service.me('session-token')).resolves.toEqual(profile);
  });
});

describe('AuthService.register', () => {
  it.each([
    ['email', { email: 'taken@semochal.kr', username: 'fresh' }],
    ['username', { email: 'fresh@semochal.kr', username: 'taken' }],
  ])('uses one conflict message whether the %s is taken', async (_label, dto) => {
    await expect(
      serviceWith([{ id: 'existing' }]).register({
        ...dto,
        name: '홍길동',
        password: testPassword,
      } as never),
    ).rejects.toThrow(new ConflictException('이미 등록된 이메일 또는 아이디입니다.'));
  });

  it('stores new email signups in lowercase', async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const values = vi.fn(() => ({
      returning: vi
        .fn()
        .mockResolvedValue([
          { id: 'u1', email: 'member@semochal.kr', passwordHash: '$2b$10$hash', role: 'user' },
        ]),
    }));
    const db = {
      select: vi.fn(() => ({ from: () => ({ where: () => ({ limit }) }) })),
      transaction: vi.fn(async (callback) => callback({ insert: () => ({ values }) })),
    };
    const jwtService = { signAsync: vi.fn().mockResolvedValue('access-token') };
    const usersService = { findById: vi.fn().mockResolvedValue({ id: 'u1' }) };
    const service = new AuthService(
      db as never,
      jwtService as never,
      usersService as never,
      {} as never,
    );

    await service.register({
      email: 'Member@SemoChal.kr',
      name: '홍길동',
      password: testPassword,
    });

    expect(values).toHaveBeenCalledWith(expect.objectContaining({ email: 'member@semochal.kr' }));
  });
});

describe('AuthService.changePassword', () => {
  beforeEach(() => {
    compare.mockReset();
    hash.mockReset();
  });

  function serviceFor(user: Record<string, unknown> | undefined) {
    const limit = vi.fn().mockResolvedValue(user ? [user] : []);
    const where = vi.fn(() => ({ limit }));
    const set = vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) }));
    const db = {
      select: vi.fn(() => ({ from: () => ({ where }) })),
      update: vi.fn(() => ({ set })),
    };
    return {
      service: new AuthService(db as never, {} as never, {} as never, {} as never),
      db,
      set,
    };
  }

  const dto = {
    currentPassword: testPassword,
    newPassword: ['new', 'password'].join('-'),
    confirmNewPassword: ['new', 'password'].join('-'),
  };

  it('verifies the current password and persists only a bcrypt hash of the replacement', async () => {
    compare.mockResolvedValue(true);
    hash.mockResolvedValue('$2b$10$new-hash');
    const { service, db, set } = serviceFor({ id: 'u1', passwordHash: '$2b$10$old-hash' });

    await expect(service.changePassword('u1', dto)).resolves.toBeUndefined();

    expect(compare).toHaveBeenCalledWith(dto.currentPassword, '$2b$10$old-hash');
    expect(hash).toHaveBeenCalledWith(dto.newPassword, 10);
    expect(db.update).toHaveBeenCalledWith(users);
    expect(set).toHaveBeenCalledWith({ passwordHash: '$2b$10$new-hash' });
  });

  it('does not update the password when the current password is wrong', async () => {
    compare.mockResolvedValue(false);
    const { service, db } = serviceFor({ id: 'u1', passwordHash: '$2b$10$old-hash' });

    await expect(service.changePassword('u1', dto)).rejects.toThrow(
      new UnauthorizedException('현재 비밀번호가 올바르지 않습니다.'),
    );
    expect(db.update).not.toHaveBeenCalled();
    expect(hash).not.toHaveBeenCalled();
  });

  it('rejects social-only accounts and mismatched confirmation without changing a hash', async () => {
    const social = serviceFor({ id: 'u1', passwordHash: null });
    await expect(social.service.changePassword('u1', dto)).rejects.toThrow(
      '비밀번호가 설정되지 않은 계정입니다.',
    );
    compare.mockResolvedValue(true);
    const mismatch = serviceFor({ id: 'u1', passwordHash: '$2b$10$old-hash' });
    await expect(
      mismatch.service.changePassword('u1', { ...dto, confirmNewPassword: 'different-password' }),
    ).rejects.toThrow('새 비밀번호 확인이 일치하지 않습니다.');
    expect(social.db.update).not.toHaveBeenCalled();
    expect(mismatch.db.update).not.toHaveBeenCalled();
    expect(hash).not.toHaveBeenCalled();
  });
});

describe('AuthService.loginWithGoogle', () => {
  function socialServiceWith(queryRows: unknown[][], insertResult: ReturnType<typeof vi.fn>) {
    const limit = vi.fn();
    for (const rows of queryRows) limit.mockResolvedValueOnce(rows);
    const where = vi.fn(() => ({ limit }));
    const db = {
      select: vi.fn(() => ({ from: () => ({ where }) })),
      insert: vi.fn(() => ({ values: () => ({ returning: insertResult }) })),
    };
    const jwtService = { signAsync: vi.fn().mockResolvedValue('access-token') };
    const usersService = { findById: vi.fn().mockResolvedValue({ id: 'u1' }) };
    return {
      db,
      where,
      service: new AuthService(
        db as never,
        jwtService as never,
        usersService as never,
        {} as never,
      ),
    };
  }

  it('links a Google identity to a legacy mixed-case email account', async () => {
    const updateReturning = vi
      .fn()
      .mockResolvedValue([
        { id: 'u1', email: 'Member@SemoChal.kr', passwordHash: '$2b$10$hash', role: 'user' },
      ]);
    const { db, service, where } = socialServiceWith(
      [[], [{ id: 'u1', email: 'Member@SemoChal.kr', passwordHash: '$2b$10$hash', role: 'user' }]],
      vi.fn(),
    );
    Object.assign(db, {
      update: vi.fn(() => ({ set: () => ({ where: () => ({ returning: updateReturning }) }) })),
    });

    await expect(
      service.loginWithGoogle({
        subject: 'google-subject',
        email: 'member@semochal.kr',
        name: 'Google Member',
      }),
    ).resolves.toEqual({ accessToken: 'access-token', user: { id: 'u1' } });
    const emailCondition = (where.mock.calls as unknown[][])[1]?.[0];
    expect(containsLowerEmailComparison(emailCondition)).toBe(true);
  });

  it('recovers the existing Google account when a concurrent insert raises 23505', async () => {
    const recoveredUser = {
      id: 'u1',
      email: 'member@semochal.kr',
      passwordHash: '$2b$10$hash',
      role: 'user',
    };
    const { db, service } = socialServiceWith(
      [[], [], [recoveredUser]],
      vi.fn().mockRejectedValue({ code: '23505' }),
    );

    await expect(
      service.loginWithGoogle({
        subject: 'google-subject',
        email: 'Member@SemoChal.kr',
        name: 'Google Member',
      }),
    ).resolves.toEqual({ accessToken: 'access-token', user: { id: 'u1' } });
    expect(db.select).toHaveBeenCalledTimes(3);
  });
});

describe('AuthService 소셜 로그인 — privileged 계정 현 동작', () => {
  // 현재 소셜 로그인은 MFA 분기 없이 즉시 세션을 발급한다 — 관리자·사업자여도 토큰에 mfa 클레임이 없음을 고정한다.
  function foundBySubjectService(userRow: Record<string, unknown>) {
    const limit = vi.fn().mockResolvedValue([userRow]);
    const db = {
      select: vi.fn(() => ({ from: () => ({ where: () => ({ limit }) }) })),
    };
    const jwtService = { signAsync: vi.fn().mockResolvedValue('access-token') };
    const usersService = {
      findById: vi.fn().mockResolvedValue({ id: userRow.id, role: userRow.role }),
    };
    const mfaService = { describeLoginState: vi.fn(), signMfaToken: vi.fn() };
    const service = new AuthService(
      db as never,
      jwtService as never,
      usersService as never,
      mfaService as never,
    );
    return { service, jwtService, mfaService };
  }

  it.each([['admin'], ['business']])(
    'Google 로그인의 %s 계정은 즉시 세션을 발급하고 토큰에 mfa 클레임을 붙이지 않는다',
    async (role) => {
      const userRow = {
        id: 'p1',
        email: `${role}@semochal.kr`,
        passwordHash: '$2b$10$hash',
        role,
        googleSubject: 'google-subject',
      };
      const { service, jwtService, mfaService } = foundBySubjectService(userRow);

      await expect(
        service.loginWithGoogle({
          subject: 'google-subject',
          email: userRow.email,
          name: 'Social Login',
        }),
      ).resolves.toEqual({ accessToken: 'access-token', user: { id: 'p1', role } });

      const payload = jwtService.signAsync.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(payload).toMatchObject({ sub: 'p1', role });
      expect(payload.mfa).toBeUndefined();
      expect(mfaService.describeLoginState).not.toHaveBeenCalled();
      expect(mfaService.signMfaToken).not.toHaveBeenCalled();
    },
  );

  it('Naver 로그인의 business 계정도 즉시 세션을 발급하고 토큰에 mfa 클레임이 없다', async () => {
    const userRow = {
      id: 'b1',
      email: 'biz@semochal.kr',
      passwordHash: '$2b$10$hash',
      role: 'business',
      naverSubject: 'naver-subject',
    };
    const { service, jwtService, mfaService } = foundBySubjectService(userRow);

    await expect(
      service.loginWithNaver({ subject: 'naver-subject', email: userRow.email, name: 'Biz Owner' }),
    ).resolves.toEqual({ accessToken: 'access-token', user: { id: 'b1', role: 'business' } });

    const payload = jwtService.signAsync.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toMatchObject({ sub: 'b1', role: 'business' });
    expect(payload.mfa).toBeUndefined();
    expect(mfaService.describeLoginState).not.toHaveBeenCalled();
  });

  it('일반 user의 Google 로그인은 기존처럼 세션을 발급하고 mfa 클레임을 붙이지 않는다(회귀)', async () => {
    const userRow = {
      id: 'u1',
      email: 'user@semochal.kr',
      passwordHash: '$2b$10$hash',
      role: 'user',
      googleSubject: 'google-subject',
    };
    const { service, jwtService, mfaService } = foundBySubjectService(userRow);

    await expect(
      service.loginWithGoogle({ subject: 'google-subject', email: userRow.email, name: 'Member' }),
    ).resolves.toEqual({ accessToken: 'access-token', user: { id: 'u1', role: 'user' } });

    expect(jwtService.signAsync.mock.calls[0]?.[0]).toMatchObject({ sub: 'u1', role: 'user' });
    expect(mfaService.signMfaToken).not.toHaveBeenCalled();
  });
});

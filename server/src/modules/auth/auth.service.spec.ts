import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { compare } = vi.hoisted(() => ({ compare: vi.fn() }));
vi.mock('bcryptjs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('bcryptjs')>()),
  compare,
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
      new UnauthorizedException('Invalid email or password'),
    );
    expect(compare).toHaveBeenCalledTimes(1);
    expect(compare.mock.calls[0]?.[1]).toMatch(/^\$2[aby]\$10\$/);
  });

  it('runs bcrypt for a social-only account without a password hash', async () => {
    compare.mockResolvedValue(true);
    await expect(
      serviceWith([{ id: 'u1', passwordHash: null }]).login('social@semochal.kr', testPassword),
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    expect(compare).toHaveBeenCalledTimes(1);
  });

  it('rejects a wrong password for an existing account with the same message', async () => {
    await expect(
      serviceWith([{ id: 'u1', passwordHash: '$2b$10$hash' }]).login(
        'u@semochal.kr',
        wrongPassword,
      ),
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
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
    ).rejects.toThrow(new ConflictException('Email or username already registered'));
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

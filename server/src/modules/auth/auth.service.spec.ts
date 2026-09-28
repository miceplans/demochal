import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { compare } = vi.hoisted(() => ({ compare: vi.fn() }));
vi.mock('bcryptjs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('bcryptjs')>()),
  compare,
}));

const { AuthService } = await import('./auth.service.js');

function dbSelecting(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  return { select: vi.fn(() => ({ from: () => ({ where: () => ({ limit }) }) })) };
}

function serviceWith(rows: unknown[]) {
  return new AuthService(dbSelecting(rows) as never, {} as never, {} as never, {} as never);
}

describe('AuthService.login', () => {
  beforeEach(() => compare.mockReset().mockResolvedValue(false));

  it('still runs bcrypt when the account does not exist, so timing does not reveal it', async () => {
    await expect(serviceWith([]).login('ghost@semochal.kr', 'password123')).rejects.toThrow(
      new UnauthorizedException('Invalid email or password'),
    );
    expect(compare).toHaveBeenCalledTimes(1);
    expect(compare.mock.calls[0]?.[1]).toMatch(/^\$2[aby]\$10\$/);
  });

  it('runs bcrypt for a social-only account without a password hash', async () => {
    compare.mockResolvedValue(true);
    await expect(
      serviceWith([{ id: 'u1', passwordHash: null }]).login('social@semochal.kr', 'password123'),
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    expect(compare).toHaveBeenCalledTimes(1);
  });

  it('rejects a wrong password for an existing account with the same message', async () => {
    await expect(
      serviceWith([{ id: 'u1', passwordHash: '$2b$10$hash' }]).login('u@semochal.kr', 'nope1234'),
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    expect(compare).toHaveBeenCalledWith('nope1234', '$2b$10$hash');
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
        password: 'password123',
      } as never),
    ).rejects.toThrow(new ConflictException('Email or username already registered'));
  });
});

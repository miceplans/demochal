import { createHash, createHmac } from 'node:crypto';
import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env.js';
import { ContactVerificationsService, normalizeContact } from './contact-verifications.service.js';

// 서비스와 같은 HMAC(파생 키)로 코드 해시를 재현한다.
const hash = (code: string) =>
  createHmac('sha256', env.contactVerificationCodeSecret).update(code).digest('hex');
const plainSha256 = (code: string) => createHash('sha256').update(code).digest('hex');

function createDb(row: Record<string, unknown> | undefined) {
  const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  const db: any = {
    select: vi.fn().mockReturnValue({
      from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue(row ? [row] : []) }) }),
    }),
    update: vi.fn().mockReturnValue({ set }),
  };
  return { db, set };
}

const pendingRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'cv-1',
  codeHash: hash('123456'),
  attempts: 0,
  expiresAt: new Date(Date.now() + 60_000),
  verifiedAt: null,
  ...overrides,
});

describe('normalizeContact', () => {
  it('lowercases emails and strips phone formatting', () => {
    expect(normalizeContact('email', ' Biz@Semo.KR ')).toBe('biz@semo.kr');
    expect(normalizeContact('phone', '010-1234-5678')).toBe('01012345678');
  });

  it('rejects non-mobile phone numbers', () => {
    expect(() => normalizeContact('phone', '02-123-4567')).toThrow();
  });
});

describe('ContactVerificationsService.confirm', () => {
  it('marks the verification verified when the code matches', async () => {
    const { db, set } = createDb(pendingRow());
    const service = new ContactVerificationsService(db, {} as any);

    await expect(service.confirm('cv-1', '123456')).resolves.toEqual({
      id: 'cv-1',
      verified: true,
    });
    expect(set).toHaveBeenCalledWith({ verifiedAt: expect.any(Date) });
  });

  it('counts a wrong code as an attempt', async () => {
    const { db, set } = createDb(pendingRow({ attempts: 2 }));
    const service = new ContactVerificationsService(db, {} as any);

    await expect(service.confirm('cv-1', '000000')).rejects.toThrow('일치하지 않아요');
    expect(set).toHaveBeenCalledWith({ attempts: 3 });
  });

  it('rejects expired codes and exhausted attempts without checking the code', async () => {
    const expired = new ContactVerificationsService(
      createDb(pendingRow({ expiresAt: new Date(Date.now() - 1) })).db,
      {} as any,
    );
    await expect(expired.confirm('cv-1', '123456')).rejects.toThrow('만료');

    const exhausted = new ContactVerificationsService(
      createDb(pendingRow({ attempts: 5 })).db,
      {} as any,
    );
    await expect(exhausted.confirm('cv-1', '123456')).rejects.toThrow('시도 횟수');
  });
});

describe('ContactVerificationsService.request', () => {
  it('stores the code as a keyed HMAC, not an offline-recoverable plain SHA-256 digest', async () => {
    let storedHash: string | undefined;
    const tx: any = {
      insert: () => ({
        values: (row: { codeHash: string }) => {
          storedHash = row.codeHash;
          return { returning: async () => [{ id: 'cv-1' }] };
        },
      }),
    };
    const db: any = {
      select: vi.fn(() => ({
        from: () => ({ where: () => ({ limit: async () => [] }) }),
      })),
      transaction: vi.fn(async (cb: (txArg: unknown) => unknown) => cb(tx)),
    };
    const outbox = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const service = new ContactVerificationsService(db, outbox as any);

    const { devCode } = await service.request('email', 'biz@semo.kr');

    expect(storedHash).toBe(hash(devCode));
    expect(storedHash).not.toBe(plainSha256(devCode));
    // 파생 키는 JWT 시크릿과 달라야 한다.
    expect(env.contactVerificationCodeSecret.equals(Buffer.from(env.jwtSecret))).toBe(false);
  });

  it.each(['production', 'staging', 'prod'])(
    'refuses to issue a code (and so never returns devCode) when NODE_ENV=%s',
    async (nodeEnv) => {
      const original = env.nodeEnv;
      env.nodeEnv = nodeEnv;
      try {
        const db = { select: vi.fn(), transaction: vi.fn() };
        const service = new ContactVerificationsService(db as any, {} as any);
        await expect(service.request('email', 'biz@semo.kr')).rejects.toBeInstanceOf(
          ServiceUnavailableException,
        );
        expect(db.transaction).not.toHaveBeenCalled();
      } finally {
        env.nodeEnv = original;
      }
    },
  );
});

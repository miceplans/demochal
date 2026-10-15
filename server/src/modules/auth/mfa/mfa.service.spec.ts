import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateSecret, generateSync } from 'otplib';
import { encryptString } from '../../../common/crypto/aead.js';
import { generateRecoveryCode, hashRecoveryCode, MfaService } from './mfa.service.js';

const { compare } = vi.hoisted(() => ({ compare: vi.fn() }));
vi.mock('bcryptjs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('bcryptjs')>()),
  compare,
}));

const {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} = vi.hoisted(() => ({
  generateRegistrationOptions: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}));
vi.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
}));

const { userTotpCredentials, userMfaChallenges } = await import('../../../db/schema.js');

const admin = { id: 'admin-1', email: 'admin@semochal.kr', name: '관리자', role: 'admin' };
const testPassword = ['test', 'password'].join('-');

// ---------------------------------------------------------------- db mocks
// drizzle 체인 목업 — 기존 spec(auth.service.spec.ts 등)과 같은 수동 인스턴스화 패턴.

function selectChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  return {
    from: vi.fn(() => ({ where: vi.fn(() => ({ limit, orderBy: vi.fn(() => ({ limit })) })) })),
  };
}

function selectManyChain(rows: unknown[]) {
  return { from: vi.fn(() => ({ where: vi.fn(() => rows) })) };
}

function insertChain(returningRows: unknown[] = []) {
  const returning = vi.fn().mockResolvedValue(returningRows);
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn((_rows?: unknown) => ({ onConflictDoUpdate, returning }));
  return { insert: vi.fn(() => ({ values })), values, returning, onConflictDoUpdate };
}

function updateChain(returningRows: unknown[] = []) {
  const returning = vi.fn().mockResolvedValue(returningRows);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn((_patch?: unknown) => ({ where }));
  return { update: vi.fn(() => ({ set })), set, where, returning };
}

function deleteChain(returningRows: unknown[] | undefined) {
  const returning = vi.fn().mockResolvedValue(returningRows ?? []);
  const where =
    returningRows === undefined ? vi.fn().mockResolvedValue([]) : vi.fn(() => ({ returning }));
  return { delete: vi.fn(() => ({ where })), where, returning };
}

function makeService(db: unknown) {
  const jwtService = { signAsync: vi.fn().mockResolvedValue('signed-token') };
  const usersService = { findById: vi.fn().mockResolvedValue({ id: admin.id, role: 'admin' }) };
  const service = new MfaService(db as never, jwtService as never, usersService as never);
  return { service, jwtService, usersService };
}

function dbWithSelect(...chains: unknown[]) {
  const select = vi.fn();
  for (const chain of chains) select.mockReturnValueOnce(chain);
  return { select };
}

describe('MfaService TOTP 등록', () => {
  beforeEach(() => vi.clearAllMocks());

  it('setup은 평문 대신 암호문을 저장하고 otpauth URL을 함께 반환한다', async () => {
    const { insert, values, onConflictDoUpdate } = insertChain();
    const db = { insert, ...dbWithSelect(selectChain([]), selectManyChain([])) }; // 미등록 계정
    const { service } = makeService(db);

    const result = await service.setupTotp(admin);

    expect(result.secret).toHaveLength(32);
    expect(result.otpauthUrl.startsWith('otpauth://totp/')).toBe(true);
    expect(result.otpauthUrl).toContain(encodeURIComponent(admin.email));
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: admin.id,
        verifiedAt: null,
        secretCiphertext: expect.not.stringContaining(result.secret),
      }),
    );
    expect(onConflictDoUpdate).toHaveBeenCalled();
  });

  it('이미 수단이 있는 계정은 비밀번호 없이 TOTP·패스키 등록을 시작할 수 없다', async () => {
    const enrolled = () => dbWithSelect(selectChain([{ userId: admin.id }]));
    await expect(makeService(enrolled()).service.setupTotp(admin)).rejects.toThrow(
      new UnauthorizedException('비밀번호 확인이 필요합니다.'),
    );
    await expect(makeService(enrolled()).service.beginPasskeyRegistration(admin)).rejects.toThrow(
      new UnauthorizedException('비밀번호 확인이 필요합니다.'),
    );

    compare.mockResolvedValue(false);
    const wrong = dbWithSelect(
      selectChain([{ userId: admin.id }]),
      selectChain([{ passwordHash: '$2b$10$hash' }]),
    );
    await expect(makeService(wrong).service.setupTotp(admin, 'bad')).rejects.toThrow(
      new UnauthorizedException('비밀번호가 올바르지 않습니다.'),
    );
  });

  it('confirm은 저장된 시크릿으로 코드를 검증해 verifiedAt을 찍고 첫 수단이면 복구 코드 10개를 발급한다', async () => {
    const secret = generateSecret();
    const code = generateSync({ secret });
    const db = dbWithSelect(
      selectChain([
        { userId: admin.id, secretCiphertext: encryptString(secret), verifiedAt: null },
      ]),
      selectChain([]), // hasVerifiedPasskey
    );
    const update = updateChain();
    const insertC = insertChain();
    const fullDb = { ...db, ...update, ...insertC };
    const { service } = makeService(fullDb);

    const result = await service.confirmTotp(admin, code);

    expect(result.firstMethod).toBe(true);
    expect(result.recoveryCodes).toHaveLength(10);
    for (const recoveryCode of result.recoveryCodes ?? []) {
      expect(recoveryCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    }
    // 해시만 저장하고 평문은 저장하지 않는다.
    const savedHashes = insertC.values.mock.calls[0]?.[0] as { codeHash: string }[];
    expect(savedHashes).toHaveLength(10);
    for (const row of savedHashes) {
      expect(result.recoveryCodes?.some((c) => hashRecoveryCode(c) === row.codeHash)).toBe(true);
    }
    expect(update.set).toHaveBeenCalledWith({
      verifiedAt: expect.any(Date),
      lastUsedStep: Math.floor(Date.now() / 1000 / 30),
    });
  });

  it('confirm은 틀린 코드·등록 전 상태·이미 완료된 상태를 거부한다', async () => {
    const secret = generateSecret();
    const wrongCode = generateSync({ secret, epoch: Math.floor(Date.now() / 1000) - 120 });

    const wrong = makeService(
      dbWithSelect(
        selectChain([
          { userId: admin.id, secretCiphertext: encryptString(secret), verifiedAt: null },
        ]),
      ),
    );
    await expect(wrong.service.confirmTotp(admin, wrongCode)).rejects.toThrow(
      new BadRequestException('인증 코드가 올바르지 않습니다.'),
    );

    const missing = makeService(dbWithSelect(selectChain([])));
    await expect(missing.service.confirmTotp(admin, '123456')).rejects.toThrow(
      new BadRequestException('등록 중인 TOTP가 없습니다. 먼저 등록을 시작해 주세요.'),
    );

    const already = makeService(
      dbWithSelect(
        selectChain([
          { userId: admin.id, secretCiphertext: encryptString(secret), verifiedAt: new Date() },
        ]),
      ),
    );
    await expect(already.service.confirmTotp(admin, '123456')).rejects.toThrow(
      new BadRequestException('이미 등록이 완료된 TOTP입니다.'),
    );
  });

  it('confirm은 이미 패스키가 verified 수단이면 복구 코드를 다시 내주지 않는다', async () => {
    const secret = generateSecret();
    const code = generateSync({ secret });
    const db = dbWithSelect(
      selectChain([
        { userId: admin.id, secretCiphertext: encryptString(secret), verifiedAt: null },
      ]),
      selectManyChain([{ id: 'pk-1' }]), // hasVerifiedPasskey
    );
    const fullDb = { ...db, ...updateChain(), ...insertChain() };
    const { service } = makeService(fullDb);

    const result = await service.confirmTotp(admin, code);

    expect(result.firstMethod).toBe(false);
    expect(result.recoveryCodes).toBeNull();
  });
});

describe('MfaService 상태 조회', () => {
  it('totp 상태·패스키 목록·복구 코드 잔량을 함께 반환한다', async () => {
    const db = dbWithSelect(
      selectChain([
        {
          userId: admin.id,
          secretCiphertext: 'v1:x',
          verifiedAt: new Date('2026-10-01T00:00:00Z'),
        },
      ]),
      selectManyChain([{ id: 'pk-1', createdAt: new Date('2026-10-02T00:00:00Z') }]),
      selectManyChain([{ usedAt: null }, { usedAt: new Date() }]),
    );
    const { service } = makeService(db);

    await expect(service.getStatus(admin.id)).resolves.toEqual({
      totp: { status: 'verified', verifiedAt: '2026-10-01T00:00:00.000Z' },
      passkeys: [{ id: 'pk-1', createdAt: '2026-10-02T00:00:00.000Z' }],
      recoveryCodesRemaining: 1,
    });
  });

  it('등록하지 않았으면 unenrolled, 확인 전이면 pending을 반환한다', async () => {
    const unenrolled = makeService(
      dbWithSelect(selectChain([]), selectManyChain([]), selectManyChain([])),
    );
    await expect(unenrolled.service.getStatus(admin.id)).resolves.toMatchObject({
      totp: { status: 'unenrolled', verifiedAt: null },
    });

    const pending = makeService(
      dbWithSelect(
        selectChain([{ userId: admin.id, secretCiphertext: 'v1:x', verifiedAt: null }]),
        selectManyChain([]),
        selectManyChain([]),
      ),
    );
    await expect(pending.service.getStatus(admin.id)).resolves.toMatchObject({
      totp: { status: 'pending' },
    });
  });
});

describe('MfaService 로그인 상태 계산', () => {
  it('verified 수단과 미사용 복구 코드 잔량으로 methods를 구성한다', async () => {
    const db = dbWithSelect(
      selectChain([{ verifiedAt: new Date() }]),
      selectManyChain([{ id: 'pk-1' }]),
      selectManyChain([{ usedAt: null }, { usedAt: new Date() }]),
    );
    const { service } = makeService(db);

    await expect(service.describeLoginState(admin.id)).resolves.toEqual({
      methods: ['totp', 'passkey', 'recovery'],
      recoveryCodesRemaining: 1,
    });
  });

  it('수단이 없으면 빈 methods를 반환한다(enrollmentRequired 분기)', async () => {
    const db = dbWithSelect(selectChain([]), selectManyChain([]), selectManyChain([]));
    const { service } = makeService(db);

    await expect(service.describeLoginState(admin.id)).resolves.toEqual({
      methods: [],
      recoveryCodesRemaining: 0,
    });
  });

  it('signMfaToken은 10분 만료 토큰에 purpose와 methods를 담는다', async () => {
    const { service, jwtService } = makeService({});
    await service.signMfaToken(admin, 'mfa-pending', ['totp']);
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: admin.id, purpose: 'mfa-pending', methods: ['totp'] }),
      { expiresIn: '10m' },
    );
  });
});

describe('MfaService 패스키 등록', () => {
  beforeEach(() => vi.clearAllMocks());

  it('register-options는 기존 패스키를 제외하고 5분 만료 challenge를 저장한다', async () => {
    generateRegistrationOptions.mockResolvedValue({ challenge: 'reg-challenge', pubKey: {} });
    const challengeInsert = insertChain();
    const db = {
      ...dbWithSelect(
        selectChain([]), // hasVerifiedTotp
        selectManyChain([{ id: 'pk-1' }]), // countPasskeys: 이미 패스키가 있어 비밀번호 확인 필요
        selectChain([{ passwordHash: '$2b$10$hash' }]), // assertPassword
        selectManyChain([{ credentialId: 'cred-1', transports: ['usb', 'nfc'] }]),
      ),
      ...deleteChain(undefined),
      ...challengeInsert,
    };
    compare.mockResolvedValue(true);
    const { service } = makeService(db);

    const result = await service.beginPasskeyRegistration(admin, 'pw');

    expect(result.options.challenge).toBe('reg-challenge');
    expect(generateRegistrationOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        rpName: 'Semochal',
        rpID: 'localhost',
        userName: admin.email,
        excludeCredentials: [{ id: 'cred-1', transports: ['usb', 'nfc'] }],
      }),
    );
    expect(challengeInsert.insert).toHaveBeenCalledWith(userMfaChallenges);
    const challengeValues = challengeInsert.values.mock.calls[0]?.[0] as {
      type: string;
      challenge: string;
      expiresAt: Date;
    };
    expect(challengeValues.type).toBe('webauthn-register');
    expect(challengeValues.challenge).toBe('reg-challenge');
    expect(challengeValues.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(5 * 60 * 1000);
  });

  it('register-verify는 challenge를 소비해 자격 증명을 저장하고 첫 수단이면 복구 코드를 발급한다', async () => {
    verifyRegistrationResponse.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: {
          id: 'cred-id',
          publicKey: new Uint8Array([1, 2, 3]),
          counter: 0,
          transports: ['internal'],
        },
      },
    });
    const db = dbWithSelect(
      selectChain([]), // hasVerifiedTotp
      selectManyChain([]), // countPasskeys
      selectChain([{ id: 'ch-1', challenge: 'reg-challenge', usedAt: null }]), // consumeChallenge
    );
    const fullDb = { ...db, ...updateChain([{ id: 'ch-1' }]), ...insertChain([{ id: 'pk-new' }]) };
    const { service } = makeService(fullDb);

    const result = await service.completePasskeyRegistration(admin, {
      id: 'cred-id',
      response: {} as never,
    } as never);

    expect(verifyRegistrationResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedChallenge: 'reg-challenge',
        expectedOrigin: 'http://localhost:3000',
        expectedRPID: 'localhost',
        requireUserVerification: true,
      }),
    );
    expect(result.id).toBe('pk-new');
    expect(result.firstMethod).toBe(true);
    expect(result.recoveryCodes).toHaveLength(10);
  });

  it('register-verify는 challenge 재사용·만료·검증 실패를 거부한다', async () => {
    // 만료/없는 challenge
    const expired = makeService(
      dbWithSelect(selectChain([]), selectManyChain([]), selectChain([])),
    );
    await expect(expired.service.completePasskeyRegistration(admin, {} as never)).rejects.toThrow(
      BadRequestException,
    );

    // 사용 중인 challenge 경쟁 상태(업데이트가 0행)
    verifyRegistrationResponse.mockResolvedValue({ verified: true });
    const raced = dbWithSelect(
      selectChain([]),
      selectManyChain([]),
      selectChain([{ id: 'ch-1', challenge: 'reg-challenge', usedAt: null }]),
    );
    const racedDb = { ...raced, ...updateChain([]) };
    await expect(
      makeService(racedDb).service.completePasskeyRegistration(admin, {} as never),
    ).rejects.toThrow(BadRequestException);

    // 잘못된 origin 등으로 라이브러리 검증 실패
    verifyRegistrationResponse.mockRejectedValue(new Error('origin mismatch'));
    const failed = dbWithSelect(
      selectChain([]),
      selectManyChain([]),
      selectChain([{ id: 'ch-1', challenge: 'reg-challenge', usedAt: null }]),
    );
    const failedDb = { ...failed, ...updateChain([{ id: 'ch-1' }]), ...insertChain() };
    await expect(
      makeService(failedDb).service.completePasskeyRegistration(admin, {} as never),
    ).rejects.toThrow(
      new BadRequestException('패스키 등록을 확인하지 못했습니다. 다시 시도해 주세요.'),
    );
  });
});

describe('MfaService 수단 삭제·복구 코드 재발급', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    compare.mockReset();
  });

  it('비밀번호 확인 후 TOTP를 삭제하고 복구 코드는 남긴다', async () => {
    compare.mockResolvedValue(true);
    const deleteC = deleteChain(undefined);
    const db = { ...dbWithSelect(selectChain([{ passwordHash: '$2b$10$hash' }])), ...deleteC };
    const { service } = makeService(db);

    await expect(service.deleteTotp(admin.id, testPassword)).resolves.toBeUndefined();
    expect(deleteC.delete).toHaveBeenCalledWith(userTotpCredentials);
  });

  it('비밀번호가 틀리면 삭제를 거부한다', async () => {
    compare.mockResolvedValue(false);
    const deleteC = deleteChain(undefined);
    const db = { ...dbWithSelect(selectChain([{ passwordHash: '$2b$10$hash' }])), ...deleteC };
    const { service } = makeService(db);

    await expect(service.deleteTotp(admin.id, 'wrong-password')).rejects.toThrow(
      new UnauthorizedException('비밀번호가 올바르지 않습니다.'),
    );
    expect(deleteC.delete).not.toHaveBeenCalled();
  });

  it('본인 패스키만 삭제할 수 있다(다른 사용자 것은 404)', async () => {
    compare.mockResolvedValue(true);
    const other = {
      ...dbWithSelect(selectChain([{ passwordHash: '$2b$10$hash' }])),
      ...deleteChain([]),
    };
    await expect(
      makeService(other).service.deletePasskey(admin.id, 'pk-other', testPassword),
    ).rejects.toThrow(NotFoundException);

    const own = {
      ...dbWithSelect(selectChain([{ passwordHash: '$2b$10$hash' }])),
      ...deleteChain([{ id: 'pk-own' }]),
    };
    await expect(
      makeService(own).service.deletePasskey(admin.id, 'pk-own', testPassword),
    ).resolves.toBeUndefined();
  });

  it('regenerate는 기존 미사용 코드를 폐기하고 새 10개를 발급한다', async () => {
    compare.mockResolvedValue(true);
    const db = dbWithSelect(selectChain([{ passwordHash: '$2b$10$hash' }]));
    const update = updateChain();
    const insertC = insertChain();
    const fullDb = { ...db, ...update, ...insertC };
    const { service } = makeService(fullDb);

    const codes = await service.regenerateRecoveryCodes(admin.id, testPassword);

    expect(codes).toHaveLength(10);
    expect(update.set).toHaveBeenCalledWith({ usedAt: expect.any(Date) });
    expect(insertC.values.mock.calls[0]?.[0]).toHaveLength(10);
  });
});

describe('MfaService 로그인 검증', () => {
  beforeEach(() => vi.clearAllMocks());

  it('verifyTotpCode는 verified 시크릿으로 코드를 검증해 세션을 발급한다', async () => {
    const secret = generateSecret();
    const code = generateSync({ secret });
    const db = dbWithSelect(
      selectChain([
        { userId: admin.id, secretCiphertext: encryptString(secret), verifiedAt: new Date() },
      ]),
    );
    const update = updateChain([{ userId: admin.id }]);
    const { service, jwtService } = makeService({ ...db, ...update });

    const session = await service.verifyTotpCode(admin, code);
    expect(update.set).toHaveBeenCalledWith({ lastUsedStep: expect.any(Number) });

    expect(session.accessToken).toBe('signed-token');
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: admin.id, role: 'admin', mfa: true }),
    );
    expect(session.user).toEqual({ id: admin.id, role: 'admin' });
  });

  it('verifyTotpCode는 이미 사용한 time-step의 코드 재사용을 거부한다', async () => {
    const secret = generateSecret();
    const code = generateSync({ secret });
    const db = dbWithSelect(
      selectChain([
        { userId: admin.id, secretCiphertext: encryptString(secret), verifiedAt: new Date() },
      ]),
    );
    // 조건부 UPDATE(last_used_step < step)가 0행이면 이미 소비된 코드다.
    const { service, jwtService } = makeService({ ...db, ...updateChain([]) });

    await expect(service.verifyTotpCode(admin, code)).rejects.toThrow(
      new UnauthorizedException('이미 사용된 인증 코드입니다. 다음 코드를 입력해 주세요.'),
    );
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('verifyTotpCode는 틀린 코드와 미등록 상태를 거부한다', async () => {
    const secret = generateSecret();
    const stale = generateSync({ secret, epoch: Math.floor(Date.now() / 1000) - 120 });
    const db = dbWithSelect(
      selectChain([
        { userId: admin.id, secretCiphertext: encryptString(secret), verifiedAt: new Date() },
      ]),
    );
    const { service } = makeService(db);

    await expect(service.verifyTotpCode(admin, stale)).rejects.toThrow(UnauthorizedException);
    await expect(
      makeService(dbWithSelect(selectChain([]))).service.verifyTotpCode(admin, '123456'),
    ).rejects.toThrow(new BadRequestException('등록된 TOTP가 없습니다.'));
  });

  it('auth-options는 등록된 패스키로만 발급하고 단회 challenge를 저장한다', async () => {
    generateAuthenticationOptions.mockResolvedValue({ challenge: 'auth-challenge' });
    const db = {
      ...dbWithSelect(selectManyChain([{ credentialId: 'cred-1', transports: null }])),
      ...insertChain(),
      ...deleteChain(undefined),
    };
    const { service } = makeService(db);

    await expect(service.beginPasskeyAuthentication(admin)).resolves.toEqual({
      options: { challenge: 'auth-challenge' },
    });
    expect(generateAuthenticationOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        rpID: 'localhost',
        allowCredentials: [{ id: 'cred-1', transports: undefined }],
        userVerification: 'required',
      }),
    );

    const empty = makeService(dbWithSelect(selectManyChain([])));
    await expect(empty.service.beginPasskeyAuthentication(admin)).rejects.toThrow(
      new BadRequestException('등록된 패스키가 없습니다.'),
    );
  });

  it('verifyPasskey은 counter를 갱신하고 세션을 발급한다', async () => {
    verifyAuthenticationResponse.mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 42 },
    });
    const stored = {
      id: 'pk-1',
      credentialId: 'cred-id',
      publicKey: Buffer.from([1, 2, 3]).toString('base64url'),
      counter: 1,
      transports: null,
    };
    const db = dbWithSelect(
      selectChain([{ id: 'ch-1', challenge: 'auth-challenge', usedAt: null }]),
      selectChain([stored]),
    );
    const update = updateChain([{ id: 'ch-1' }]);
    const fullDb = { ...db, ...update };
    const { service } = makeService(fullDb);

    const session = await service.verifyPasskey(admin, { id: 'cred-id' } as never);

    expect(verifyAuthenticationResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedChallenge: 'auth-challenge',
        requireUserVerification: true,
        credential: expect.objectContaining({ id: 'cred-id', counter: 1 }),
      }),
    );
    expect(update.set).toHaveBeenCalledWith({ counter: 42 });
    expect(session.accessToken).toBe('signed-token');
  });

  it('verifyPasskey은 등록되지 않은 자격 증명과 검증 실패를 거부한다', async () => {
    const notRegistered = dbWithSelect(
      selectChain([{ id: 'ch-1', challenge: 'auth-challenge', usedAt: null }]),
      selectChain([]),
    );
    const notRegisteredDb = { ...notRegistered, ...updateChain([{ id: 'ch-1' }]) };
    await expect(
      makeService(notRegisteredDb).service.verifyPasskey(admin, { id: 'unknown' } as never),
    ).rejects.toThrow(new UnauthorizedException('등록되지 않은 패스키입니다.'));

    verifyAuthenticationResponse.mockRejectedValue(new Error('origin mismatch'));
    const stored = {
      id: 'pk-1',
      credentialId: 'cred-id',
      publicKey: Buffer.from([1]).toString('base64url'),
      counter: 1,
      transports: null,
    };
    const failed = dbWithSelect(
      selectChain([{ id: 'ch-1', challenge: 'auth-challenge', usedAt: null }]),
      selectChain([stored]),
    );
    const failedDb = { ...failed, ...updateChain([{ id: 'ch-1' }]) };
    await expect(
      makeService(failedDb).service.verifyPasskey(admin, { id: 'cred-id' } as never),
    ).rejects.toThrow(
      new UnauthorizedException('패스키 인증을 확인하지 못했습니다. 다시 시도해 주세요.'),
    );
  });

  it('verifyRecoveryCode는 코드를 즉시 폐기하고 재사용을 거부한다', async () => {
    const code = generateRecoveryCode();
    const db = dbWithSelect(
      selectChain([{ id: 'rc-1', codeHash: hashRecoveryCode(code), usedAt: null }]),
    );
    const update = updateChain([{ id: 'rc-1' }]);
    const fullDb = { ...db, ...update };
    const { service } = makeService(fullDb);

    const session = await service.verifyRecoveryCode(admin, code.toLowerCase());
    expect(session.accessToken).toBe('signed-token');
    expect(update.set).toHaveBeenCalledWith({ usedAt: expect.any(Date) });

    // 경쟁 상태로 이미 사용된 코드는 거부한다.
    const raced = {
      ...dbWithSelect(
        selectChain([{ id: 'rc-1', codeHash: hashRecoveryCode(code), usedAt: null }]),
      ),
      ...updateChain([]),
    };
    await expect(makeService(raced).service.verifyRecoveryCode(admin, code)).rejects.toThrow(
      new UnauthorizedException('복구 코드가 이미 사용되었습니다.'),
    );

    // 존재하지 않는 코드.
    const unknown = dbWithSelect(selectChain([]));
    await expect(
      makeService(unknown).service.verifyRecoveryCode(admin, 'AAAA-BBBB-CCCC'),
    ).rejects.toThrow(new UnauthorizedException('복구 코드가 올바르지 않습니다.'));
  });
});

describe('MfaService TOTP time-step 경계', () => {
  // step 경계(30초 배수)에서 벗어난 고정 시간 — 코드 생성 epoch과 허용 window를 정확히 통제한다.
  const fixedTime = new Date('2026-10-15T00:00:15Z');
  const epochSeconds = Math.floor(fixedTime.getTime() / 1000);
  const currentStep = Math.floor(epochSeconds / 30);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedTime);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function totpService(lastUsedStep: number | null, updateRows: unknown[]) {
    const secret = generateSecret();
    const update = updateChain(updateRows);
    const db = {
      ...dbWithSelect(
        selectChain([
          {
            userId: admin.id,
            secretCiphertext: encryptString(secret),
            verifiedAt: new Date(),
            lastUsedStep,
          },
        ]),
      ),
      ...update,
    };
    const { service, jwtService } = makeService(db);
    return { service, jwtService, update, secret };
  }

  it('직전 time-step(N-1)의 코드는 lastUsedStep이 없을 때 최초 한 번 수용한다', async () => {
    const { service, jwtService, update, secret } = totpService(null, [{ userId: admin.id }]);
    const previousStepCode = generateSync({ secret, epoch: epochSeconds - 30 });

    await expect(service.verifyTotpCode(admin, previousStepCode)).resolves.toMatchObject({
      accessToken: 'signed-token',
    });

    expect(update.set).toHaveBeenCalledWith({ lastUsedStep: currentStep - 1 });
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: admin.id, role: 'admin', mfa: true }),
    );
  });

  it('같은 time-step의 코드를 다시 제출하면 이미 사용됐다고 거부한다', async () => {
    const { service, jwtService, update, secret } = totpService(currentStep - 1, []);
    const previousStepCode = generateSync({ secret, epoch: epochSeconds - 30 });

    await expect(service.verifyTotpCode(admin, previousStepCode)).rejects.toThrow(
      new UnauthorizedException('이미 사용된 인증 코드입니다. 다음 코드를 입력해 주세요.'),
    );
    expect(jwtService.signAsync).not.toHaveBeenCalled();
    expect(update.returning).toHaveBeenCalled();
  });

  it('N-2 time-step의 코드는 허용 window(±1 step)를 벗어나 거부한다', async () => {
    const { service, jwtService, update, secret } = totpService(null, [{ userId: admin.id }]);
    const twoStepsBackCode = generateSync({ secret, epoch: epochSeconds - 60 });

    await expect(service.verifyTotpCode(admin, twoStepsBackCode)).rejects.toThrow(
      new UnauthorizedException('인증 코드가 올바르지 않습니다.'),
    );
    expect(update.update).not.toHaveBeenCalled();
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });
});

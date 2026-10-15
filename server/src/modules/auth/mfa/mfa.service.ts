import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { generateSecret, generateURI, verifySync } from 'otplib';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { compare } from 'bcryptjs';
import { createHash, randomInt } from 'node:crypto';
import { and, desc, eq, gt, isNotNull, isNull, lte } from 'drizzle-orm';
import { env } from '../../../config/env.js';
import { DRIZZLE, type Database } from '../../../db/drizzle.provider.js';
import {
  userMfaChallenges,
  userMfaRecoveryCodes,
  userPasskeyCredentials,
  userTotpCredentials,
  users,
} from '../../../db/schema.js';
import { decryptString, encryptString } from '../../../common/crypto/aead.js';
import { UsersService } from '../../users/users.service.js';
import type { AuthenticatedUser } from '../jwt-auth.guard.js';

export type MfaMethod = 'totp' | 'passkey' | 'recovery';
export type MfaTokenPurpose = 'mfa-pending' | 'mfa-enroll';
export type MfaChallengeType = 'webauthn-register' | 'webauthn-auth';

// window ±1(30초) — 시계 어긋남 한 단계까지만 허용한다.
const TOTP_EPOCH_TOLERANCE_SECONDS = 30;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_GROUP_LENGTH = 4;
const RECOVERY_CODE_GROUPS = 3;
// 시각적 모호 문자(0/O, 1/I) 제외 — 수동 입력 오류를 줄인다.
const RECOVERY_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const PRIVILEGED_ROLES = new Set(['admin', 'business']);

export function isPrivilegedRole(role: string): boolean {
  return PRIVILEGED_ROLES.has(role);
}

export function generateRecoveryCode(): string {
  return Array.from({ length: RECOVERY_CODE_GROUPS }, () =>
    Array.from(
      { length: RECOVERY_CODE_GROUP_LENGTH },
      () => RECOVERY_CODE_ALPHABET[randomInt(RECOVERY_CODE_ALPHABET.length)],
    ).join(''),
  ).join('-');
}

/** 복구 코드는 소문자·하이픈 제거로 정규화한 뒤 sha256 hex만 저장한다(평문·해시 원문 미보관). */
export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code.toLowerCase().replace(/-/g, '')).digest('hex');
}

@Injectable()
export class MfaService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  // ------------------------------------------------------------- login 분기

  /** 로그인 시점의 검증 가능 수단(verified TOTP·패스키·미사용 복구 코드)을 계산한다. */
  async describeLoginState(userId: string): Promise<{
    methods: MfaMethod[];
    recoveryCodesRemaining: number;
  }> {
    const [totpRows, passkeyRows, recoveryRows] = await Promise.all([
      this.db
        .select({ verifiedAt: userTotpCredentials.verifiedAt })
        .from(userTotpCredentials)
        .where(eq(userTotpCredentials.userId, userId))
        .limit(1),
      this.db
        .select({ id: userPasskeyCredentials.id })
        .from(userPasskeyCredentials)
        .where(eq(userPasskeyCredentials.userId, userId)),
      this.db
        .select({ usedAt: userMfaRecoveryCodes.usedAt })
        .from(userMfaRecoveryCodes)
        .where(eq(userMfaRecoveryCodes.userId, userId)),
    ]);
    const methods: MfaMethod[] = [];
    if (totpRows[0]?.verifiedAt) methods.push('totp');
    if (passkeyRows.length > 0) methods.push('passkey');
    const recoveryCodesRemaining = recoveryRows.filter((row) => !row.usedAt).length;
    if (recoveryCodesRemaining > 0) methods.push('recovery');
    return { methods, recoveryCodesRemaining };
  }

  /** 10분 만료 MFA JWT. purpose에 따라 로그인 검증(pending)/등록(enroll) 용도로 제한된다. */
  signMfaToken(
    user: { id: string; email: string | null; role: string },
    purpose: MfaTokenPurpose,
    methods: MfaMethod[],
  ): Promise<string> {
    return this.jwtService.signAsync(
      { sub: user.id, email: user.email ?? '', role: user.role, purpose, methods },
      { expiresIn: '10m' },
    );
  }

  /** MFA 검증·등록 완료 후 발급하는 일반 세션(7일) 쿠키 값과 공개 프로필. */
  async issueSession(user: AuthenticatedUser) {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const publicUser = await this.usersService.findById(user.id);
    return { accessToken, user: publicUser };
  }

  // --------------------------------------------------------- 수단 관리·등록

  /** 새 TOTP 시크릿을 발급해 pending 상태로 저장한다. 평문 시크릿은 이 응답에만 한 번 노출된다. */
  async setupTotp(user: AuthenticatedUser) {
    const secret = generateSecret();
    const secretCiphertext = encryptString(secret);
    await this.db
      .insert(userTotpCredentials)
      .values({ userId: user.id, secretCiphertext, verifiedAt: null })
      .onConflictDoUpdate({
        target: userTotpCredentials.userId,
        set: { secretCiphertext, verifiedAt: null },
      });
    return {
      secret,
      otpauthUrl: generateURI({ issuer: env.webauthnRpName, label: user.email, secret }),
    };
  }

  /**
   * 저장된 pending 시크릿으로 첫 코드를 검증해 등록을 완료한다.
   * 첫 번째 verified 수단이면 복구 코드 10개를 만들어 반환한다(평문은 이 응답에만 노출).
   */
  async confirmTotp(user: AuthenticatedUser, code: string) {
    const [row] = await this.db
      .select()
      .from(userTotpCredentials)
      .where(eq(userTotpCredentials.userId, user.id))
      .limit(1);
    if (!row)
      throw new BadRequestException('등록 중인 TOTP가 없습니다. 먼저 등록을 시작해 주세요.');
    if (row.verifiedAt) throw new BadRequestException('이미 등록이 완료된 TOTP입니다.');

    const secret = decryptString(row.secretCiphertext);
    if (!verifyTotpCode(secret, code)) {
      throw new BadRequestException('인증 코드가 올바르지 않습니다.');
    }
    await this.db
      .update(userTotpCredentials)
      .set({ verifiedAt: new Date() })
      .where(eq(userTotpCredentials.userId, user.id));

    const firstMethod = !(await this.hasVerifiedPasskey(user.id));
    const recoveryCodes = firstMethod ? await this.generateRecoveryCodes(user.id) : null;
    return { recoveryCodes, firstMethod };
  }

  async getStatus(userId: string) {
    const [totpRows, passkeys, recoveryRows] = await Promise.all([
      this.db
        .select()
        .from(userTotpCredentials)
        .where(eq(userTotpCredentials.userId, userId))
        .limit(1),
      this.db
        .select({ id: userPasskeyCredentials.id, createdAt: userPasskeyCredentials.createdAt })
        .from(userPasskeyCredentials)
        .where(eq(userPasskeyCredentials.userId, userId)),
      this.db
        .select({ usedAt: userMfaRecoveryCodes.usedAt })
        .from(userMfaRecoveryCodes)
        .where(eq(userMfaRecoveryCodes.userId, userId)),
    ]);
    const totp = totpRows[0];
    return {
      totp: {
        status: !totp ? 'unenrolled' : totp.verifiedAt ? 'verified' : 'pending',
        verifiedAt: totp?.verifiedAt?.toISOString() ?? null,
      },
      passkeys: passkeys.map(({ id, createdAt }) => ({ id, createdAt: createdAt.toISOString() })),
      recoveryCodesRemaining: recoveryRows.filter((row) => !row.usedAt).length,
    };
  }

  async beginPasskeyRegistration(user: AuthenticatedUser) {
    const existing = await this.db
      .select({
        credentialId: userPasskeyCredentials.credentialId,
        transports: userPasskeyCredentials.transports,
      })
      .from(userPasskeyCredentials)
      .where(eq(userPasskeyCredentials.userId, user.id));
    const options = await generateRegistrationOptions({
      rpName: env.webauthnRpName,
      rpID: env.webauthnRpId,
      userID: Buffer.from(user.id, 'utf8'),
      userName: user.email,
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
      excludeCredentials: existing.map((credential) => ({
        id: credential.credentialId,
        transports: credential.transports ?? undefined,
      })),
    });
    await this.storeChallenge(user.id, 'webauthn-register', options.challenge);
    return { options };
  }

  async completePasskeyRegistration(user: AuthenticatedUser, credential: RegistrationResponseJSON) {
    const hadOtherMethod =
      (await this.hasVerifiedTotp(user.id)) || (await this.countPasskeys(user.id)) > 0;
    const expectedChallenge = await this.consumeChallenge(user.id, 'webauthn-register');

    let registrationInfo;
    try {
      const result = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge,
        expectedOrigin: env.webauthnRpOrigin,
        expectedRPID: env.webauthnRpId,
        requireUserVerification: false,
      });
      if (!result.verified) throw new Error('registration not verified');
      registrationInfo = result.registrationInfo;
    } catch {
      throw new BadRequestException('패스키 등록을 확인하지 못했습니다. 다시 시도해 주세요.');
    }

    const webauthnCredential = registrationInfo.credential;
    const [saved] = await this.db
      .insert(userPasskeyCredentials)
      .values({
        userId: user.id,
        credentialId: webauthnCredential.id,
        publicKey: Buffer.from(webauthnCredential.publicKey).toString('base64url'),
        counter: webauthnCredential.counter,
        transports: webauthnCredential.transports ?? null,
      })
      .returning({ id: userPasskeyCredentials.id });

    const firstMethod = !hadOtherMethod;
    const recoveryCodes = firstMethod ? await this.generateRecoveryCodes(user.id) : null;
    return { id: saved!.id, recoveryCodes, firstMethod };
  }

  /** TOTP 삭제 — 복구 코드는 유지한다(다른 수단이 남아 있을 수 있다). */
  async deleteTotp(userId: string, password: string) {
    await this.assertPassword(userId, password);
    await this.db.delete(userTotpCredentials).where(eq(userTotpCredentials.userId, userId));
  }

  async deletePasskey(userId: string, passkeyId: string, password: string) {
    await this.assertPassword(userId, password);
    const deleted = await this.db
      .delete(userPasskeyCredentials)
      .where(
        and(eq(userPasskeyCredentials.id, passkeyId), eq(userPasskeyCredentials.userId, userId)),
      )
      .returning({ id: userPasskeyCredentials.id });
    if (deleted.length === 0) throw new NotFoundException('패스키를 찾을 수 없습니다.');
  }

  /** 기존 미사용 복구 코드를 전부 폐기한 뒤 새 10개를 발급한다. 평문은 이 응답에만 노출. */
  async regenerateRecoveryCodes(userId: string, password: string): Promise<string[]> {
    await this.assertPassword(userId, password);
    await this.db
      .update(userMfaRecoveryCodes)
      .set({ usedAt: new Date() })
      .where(and(eq(userMfaRecoveryCodes.userId, userId), isNull(userMfaRecoveryCodes.usedAt)));
    return this.generateRecoveryCodes(userId);
  }

  // ------------------------------------------------------------ 로그인 검증

  async verifyTotpCode(user: AuthenticatedUser, code: string) {
    const [row] = await this.db
      .select()
      .from(userTotpCredentials)
      .where(
        and(eq(userTotpCredentials.userId, user.id), isNotNull(userTotpCredentials.verifiedAt)),
      )
      .limit(1);
    if (!row) throw new BadRequestException('등록된 TOTP가 없습니다.');
    const secret = decryptString(row.secretCiphertext);
    if (!verifyTotpCode(secret, code)) {
      throw new UnauthorizedException('인증 코드가 올바르지 않습니다.');
    }
    return this.issueSession(user);
  }

  async beginPasskeyAuthentication(user: AuthenticatedUser) {
    const passkeys = await this.db
      .select()
      .from(userPasskeyCredentials)
      .where(eq(userPasskeyCredentials.userId, user.id));
    if (passkeys.length === 0) throw new BadRequestException('등록된 패스키가 없습니다.');
    const options = await generateAuthenticationOptions({
      rpID: env.webauthnRpId,
      allowCredentials: passkeys.map((credential) => ({
        id: credential.credentialId,
        transports: credential.transports ?? undefined,
      })),
      userVerification: 'preferred',
    });
    await this.storeChallenge(user.id, 'webauthn-auth', options.challenge);
    return { options };
  }

  async verifyPasskey(user: AuthenticatedUser, credential: AuthenticationResponseJSON) {
    const expectedChallenge = await this.consumeChallenge(user.id, 'webauthn-auth');
    const [stored] = await this.db
      .select()
      .from(userPasskeyCredentials)
      .where(
        and(
          eq(userPasskeyCredentials.userId, user.id),
          eq(userPasskeyCredentials.credentialId, credential.id),
        ),
      )
      .limit(1);
    if (!stored) throw new UnauthorizedException('등록되지 않은 패스키입니다.');

    let authenticationInfo;
    try {
      const result = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge,
        expectedOrigin: env.webauthnRpOrigin,
        expectedRPID: env.webauthnRpId,
        credential: {
          id: stored.credentialId,
          publicKey: Buffer.from(stored.publicKey, 'base64url'),
          counter: stored.counter,
          transports: stored.transports ?? undefined,
        },
        requireUserVerification: false,
      });
      if (!result.verified) throw new Error('authentication not verified');
      authenticationInfo = result.authenticationInfo;
    } catch {
      throw new UnauthorizedException('패스키 인증을 확인하지 못했습니다. 다시 시도해 주세요.');
    }

    await this.db
      .update(userPasskeyCredentials)
      .set({ counter: authenticationInfo.newCounter })
      .where(eq(userPasskeyCredentials.id, stored.id));
    return this.issueSession(user);
  }

  /** 복구 코드는 단회용 — 사용 즉시 usedAt을 찍어 원자적으로 폐기한다. */
  async verifyRecoveryCode(user: AuthenticatedUser, code: string) {
    const [row] = await this.db
      .select()
      .from(userMfaRecoveryCodes)
      .where(
        and(
          eq(userMfaRecoveryCodes.codeHash, hashRecoveryCode(code)),
          isNull(userMfaRecoveryCodes.usedAt),
        ),
      )
      .limit(1);
    if (!row) throw new UnauthorizedException('복구 코드가 올바르지 않습니다.');
    const consumed = await this.db
      .update(userMfaRecoveryCodes)
      .set({ usedAt: new Date() })
      .where(and(eq(userMfaRecoveryCodes.id, row.id), isNull(userMfaRecoveryCodes.usedAt)))
      .returning({ id: userMfaRecoveryCodes.id });
    if (consumed.length === 0) {
      throw new UnauthorizedException('복구 코드가 이미 사용되었습니다.');
    }
    return this.issueSession(user);
  }

  // ---------------------------------------------------------------- helpers

  private async assertPassword(userId: string, password: string) {
    const [user] = await this.db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user?.passwordHash || !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException('비밀번호가 올바르지 않습니다.');
    }
  }

  private async hasVerifiedTotp(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ userId: userTotpCredentials.userId })
      .from(userTotpCredentials)
      .where(and(eq(userTotpCredentials.userId, userId), isNotNull(userTotpCredentials.verifiedAt)))
      .limit(1);
    return Boolean(row);
  }

  private async hasVerifiedPasskey(userId: string): Promise<boolean> {
    return (await this.countPasskeys(userId)) > 0;
  }

  private async countPasskeys(userId: string): Promise<number> {
    const rows = await this.db
      .select({ id: userPasskeyCredentials.id })
      .from(userPasskeyCredentials)
      .where(eq(userPasskeyCredentials.userId, userId));
    return rows.length;
  }

  private async generateRecoveryCodes(userId: string): Promise<string[]> {
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => generateRecoveryCode());
    await this.db
      .insert(userMfaRecoveryCodes)
      .values(codes.map((code) => ({ userId, codeHash: hashRecoveryCode(code) })));
    return codes;
  }

  private async storeChallenge(userId: string, type: MfaChallengeType, challenge: string) {
    // 같은 사용자·같은 유형의 만료 challenge만 정리한다(사용 중인 것은 건드리지 않는다).
    await this.db
      .delete(userMfaChallenges)
      .where(
        and(
          eq(userMfaChallenges.userId, userId),
          eq(userMfaChallenges.type, type),
          lte(userMfaChallenges.expiresAt, new Date()),
        ),
      );
    await this.db.insert(userMfaChallenges).values({
      userId,
      type,
      challenge,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    });
  }

  /** 단회 challenge를 원자적으로 소비한다(만료·재사용 거부). 반환값은 검증용 challenge 문자열. */
  private async consumeChallenge(userId: string, type: MfaChallengeType): Promise<string> {
    const [row] = await this.db
      .select()
      .from(userMfaChallenges)
      .where(
        and(
          eq(userMfaChallenges.userId, userId),
          eq(userMfaChallenges.type, type),
          isNull(userMfaChallenges.usedAt),
          gt(userMfaChallenges.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(userMfaChallenges.createdAt))
      .limit(1);
    if (!row) {
      throw new BadRequestException('인증 요청이 만료되었거나 없습니다. 다시 시도해 주세요.');
    }
    const consumed = await this.db
      .update(userMfaChallenges)
      .set({ usedAt: new Date() })
      .where(and(eq(userMfaChallenges.id, row.id), isNull(userMfaChallenges.usedAt)))
      .returning({ id: userMfaChallenges.id });
    if (consumed.length === 0) {
      throw new BadRequestException('인증 요청이 만료되었거나 없습니다. 다시 시도해 주세요.');
    }
    return row.challenge;
  }
}

function verifyTotpCode(secret: string, code: string): boolean {
  try {
    return verifySync({ secret, token: code, epochTolerance: TOTP_EPOCH_TOLERANCE_SECONDS }).valid;
  } catch {
    return false;
  }
}

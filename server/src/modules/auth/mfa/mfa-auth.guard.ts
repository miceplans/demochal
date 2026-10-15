import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import type { Request } from 'express';
import { DRIZZLE, type Database } from '../../../db/drizzle.provider.js';
import { userMfaRecoveryCodes, userPasskeyCredentials, userTotpCredentials, users } from '../../../db/schema.js';
import { getAuthToken } from '../auth.cookie.js';
import { JwtAuthGuard, type AuthenticatedRequest, type AuthenticatedUser } from '../jwt-auth.guard.js';
import { isPrivilegedRole, type MfaTokenPurpose } from './mfa.service.js';
import { MFA_FLOW_KEY, type MfaFlowKind } from './mfa-flow.decorator.js';

interface MfaTokenPayload {
  sub: string;
  email?: string;
  role?: string;
  purpose?: string;
  methods?: string[];
}

/**
 * MFA 엔드포인트 전용 가드. 컨트롤러는 전역 JwtAuthGuard를 물리화하기 위해 @Public()이므로
 * 여기서 흐름(manage/enroll/pending)에 따라 쿠키 세션 또는 body의 mfaToken을 직접 검증한다.
 * 모든 검증은 DB의 최신 상태(역할·정지·탈퇴·수단 존재 여부)를 기준으로 한다.
 */
@Injectable()
export class MfaAuthGuard extends JwtAuthGuard {
  constructor(
    private readonly mfaJwtService: JwtService,
    private readonly mfaReflector: Reflector,
    @Inject(DRIZZLE) private readonly mfaDb: Database,
  ) {
    super(mfaJwtService, mfaReflector, mfaDb);
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const flow =
      this.mfaReflector.getAllAndOverride<MfaFlowKind>(MFA_FLOW_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'manage';
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & { body?: Record<string, unknown> }>();

    if (flow !== 'pending') {
      if (getAuthToken(request as Request)) {
        // 쿠키가 있으면 세션 검증을 그대로 재사용한다(만료 401·정지 403을 그대로 전달).
        await this.attachUser(request);
        if (!isPrivilegedRole(request.user.role)) {
          throw new ForbiddenException('관리자·사업자 계정에서만 2단계 인증을 사용할 수 있습니다.');
        }
        return true;
      }
      if (flow === 'manage') throw new UnauthorizedException('로그인이 필요합니다.');
    }

    const purpose: MfaTokenPurpose = flow === 'pending' ? 'mfa-pending' : 'mfa-enroll';
    const payload = await this.verifyMfaToken(request, purpose);
    const user = await this.loadActivePrivilegedUser(payload.sub);
    if (flow === 'pending') await this.assertUsableMethod(user.id);
    request.user = user;
    return true;
  }

  private async verifyMfaToken(
    request: AuthenticatedRequest & { body?: Record<string, unknown> },
    expectedPurpose: MfaTokenPurpose,
  ): Promise<MfaTokenPayload> {
    const token = request.body?.mfaToken;
    if (typeof token !== 'string' || !token) {
      throw new UnauthorizedException('MFA 토큰이 필요합니다. 다시 로그인해 주세요.');
    }
    let payload: MfaTokenPayload;
    try {
      payload = await this.mfaJwtService.verifyAsync<MfaTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('MFA 토큰이 만료되었거나 올바르지 않습니다. 다시 로그인해 주세요.');
    }
    if (!payload.sub || payload.purpose !== expectedPurpose) {
      throw new UnauthorizedException('이 요청에 사용할 수 없는 MFA 토큰입니다.');
    }
    return payload;
  }

  /** 토큰 주장을 믿지 않고 DB에서 최신 역할·상태를 다시 확인한다. */
  private async loadActivePrivilegedUser(userId: string): Promise<AuthenticatedUser> {
    const [user] = await this.mfaDb
      .select({
        email: users.email,
        name: users.name,
        role: users.role,
        suspended: users.suspended,
        withdrawnAt: users.withdrawnAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user || user.withdrawnAt) throw new UnauthorizedException('존재하지 않는 계정입니다.');
    if (user.suspended) throw new ForbiddenException('정지된 계정입니다.');
    if (!isPrivilegedRole(user.role)) {
      throw new ForbiddenException('관리자·사업자 계정만 2단계 인증을 사용할 수 있습니다.');
    }
    return {
      id: userId,
      email: user.email ?? '',
      name: user.name ?? '탈퇴한 사용자',
      role: user.role,
    };
  }

  /** 로그인 검증(pending)은 검증 가능한 수단(verified TOTP·패스키·미사용 복구 코드)이 있을 때만 허용한다. */
  private async assertUsableMethod(userId: string) {
    const [totp, passkey, recovery] = await Promise.all([
      this.mfaDb
        .select({ userId: userTotpCredentials.userId })
        .from(userTotpCredentials)
        .where(and(eq(userTotpCredentials.userId, userId), isNotNull(userTotpCredentials.verifiedAt)))
        .limit(1),
      this.mfaDb
        .select({ id: userPasskeyCredentials.id })
        .from(userPasskeyCredentials)
        .where(eq(userPasskeyCredentials.userId, userId))
        .limit(1),
      this.mfaDb
        .select({ id: userMfaRecoveryCodes.id })
        .from(userMfaRecoveryCodes)
        .where(and(eq(userMfaRecoveryCodes.userId, userId), isNull(userMfaRecoveryCodes.usedAt)))
        .limit(1),
    ]);
    if (!totp[0] && !passkey[0] && !recovery[0]) {
      throw new BadRequestException('등록된 2단계 인증 수단이 없습니다. 먼저 등록해 주세요.');
    }
  }
}

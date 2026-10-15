import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { users } from '../../db/schema.js';
import { getAuthToken } from './auth.cookie.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  /** MFA 토큰(mfa-pending/mfa-enroll)의 용도 클레임. 세션으로는 절대 받아들이지 않는다. */
  purpose?: string;
  /** 2단계 인증을 마친 세션에만 붙는다. admin/business 세션은 이 값이 필수다. */
  mfa?: boolean;
}

/** 2FA가 강제되는 역할(MfaService.isPrivilegedRole과 동일). */
export function requiresMfaSession(role: string): boolean {
  return role === 'admin' || role === 'business';
}

export type AuthenticatedRequest = Request & { user: AuthenticatedUser };

/** Verifies the signed, HttpOnly-cookie session token; never trusts client-provided IDs. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    @Inject(DRIZZLE) private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    await this.attachUser(request);
    return true;
  }

  /** Verifies the session cookie and populates request.user; throws 401/403 on failure. */
  protected async attachUser(request: Request): Promise<void> {
    const token = getAuthToken(request);
    if (!token) throw new UnauthorizedException('로그인이 필요합니다.');

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      if (!payload.sub || !payload.email || !payload.role) throw new Error('Invalid token payload');
      // MFA 토큰은 같은 시크릿으로 서명되므로 용도 클레임이 있으면 세션으로 쓸 수 없다.
      if (payload.purpose) throw new Error('MFA token is not a session token');
    } catch {
      throw new UnauthorizedException('로그인이 만료되었습니다. 다시 로그인해 주세요.');
    }

    // Re-checked on every request (not just at login) so suspending an account
    // or revoking a role takes effect immediately for tokens issued before the change.
    const [user] = await this.db
      .select({
        name: users.name,
        role: users.role,
        suspended: users.suspended,
        suspendedReason: users.suspendedReason,
        withdrawnAt: users.withdrawnAt,
      })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);
    if (!user || user.withdrawnAt) throw new UnauthorizedException('존재하지 않는 계정입니다.');
    if (user.suspended) {
      throw new ForbiddenException(user.suspendedReason ?? '정지된 계정입니다.');
    }

    // 비밀번호만으로(또는 2FA 도입 전/소셜 로그인으로) 발급된 세션은 admin/business 권한을 얻지 못한다.
    // TODO(2FA): 2단계 인증 강제 임시 비활성화.
    // if (requiresMfaSession(user.role) && payload.mfa !== true) {
    //   throw new UnauthorizedException('2단계 인증이 필요합니다. 다시 로그인해 주세요.');
    // }

    (request as AuthenticatedRequest).user = {
      id: payload.sub,
      email: payload.email,
      name: user.name ?? '탈퇴한 사용자',
      // The token's role claim is a snapshot from login; the DB row is authoritative.
      role: user.role,
    };
  }
}

/**
 * Attaches request.user when a valid session cookie is present, but never
 * rejects. For @Public() routes that should still recognize logged-in users
 * (e.g. public team detail visible to its members) — the global JwtAuthGuard
 * skips token parsing on @Public() routes, so without this guard request.user
 * would stay unset even for valid sessions.
 */
@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    try {
      await this.attachUser(request);
    } catch {
      // No or invalid token on an optional-auth route: proceed anonymously.
    }
    return true;
  }
}

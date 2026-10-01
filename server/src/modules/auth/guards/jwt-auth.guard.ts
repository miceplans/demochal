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
import { DRIZZLE, type Database } from '../../../infra/db/drizzle.provider.js';
import { users } from '../../../infra/db/schema.js';
import { getAuthToken } from '../utils/auth.cookie.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

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
    const token = getAuthToken(request);
    if (!token) throw new UnauthorizedException('Missing authentication cookie');

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      if (!payload.sub || !payload.email || !payload.role) throw new Error('Invalid token payload');
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
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
    if (!user || user.withdrawnAt) throw new UnauthorizedException('User no longer exists');
    if (user.suspended) {
      throw new ForbiddenException(user.suspendedReason ?? '정지된 계정입니다.');
    }

    (request as AuthenticatedRequest).user = {
      id: payload.sub,
      email: payload.email,
      name: user.name ?? '탈퇴한 사용자',
      // The token's role claim is a snapshot from login; the DB row is authoritative.
      role: user.role,
    };
    return true;
  }
}

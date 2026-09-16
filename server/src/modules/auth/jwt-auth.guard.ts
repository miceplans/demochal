import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { users } from '../../db/schema.js';
import { getAuthToken } from './auth.cookie.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
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
    @Inject(DRIZZLE) private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
    // takes effect immediately for tokens issued before the suspension.
    const [user] = await this.db
      .select({ suspended: users.suspended, suspendedReason: users.suspendedReason })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);
    if (!user) throw new UnauthorizedException('User no longer exists');
    if (user.suspended) {
      throw new ForbiddenException(user.suspendedReason ?? '정지된 계정입니다.');
    }

    (request as AuthenticatedRequest).user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    return true;
  }
}

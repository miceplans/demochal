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
import { getAuthToken } from '../../modules/auth/auth.cookie.js';
import type { AuthUser } from './current-user.decorator.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { ROLES_KEY } from './roles.decorator.js';

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
}

// Global guard: verifies the signed JWT from the HttpOnly auth cookie with the
// shared JwtService, then reloads the user from the DB so role changes and
// suspensions take effect immediately.
@Injectable()
export class AuthGuard implements CanActivate {
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
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = getAuthToken(request);
    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('Authentication required');
    }

    let payload: TokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<TokenPayload>(token);
      if (!payload.sub) throw new Error('Invalid token payload');
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }

    const [user] = await this.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        status: users.status,
        suspendedReason: users.suspendedReason,
      })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);
    if (!user) throw new UnauthorizedException('Account no longer exists');
    if (user.status === 'suspended') {
      throw new ForbiddenException(user.suspendedReason ?? 'Account is suspended');
    }

    if (requiredRoles && !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    request.user = { id: user.id, email: user.email, name: user.name, role: user.role };
    return true;
  }
}

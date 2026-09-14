import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { users } from '../../db/schema.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { ROLES_KEY } from './roles.decorator.js';
import { extractSessionToken } from './session.js';
import { verifySessionToken } from './jwt.js';
import type { AuthUser } from './current-user.decorator.js';

// Global guard: JWT from the HttpOnly session cookie (or Authorization
// Bearer), loaded fresh from the DB so role changes and suspensions take
// effect immediately. Replaces the x-user-id header prototype.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
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
    const token = extractSessionToken(request);
    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('Authentication required');
    }

    const payload = verifySessionToken(token);
    if (!payload) throw new UnauthorizedException('Invalid or expired session');

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

    request.user = user;
    return true;
  }
}

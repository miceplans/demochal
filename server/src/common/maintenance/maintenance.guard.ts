import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { users } from '../../db/schema.js';
import { AdminSettingsService } from '../../modules/admin/admin-settings.service.js';
import { getAuthToken } from '../../modules/auth/auth.cookie.js';
import type { AuthenticatedRequest } from '../../modules/auth/jwt-auth.guard.js';

// Authentication entry points must remain reachable while maintenance mode is
// enabled. In particular, Google's redirect is a new browser request and
// cannot complete if it is forced through the settings database first.
const EXEMPT_PATHS = new Set([
  '/health',
  '/auth/login',
  '/auth/me',
  '/auth/google',
  '/auth/google/callback',
]);

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private readonly adminSettingsService: AdminSettingsService,
    private readonly jwtService: JwtService,
    @Inject(DRIZZLE) private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (
      EXEMPT_PATHS.has(request.path) ||
      !(await this.adminSettingsService.isEnabled('maintenanceMode'))
    ) {
      return true;
    }

    if (await this.isAdmin(request)) return true;
    throw new ServiceUnavailableException('서비스 점검 중입니다. 잠시 후 다시 이용해 주세요.');
  }

  // The token's role claim is a login-time snapshot, so the bypass checks the DB
  // role: JwtAuthGuard already loaded it on protected routes, public ones look it up.
  private async isAdmin(request: Request): Promise<boolean> {
    const authenticated = (request as Partial<AuthenticatedRequest>).user;
    if (authenticated) return authenticated.role === 'admin';

    const token = getAuthToken(request);
    if (!token) return false;
    let userId: string | undefined;
    try {
      userId = (await this.jwtService.verifyAsync<{ sub?: string }>(token)).sub;
    } catch {
      // A malformed session is not an administrator bypass.
    }
    if (!userId) return false;
    const [user] = await this.db
      .select({ role: users.role, suspended: users.suspended })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user?.role === 'admin' && !user.suspended;
  }
}

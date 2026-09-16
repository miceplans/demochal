import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AdminSettingsService } from '../../modules/admin/admin-settings.service.js';
import { getAuthToken } from '../../modules/auth/auth.cookie.js';

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
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (
      EXEMPT_PATHS.has(request.path) ||
      !(await this.adminSettingsService.isEnabled('maintenanceMode'))
    ) {
      return true;
    }

    const token = getAuthToken(request);
    if (token) {
      try {
        const payload = await this.jwtService.verifyAsync<{ role?: string }>(token);
        if (payload.role === 'admin') return true;
      } catch {
        // A malformed session is not an administrator bypass.
      }
    }
    throw new ServiceUnavailableException('Service is under maintenance');
  }
}

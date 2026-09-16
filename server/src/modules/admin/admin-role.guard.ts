import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';

// Apply after JwtAuthGuard (`@UseGuards(JwtAuthGuard, AdminRoleGuard)`) — this only checks
// the role JwtAuthGuard already put on the request, it doesn't verify the token itself.
// Admin is the one surface where "logged in" isn't enough: unguarded, these endpoints can
// self-approve business verification, mint badges, tamper with ad pricing, and suspend users.
@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user?.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}

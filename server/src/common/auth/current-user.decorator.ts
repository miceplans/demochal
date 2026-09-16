import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

/** Injects the authenticated user populated by AuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    return request.user;
  },
);

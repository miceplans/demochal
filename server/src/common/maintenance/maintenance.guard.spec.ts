import { describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableException, type ExecutionContext } from '@nestjs/common';
import { AUTH_COOKIE_NAME } from '../../modules/auth/auth.cookie.js';
import { MaintenanceGuard } from './maintenance.guard.js';

function contextFor(path: string, request: Record<string, unknown> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ path, headers: {}, ...request }) }),
  } as unknown as ExecutionContext;
}

function dbReturning(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  return { select: vi.fn(() => ({ from: () => ({ where: () => ({ limit }) }) })) };
}

describe('MaintenanceGuard', () => {
  it.each(['/auth/google', '/auth/google/callback'])(
    'allows Google OAuth endpoint %s without querying maintenance settings',
    async (path) => {
      const adminSettingsService = { isEnabled: vi.fn() };
      const jwtService = { verifyAsync: vi.fn() };
      const guard = new MaintenanceGuard(
        adminSettingsService as never,
        jwtService as never,
        {} as never,
      );

      await expect(guard.canActivate(contextFor(path))).resolves.toBe(true);
      expect(adminSettingsService.isEnabled).not.toHaveBeenCalled();
    },
  );

  describe('while maintenance mode is on', () => {
    const adminSettingsService = { isEnabled: vi.fn().mockResolvedValue(true) };
    const tokenHeaders = { cookie: `${AUTH_COOKIE_NAME}=valid.jwt` };

    it('lets an authenticated admin through using the role JwtAuthGuard loaded', async () => {
      const guard = new MaintenanceGuard(adminSettingsService as never, {} as never, {} as never);
      await expect(
        guard.canActivate(contextFor('/admin/users', { user: { role: 'admin' } })),
      ).resolves.toBe(true);
    });

    it('ignores a stale admin role claim when the DB says the user was demoted', async () => {
      const jwtService = { verifyAsync: vi.fn().mockResolvedValue({ sub: 'u1', role: 'admin' }) };
      const guard = new MaintenanceGuard(
        adminSettingsService as never,
        jwtService as never,
        dbReturning([{ role: 'user', suspended: false }]) as never,
      );

      await expect(
        guard.canActivate(contextFor('/challenges', { headers: tokenHeaders })),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('lets a current admin through on public routes via a DB lookup', async () => {
      const jwtService = { verifyAsync: vi.fn().mockResolvedValue({ sub: 'u1', role: 'user' }) };
      const guard = new MaintenanceGuard(
        adminSettingsService as never,
        jwtService as never,
        dbReturning([{ role: 'admin', suspended: false }]) as never,
      );

      await expect(
        guard.canActivate(contextFor('/challenges', { headers: tokenHeaders })),
      ).resolves.toBe(true);
    });
  });
});

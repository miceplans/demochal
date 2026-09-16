import { describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { MaintenanceGuard } from './maintenance.guard.js';

function contextFor(path: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ path, headers: {} }) }),
  } as unknown as ExecutionContext;
}

describe('MaintenanceGuard', () => {
  it.each(['/auth/google', '/auth/google/callback'])(
    'allows Google OAuth endpoint %s without querying maintenance settings',
    async (path) => {
      const adminSettingsService = { isEnabled: vi.fn() };
      const jwtService = { verifyAsync: vi.fn() };
      const guard = new MaintenanceGuard(adminSettingsService as never, jwtService as never);

      await expect(guard.canActivate(contextFor(path))).resolves.toBe(true);
      expect(adminSettingsService.isEnabled).not.toHaveBeenCalled();
    },
  );
});

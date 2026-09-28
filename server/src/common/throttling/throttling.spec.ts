import { describe, expect, it } from 'vitest';
import { LoginAttemptThrottlerGuard } from './throttling.js';

class ExposedGuard extends LoginAttemptThrottlerGuard {
  track(req: Record<string, unknown>) {
    return this.getTracker(req);
  }
}

describe('LoginAttemptThrottlerGuard', () => {
  const guard = new ExposedGuard({} as never, {} as never, {} as never);

  it('keys attempts by the normalized target account, not the client IP', async () => {
    await expect(
      guard.track({ ip: '1.1.1.1', body: { email: ' Victim@Semochal.kr ' } }),
    ).resolves.toBe('login:victim@semochal.kr');
    await expect(
      guard.track({ ip: '2.2.2.2', body: { email: 'victim@semochal.kr' } }),
    ).resolves.toBe('login:victim@semochal.kr');
    await expect(guard.track({ ip: '3.3.3.3', body: { username: 'BizUser' } })).resolves.toBe(
      'login:bizuser',
    );
  });

  it('falls back to the client IP when no identifier is sent', async () => {
    await expect(guard.track({ ip: '1.1.1.1', body: {} })).resolves.toBe('login-ip:1.1.1.1');
  });
});

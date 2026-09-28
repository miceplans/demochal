import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadEnv(vars: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
  return import('./env.js');
}

describe('env JWT_SECRET validation', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('rejects a short JWT_SECRET in production', async () => {
    await expect(loadEnv({ NODE_ENV: 'production', JWT_SECRET: 'x' })).rejects.toThrow(
      /JWT_SECRET/,
    );
  });

  it('accepts a 32+ character JWT_SECRET in production', async () => {
    const { env } = await loadEnv({ NODE_ENV: 'production', JWT_SECRET: 'a'.repeat(32) });
    expect(env.jwtSecret).toBe('a'.repeat(32));
  });

  it('derives an OAuth state key distinct from the JWT secret', async () => {
    const { env } = await loadEnv({ JWT_SECRET: 'b'.repeat(32) });
    expect(env.oauthStateSecret).toHaveLength(32);
    expect(env.oauthStateSecret.equals(Buffer.from(env.jwtSecret))).toBe(false);
  });
});

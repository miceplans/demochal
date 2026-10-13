import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseIpAllowlist } from '../common/throttling/ip-allowlist.js';

async function loadEnv(vars: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
  return import('./env.js');
}

describe('env JWT_SECRET validation', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('rejects a short JWT_SECRET in production', async () => {
    await expect(
      loadEnv({ NODE_ENV: 'production', JWT_SECRET: 'x', TOSS_WEBHOOK_ALLOWED_IPS: '13.125.0.1' }),
    ).rejects.toThrow(/JWT_SECRET/);
  });

  it('accepts a 32+ character JWT_SECRET in production', async () => {
    const { env } = await loadEnv({
      NODE_ENV: 'production',
      JWT_SECRET: 'a'.repeat(32),
      TOSS_WEBHOOK_ALLOWED_IPS: '13.125.0.1',
    });
    expect(env.jwtSecret).toBe('a'.repeat(32));
  });

  it('rejects an empty webhook allowlist in production when the Toss key is set', async () => {
    await expect(
      loadEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'a'.repeat(32),
        TOSS_SECRET_KEY: 'test_sk',
        TOSS_WEBHOOK_ALLOWED_IPS: '',
      }),
    ).rejects.toThrow(/TOSS_WEBHOOK_ALLOWED_IPS/);
  });

  it('allows an empty webhook allowlist in production without a Toss key', async () => {
    const { env } = await loadEnv({
      NODE_ENV: 'production',
      JWT_SECRET: 'a'.repeat(32),
      TOSS_SECRET_KEY: '',
      TOSS_WEBHOOK_ALLOWED_IPS: '',
    });
    expect(env.tossWebhookAllowlist).toEqual(parseIpAllowlist([]));
  });

  it('derives an OAuth state key distinct from the JWT secret', async () => {
    const { env } = await loadEnv({ JWT_SECRET: 'b'.repeat(32) });
    expect(env.oauthStateSecret).toHaveLength(32);
    expect(env.oauthStateSecret.equals(Buffer.from(env.jwtSecret))).toBe(false);
  });
});

describe('env SWAGGER_ENABLED', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('defaults to off in production', async () => {
    const { env } = await loadEnv({
      NODE_ENV: 'production',
      JWT_SECRET: 'a'.repeat(32),
      TOSS_WEBHOOK_ALLOWED_IPS: '13.125.0.1',
    });
    expect(env.swaggerEnabled).toBe(false);
  });

  it('defaults to on outside production', async () => {
    const { env } = await loadEnv({ NODE_ENV: 'development', JWT_SECRET: 'a'.repeat(32) });
    expect(env.swaggerEnabled).toBe(true);
  });

  it('honours an explicit override in either direction', async () => {
    const prod = await loadEnv({
      NODE_ENV: 'production',
      JWT_SECRET: 'a'.repeat(32),
      TOSS_WEBHOOK_ALLOWED_IPS: '13.125.0.1',
      SWAGGER_ENABLED: 'true',
    });
    expect(prod.env.swaggerEnabled).toBe(true);
    const dev = await loadEnv({ NODE_ENV: 'development', SWAGGER_ENABLED: 'false' });
    expect(dev.env.swaggerEnabled).toBe(false);
  });
});

describe('env S3_ENDPOINT', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is undefined when set to an empty value', async () => {
    // Stub explicitly: env.ts itself dotenv-loads server/.env, which may define
    // S3_ENDPOINT in a developer workspace, so an unstubbed import is not hermetic.
    expect((await loadEnv({ S3_ENDPOINT: '' })).env.s3Endpoint).toBeUndefined();
  });

  it('exposes a valid endpoint override', async () => {
    const { env } = await loadEnv({ S3_ENDPOINT: 'http://localhost:4566' });
    expect(env.s3Endpoint).toBe('http://localhost:4566');
  });

  it('rejects a malformed endpoint at load time', async () => {
    await expect(loadEnv({ S3_ENDPOINT: 'not a url' })).rejects.toThrow(
      /Invalid environment configuration/,
    );
  });
});

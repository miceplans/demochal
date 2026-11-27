import { afterEach, describe, expect, it, vi } from 'vitest';

describe('BZ_SUBDOMAIN 해석', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('두 변수가 모두 없으면 기본값 bz를 쓴다', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_BZ_SUBDOMAIN', undefined);
    vi.stubEnv('BZ_SUBDOMAIN', undefined);

    const { BZ_SUBDOMAIN } = await import('./bz-subdomain');
    expect(BZ_SUBDOMAIN).toBe('bz');
  });

  it('NEXT_PUBLIC_BZ_SUBDOMAIN을 서버 전용 BZ_SUBDOMAIN보다 먼저 본다', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_BZ_SUBDOMAIN', 'pay');
    vi.stubEnv('BZ_SUBDOMAIN', 'server-only');

    const { BZ_SUBDOMAIN } = await import('./bz-subdomain');
    expect(BZ_SUBDOMAIN).toBe('pay');
  });

  it('NEXT_PUBLIC이 없으면 서버 전용 BZ_SUBDOMAIN으로 폴드백한다', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_BZ_SUBDOMAIN', undefined);
    vi.stubEnv('BZ_SUBDOMAIN', 'server-only');

    const { BZ_SUBDOMAIN } = await import('./bz-subdomain');
    expect(BZ_SUBDOMAIN).toBe('server-only');
  });
});

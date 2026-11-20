import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadGate() {
  vi.resetModules();
  return import('./payments-gate');
}

describe('payments-gate', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('blocks payments unless NEXT_PUBLIC_PAYMENTS_ENABLED is exactly "true"', async () => {
    vi.stubEnv('NEXT_PUBLIC_PAYMENTS_ENABLED', '');
    expect((await loadGate()).PAYMENTS_ENABLED).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_PAYMENTS_ENABLED', 'false');
    expect((await loadGate()).PAYMENTS_ENABLED).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_PAYMENTS_ENABLED', 'true');
    expect((await loadGate()).PAYMENTS_ENABLED).toBe(true);
  });
});

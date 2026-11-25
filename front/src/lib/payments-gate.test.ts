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

  describe('NEXT_PUBLIC_TOSS_PAYMENTS_ENABLED', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    async function bizEnabledOn(hostname: string) {
      vi.stubGlobal('location', { hostname });
      return (await loadGate()).isBizPaymentEnabled();
    }

    it('opens only Toss while the global switch is off', async () => {
      vi.stubEnv('NEXT_PUBLIC_PAYMENTS_ENABLED', '');
      vi.stubEnv('NEXT_PUBLIC_TOSS_PAYMENTS_ENABLED', 'true');
      const gate = await loadGate();
      expect(gate.PAYMENTS_ENABLED).toBe(false);
      expect(gate.TOSS_PAYMENTS_ENABLED).toBe(true);
      expect(await bizEnabledOn('biz.example.com')).toBe(true);
      expect(await bizEnabledOn('bz.example.com')).toBe(false);
    });

    it('keeps every host blocked when both switches are off', async () => {
      vi.stubEnv('NEXT_PUBLIC_PAYMENTS_ENABLED', '');
      vi.stubEnv('NEXT_PUBLIC_TOSS_PAYMENTS_ENABLED', '');
      expect((await loadGate()).TOSS_PAYMENTS_ENABLED).toBe(false);
      expect(await bizEnabledOn('biz.example.com')).toBe(false);
    });

    it('opens every host when the global switch is on', async () => {
      vi.stubEnv('NEXT_PUBLIC_PAYMENTS_ENABLED', 'true');
      expect((await loadGate()).TOSS_PAYMENTS_ENABLED).toBe(true);
      expect(await bizEnabledOn('bz.example.com')).toBe(true);
    });
  });
});

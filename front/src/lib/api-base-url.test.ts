import { afterEach, describe, expect, it, vi } from 'vitest';
import { getApiBaseUrl } from './api-base-url';

describe('getApiBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the same-origin proxy in the browser', () => {
    expect(getApiBaseUrl()).toBe('/api');
  });

  it('uses the configured API origin on the server', () => {
    vi.stubGlobal('window', undefined);
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://server.semochall.com');

    expect(getApiBaseUrl()).toBe('https://server.semochall.com');
  });
});

import { describe, expect, it } from 'vitest';
import { NETWORK_ERROR_MESSAGE, apiErrorMessage } from './api-error';

describe('apiErrorMessage', () => {
  it('maps fetch network TypeError to the network message', () => {
    expect(apiErrorMessage(new TypeError('Failed to fetch'), 'fallback')).toBe(
      NETWORK_ERROR_MESSAGE,
    );
  });

  it('keeps a local or SDK Error on the caller fallback', () => {
    expect(apiErrorMessage(new Error('Toss SDK failed'), 'fallback')).toBe('Toss SDK failed');
  });
});

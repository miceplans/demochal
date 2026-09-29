import { describe, expect, it } from 'vitest';
import { sanitizeNextPath } from './next-path.js';

describe('sanitizeNextPath', () => {
  it.each(['/', '/contests/abc', '/contests/abc?tab=1#top', '/my'])('허용: %s', (value) => {
    expect(sanitizeNextPath(value)).toBe(value);
  });

  it.each([
    'https://evil.com',
    '//evil.com',
    '/\\evil.com',
    '/\t/evil.com',
    'javascript:alert(1)',
    'contests/abc',
    '',
    '/login',
    '/login?next=/my',
    '/auth/callback',
    '/onboarding/activity',
    `/${'a'.repeat(600)}`,
  ])('거부: %s', (value) => {
    expect(sanitizeNextPath(value)).toBeNull();
  });

  it('문자열이 아니면 거부', () => {
    expect(sanitizeNextPath(undefined)).toBeNull();
    expect(sanitizeNextPath(['/my'])).toBeNull();
  });
});

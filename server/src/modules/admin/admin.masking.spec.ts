import { describe, expect, it } from 'vitest';
import { escapeLike, maskBizNumber, maskEmail } from './admin.service.js';

describe('AdminService — user-facing masking', () => {
  it('masks emails to first char + *** + domain', () => {
    expect(maskEmail('kim.dev@gmail.com')).toBe('k***@gmail.com');
    expect(maskEmail('a@semochal.kr')).toBe('a***@semochal.kr');
  });

  it('masks business numbers to the first 6 chars', () => {
    expect(maskBizNumber('123-45-67890')).toBe('123-45-*****');
  });
});

describe('escapeLike', () => {
  it('escapes ilike wildcards and the escape character', () => {
    expect(escapeLike('100%_a\\b')).toBe('100\\%\\_a\\\\b');
    expect(escapeLike('plain')).toBe('plain');
  });
});

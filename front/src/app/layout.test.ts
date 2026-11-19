import { describe, expect, it } from 'vitest';
import { metadata } from './layout';

describe('root layout metadata', () => {
  it('always includes the Naver site verification token', () => {
    expect(metadata.verification?.other).toEqual({
      'naver-site-verification': '79e6b66b6e1e3f5cf5282ed01b9f4d153bb78e5c',
    });
  });
});

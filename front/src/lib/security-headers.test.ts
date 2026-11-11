import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy } from '../../next.config';

describe('security headers', () => {
  it('allows Toss payment form navigation while keeping same-origin forms allowed', () => {
    expect(contentSecurityPolicy).toContain("form-action 'self' https://*.tosspayments.com");
  });
});

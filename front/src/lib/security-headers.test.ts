import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy } from '../../next.config';

describe('security headers', () => {
  it('allows Toss payment form navigation while keeping same-origin forms allowed', () => {
    expect(contentSecurityPolicy).toContain("form-action 'self' https://*.tosspayments.com");
  });

  it('allows the Naver Pay SDK and payment window for the bz subdomain checkout', () => {
    expect(contentSecurityPolicy).toContain('https://nsp.pay.naver.com');
    expect(contentSecurityPolicy).toContain('https://*.pay.naver.com');
    expect(contentSecurityPolicy).toContain(
      "form-action 'self' https://*.tosspayments.com https://*.pay.naver.com",
    );
  });
});

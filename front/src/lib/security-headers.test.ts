import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy } from '../../next.config';

describe('security headers', () => {
  it('allows Toss payment form navigation while keeping same-origin forms allowed', () => {
    expect(contentSecurityPolicy).toContain("form-action 'self' https://*.tosspayments.com");
  });

  it('allows the KCP Naver Pay window for the bz subdomain checkout', () => {
    expect(contentSecurityPolicy).toContain('https://testspay.kcp.co.kr');
    expect(contentSecurityPolicy).toContain('https://spay.kcp.co.kr');
    expect(contentSecurityPolicy).toContain('https://*.kcp.co.kr');
    expect(contentSecurityPolicy).toContain('https://*.pay.naver.com');
    expect(contentSecurityPolicy).toContain(
      "form-action 'self' https://*.tosspayments.com https://*.kcp.co.kr https://*.pay.naver.com",
    );
  });
});

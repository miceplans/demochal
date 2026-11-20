import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildContentSecurityPolicy, contentSecurityPolicy } from '../../next.config';

describe('security headers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows Toss payment form navigation while keeping same-origin forms allowed', () => {
    expect(contentSecurityPolicy).toContain("form-action 'self' https://*.tosspayments.com");
  });

  it('allows the KCP Naver Pay window for the bz subdomain checkout', () => {
    // 테스트 환경(NODE_ENV=test)은 개발과 같이 KCP 테스트 허브를 허용한다.
    expect(contentSecurityPolicy).toContain('https://testspay.kcp.co.kr');
    expect(contentSecurityPolicy).toContain('https://spay.kcp.co.kr');
    expect(contentSecurityPolicy).toContain('https://*.kcp.co.kr');
    expect(contentSecurityPolicy).toContain('https://*.pay.naver.com');
    expect(contentSecurityPolicy).toContain(
      "form-action 'self' https://*.tosspayments.com https://*.kcp.co.kr https://*.pay.naver.com",
    );
  });

  it('excludes the KCP test hub from the production CSP', () => {
    const productionCsp = buildContentSecurityPolicy('production');

    expect(productionCsp).not.toContain('testspay.kcp.co.kr');
    expect(productionCsp).toContain('https://spay.kcp.co.kr');
  });
});

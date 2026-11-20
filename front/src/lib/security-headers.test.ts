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
    vi.stubEnv('NEXT_PUBLIC_KCP_SITE_CD', '');

    const productionCsp = buildContentSecurityPolicy('production');

    expect(productionCsp).not.toContain('testspay.kcp.co.kr');
    expect(productionCsp).toContain('https://spay.kcp.co.kr');
  });

  it('keeps the KCP test hub for a production build using the T0000 test site code (staging)', () => {
    // kcpHubUrl()과 같은 조건 — 스테이징은 운영 빌드 + 테스트 사이트코드로 배포된다.
    vi.stubEnv('NEXT_PUBLIC_KCP_SITE_CD', 'T0000');

    const stagingCsp = buildContentSecurityPolicy('production');

    expect(stagingCsp).toContain('https://testspay.kcp.co.kr');
  });
});

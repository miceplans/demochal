'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { generated } from '@semochal/api-client';

const ONBOARDING_PATH = '/onboarding/activity';
// 인증·온보딩 자체와 약관/안내 페이지는 설문 전에도 볼 수 있어야 한다.
const EXEMPT_PREFIXES = ['/onboarding', '/login', '/auth', '/terms', '/privacy', '/youth'];

function isExempt(pathname: string | null): boolean {
  if (!pathname) return true;
  return EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * 온보딩 설문을 마치지 않은 일반 회원이 서비스에 들어오면 설문 화면으로 보낸다.
 * 서버의 onboardingSurvey(null = 미완료)가 기준이며, 기업·관리자 계정과 비로그인 방문자는 건드리지 않는다.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const exempt = isExempt(pathname);
  const auth = generated.useGetMyAuthInfo({ query: { retry: false, enabled: !exempt } });
  const user = auth.data?.status === 200 ? auth.data.data : undefined;
  // 설문 직후엔 캐시가 아직 onboardingSurvey: null이라, 무효화 refetch가 끝나기 전엔 판단하지 않는다.
  const needsOnboarding =
    !exempt &&
    !auth.isFetching &&
    user !== undefined &&
    user.onboardingSurvey === null &&
    user.role !== 'business' &&
    user.role !== 'admin';

  useEffect(() => {
    if (needsOnboarding) router.replace(ONBOARDING_PATH);
  }, [needsOnboarding, router]);

  // 미완료가 확정되면 이동하는 동안 대상 페이지 내용을 보여주지 않는다.
  if (needsOnboarding) return null;
  return <>{children}</>;
}

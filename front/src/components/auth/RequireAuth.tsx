'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';

/** 로그인 후 돌아올 경로를 담은 로그인 화면 주소. 모든 보호 화면·액션이 같은 규칙을 쓴다. */
export function loginHref(next: string | null | undefined): string {
  return next ? `/login?next=${encodeURIComponent(next)}` : '/login';
}

/**
 * 로그인 사용자에게만 children을 보여준다. 인증 상태는 AuthProvider(TanStack Query 캐시)에서 읽는다.
 * 비로그인(또는 인증 확인 실패)이면 현재 경로를 next로 붙여 로그인 화면으로 보낸다.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useAuth();
  const blocked = status === 'unauthenticated' || status === 'error';

  useEffect(() => {
    if (blocked) router.replace(loginHref(pathname));
  }, [blocked, router, pathname]);

  if (status !== 'authenticated') return null;
  return <>{children}</>;
}

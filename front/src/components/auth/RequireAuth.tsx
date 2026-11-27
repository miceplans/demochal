'use client';

import { useCallback, useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, type AuthUser } from '@/features/auth/AuthProvider';

/** 로그인 후 돌아올 경로를 담은 로그인 화면 주소. */
export function loginHref(next: string | null | undefined, loginPath = '/login'): string {
  return next ? `${loginPath}?next=${encodeURIComponent(next)}` : loginPath;
}

/**
 * 비로그인 사용자를 로그인 화면으로 보내는 **유일한** 리다이렉트 규칙.
 * - `'guard'`(화면 진입 차단): `replace` — 뒤로가기로 차단된 화면에 다시 들어오지 않게 한다.
 * - `'action'`(북마크·지원 등 버튼 동작): `push` — 뒤로가기로 보던 화면에 돌아올 수 있게 한다.
 * 기본으로 현재 경로를 `next`로 붙인다. 관리자 콘솔처럼 로그인 화면이 다르면 `loginPath`를,
 * 돌아올 경로가 의미 없으면 `withNext: false`를 쓴다.
 * (기업 콘솔은 리다이렉트 대신 BizAccessCover 디자인 커버로 로그인/가입을 안내한다.)
 */
export function useLoginRedirect(options?: { loginPath?: string; withNext?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const loginPath = options?.loginPath ?? '/login';
  const withNext = options?.withNext ?? true;
  return useCallback(
    (mode: 'guard' | 'action' = 'action') => {
      const href = loginHref(withNext ? pathname : null, loginPath);
      if (mode === 'guard') router.replace(href);
      else router.push(href);
    },
    [router, pathname, loginPath, withNext],
  );
}

export type AuthGate = 'loading' | 'allowed' | 'unauthenticated' | 'forbidden' | 'error';

/**
 * 모든 접근 가드(RequireAuth·관리자 콘솔·기업 콘솔)가 공유하는 접근 판단.
 * 화면마다 보여주는 방식(리다이렉트·안내 박스·디자인 커버)만 다르고 판단 규칙은 여기 하나다.
 * - role을 주면 그 역할의 로그인 사용자만 allowed, 다른 역할은 forbidden.
 */
export function useAuthGate(role?: AuthUser['role']): {
  gate: AuthGate;
  user: AuthUser | undefined;
  refetch: () => Promise<unknown>;
} {
  const { status, user, refetch } = useAuth();
  const gate: AuthGate =
    status === 'authenticated' ? (!role || user?.role === role ? 'allowed' : 'forbidden') : status;
  return { gate, user, refetch };
}

/**
 * 로그인 사용자에게만 children을 보여준다. 인증 상태는 AuthProvider(TanStack Query 캐시)에서 읽는다.
 * 비로그인(또는 인증 확인 실패)이면 현재 경로를 next로 붙여 로그인 화면으로 보낸다.
 * 로그인이 필요한 페이지는 page.tsx에서 이 컴포넌트로 감싼다.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { gate } = useAuthGate();
  const redirectToLogin = useLoginRedirect();
  const blocked = gate === 'unauthenticated' || gate === 'error';

  useEffect(() => {
    if (blocked) redirectToLogin('guard');
  }, [blocked, redirectToLogin]);

  if (gate !== 'allowed') return null;
  return <>{children}</>;
}

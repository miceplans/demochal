'use client';

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { ApiError, generated } from '@semochal/api-client';
import { reconcileLocalUserData } from './session';

export type AuthUser = Extract<
  Awaited<ReturnType<typeof generated.getMyAuthInfo>>,
  { status: 200 }
>['data'];

/**
 * - loading: 첫 조회 중
 * - authenticated: /auth/me 200
 * - unauthenticated: /auth/me 401·403(세션 없음/만료)
 * - error: 네트워크·서버 오류 — 로그인 여부를 알 수 없다
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export type AuthState = {
  status: AuthStatus;
  user: AuthUser | undefined;
  /** 백그라운드 재조회 포함 조회 중 여부(예: 설문 직후 무효화 refetch 대기). */
  isFetching: boolean;
  refetch: () => Promise<unknown>;
};

const AuthContext = createContext<AuthState | null>(null);

export const authQueryKey = () => generated.getGetMyAuthInfoQueryKey();

/** 로그인·회원가입·설문 저장처럼 세션/유저 정보가 바뀐 뒤 인증 상태를 다시 읽게 한다. */
export function invalidateAuth(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: authQueryKey() });
}

function isUnauthenticatedError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

/**
 * 온보딩 설문 완료 여부의 유일한 기준 — 서버 User.onboardingSurvey(null = 미완료).
 * 기업·관리자 계정은 설문 대상이 아니다.
 */
export function needsOnboarding(
  user: Pick<AuthUser, 'role' | 'onboardingSurvey'> | undefined,
): boolean {
  return (
    user !== undefined &&
    user.onboardingSurvey === null &&
    user.role !== 'business' &&
    user.role !== 'admin'
  );
}

/**
 * 앱 전체의 인증 상태를 한곳에서 제공한다.
 * /auth/me는 이 프로바이더만 구독하고(TanStack Query 캐시), 화면은 useAuth()로 읽는다.
 * 로그인 주체가 바뀌거나 세션이 끝나면 이전 사용자의 로컬 데이터도 여기서 정리한다.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const query = generated.useGetMyAuthInfo({ query: { retry: false } });
  const user = query.data?.status === 200 ? query.data.data : undefined;
  const status: AuthStatus = user
    ? 'authenticated'
    : query.isPending
      ? 'loading'
      : isUnauthenticatedError(query.error)
        ? 'unauthenticated'
        : 'error';
  const userId = user?.id;
  const { refetch, isFetching } = query;

  useEffect(() => {
    if (status === 'authenticated') reconcileLocalUserData(userId ?? null);
    else if (status === 'unauthenticated') reconcileLocalUserData(null);
  }, [status, userId]);

  const value = useMemo<AuthState>(
    () => ({ status, user, isFetching, refetch }),
    [status, user, isFetching, refetch],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth()는 <AuthProvider> 안에서만 쓸 수 있습니다.');
  return value;
}

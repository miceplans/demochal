/**
 * 테스트 전용 AuthProvider 모듈 대체물.
 *
 *   vi.mock('@/features/auth/AuthProvider', () => import('@/test/auth-mock'));
 *
 * 각 테스트가 이미 모킹한 `generated.useGetMyAuthInfo` 결과로 useAuth() 상태를 만들어,
 * 테스트마다 <AuthProvider>를 감싸지 않아도 같은 인증 시나리오를 재현한다.
 * useAuth 외의 export(needsOnboarding, invalidateAuth 등)는 실제 구현을 그대로 쓴다.
 */
import { vi } from 'vitest';
import { generated } from '@semochal/api-client';
import type * as AuthProviderModule from '@/features/auth/AuthProvider';
import type { AuthState, AuthUser } from '@/features/auth/AuthProvider';

const actual = await vi.importActual<typeof AuthProviderModule>('@/features/auth/AuthProvider');

export const { AuthProvider, authQueryKey, invalidateAuth, needsOnboarding } = actual;
export type { AuthState, AuthStatus, AuthUser } from '@/features/auth/AuthProvider';

type MockQuery = {
  data?: { status?: number; data?: unknown };
  error?: unknown;
  isPending?: boolean;
  isLoading?: boolean;
  isFetching?: boolean;
  refetch?: () => unknown;
};

function errorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

export function useAuth(): AuthState {
  const query = ((generated.useGetMyAuthInfo as unknown as (() => MockQuery) | undefined)?.() ??
    {}) as MockQuery;
  const user = query.data?.status === 200 ? (query.data.data as AuthUser) : undefined;
  const httpStatus = errorStatus(query.error) ?? query.data?.status;
  const status: AuthState['status'] = user
    ? 'authenticated'
    : query.isPending || query.isLoading
      ? 'loading'
      : query.error && httpStatus !== 401 && httpStatus !== 403
        ? 'error'
        : 'unauthenticated';
  return {
    status,
    user,
    isFetching: query.isFetching ?? false,
    refetch: () => Promise.resolve(query.refetch?.()),
  };
}

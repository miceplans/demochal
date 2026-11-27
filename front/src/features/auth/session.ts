'use client';

import { useCallback } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { generated } from '@semochal/api-client';
import { clearAdPaymentDraft } from '@/lib/ad-payment-draft';
import { clearAllFormDrafts } from '@/lib/form-draft';
import { useUserStore } from '@/stores/useUserStore';

/**
 * 이 브라우저에 남은 사용자 데이터를 모두 지운다 — Zustand 개인 데이터(localStorage),
 * 폼 초안(local/sessionStorage), 광고 결제 초안. 공용 PC에서 다음 사용자에게 이어지지 않게 한다.
 */
export function clearLocalUserData(): void {
  useUserStore.getState().clearPersonalData();
  clearAllFormDrafts();
  clearAdPaymentDraft();
}

/**
 * 인증 상태가 확정될 때(AuthProvider) 로컬 데이터의 주인을 맞춘다.
 * - 다른 계정으로 로그인했거나 세션이 끝났으면(userId=null) 이전 주인의 데이터를 지운다.
 * - 로그인 사용자를 새 주인으로 기록한다.
 * 저장값 복원(rehydrate) 전에 쓰면 기본값이 저장소를 덮으므로 복원이 끝난 뒤에 실행한다.
 */
export function reconcileLocalUserData(userId: string | null): void {
  const run = () => {
    const { ownerId } = useUserStore.getState();
    if (ownerId && ownerId !== userId) clearLocalUserData();
    if (userId && useUserStore.getState().ownerId !== userId) {
      useUserStore.getState().setOwner(userId);
    }
  };
  const { persist } = useUserStore;
  if (persist.hasHydrated()) {
    run();
    return;
  }
  const unsubscribe = persist.onFinishHydration(() => {
    unsubscribe();
    run();
  });
  void persist.rehydrate();
}

/**
 * 세션이 끝난 뒤(로그아웃·탈퇴) 클라이언트 상태를 정리한다.
 * 이전 사용자의 서버 데이터 캐시를 버리고 /auth/me는 초기화 후 다시 조회해,
 * AuthProvider가 즉시 비로그인 상태가 되게 한다(clear()만 하면 구독 중인 옵저버가 이전 값을 유지한다).
 */
export async function resetClientSession(queryClient: QueryClient): Promise<void> {
  clearLocalUserData();
  const authKey = generated.getGetMyAuthInfoQueryKey();
  const isAuthQuery = (key: readonly unknown[]) => key[0] === authKey[0];
  queryClient.removeQueries({ predicate: (query) => !isAuthQuery(query.queryKey) });
  await queryClient.resetQueries({ queryKey: authKey });
}

/**
 * 모든 로그아웃 버튼이 쓰는 공통 로그아웃. 서버 호출이 실패해도 로컬 정리는 항상 한다.
 * 이동할 곳은 호출부가 정한다(일반/기업/관리자 로그인 화면이 다르다).
 */
export function useLogout() {
  const queryClient = useQueryClient();
  return useCallback(
    async (afterLogout?: () => void) => {
      try {
        await generated.logout();
      } catch {
        // 세션 쿠키가 이미 만료됐거나 네트워크 오류여도 로컬 데이터는 지운다.
      } finally {
        // 보호 화면이 비로그인 감지로 /login?next=… 로 먼저 튀지 않게 이동을 먼저 시작한다.
        afterLogout?.();
        await resetClientSession(queryClient);
      }
    },
    [queryClient],
  );
}

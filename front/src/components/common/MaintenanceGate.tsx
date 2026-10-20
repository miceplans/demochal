'use client';

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { API_ERROR_EVENT, ApiError, generated, getApiErrorMessage } from '@semochal/api-client';
import { NETWORK_ERROR_MESSAGE } from '@/lib/api-error';
import { useToast } from './Toast';
import { MaintenanceScreen } from './MaintenanceScreen';

// 점검 해제 확인 주기(ms) — 점검 화면 노출 중에만 동작한다.
const MAINTENANCE_PROBE_INTERVAL_MS = 15_000;

/**
 * HTTP 오류의 상태 코드를 안전하게 읽는다.
 *
 * ApiError는 정상적인 브라우저 요청에서 사용되지만, 번들 경계나 오류 래핑을 거친
 * 오류는 다른 ApiError 생성자를 가질 수 있다. 점검 감지는 오류 클래스의 동일성보다
 * 서버가 보낸 503 상태 코드가 기준이어야 한다.
 */
function getHttpStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) return error.status;
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
  ) {
    return (error as { status: number }).status;
  }
  return undefined;
}

/** 서버 MaintenanceGuard가 내리는 ServiceUnavailable — 점검 모드 신호로만 쓴다. */
function isMaintenanceError(error: unknown): boolean {
  return getHttpStatus(error) === 503;
}

/** 서버가 알려준 원인이 있으면 그 메시지를, 없으면 네트워크 문제인지 구분해 안내한다. */
function apiErrorDescription(error: unknown): string {
  const serverMessage = getApiErrorMessage(error);
  if (serverMessage) return serverMessage;
  if (!(error instanceof ApiError) && error instanceof Error) return NETWORK_ERROR_MESSAGE;
  return '잠시 후 다시 시도해주세요';
}

/**
 * 전역 QueryClient + 점검 모드 게이트.
 * 임의 쿼리/뮤테이션이 503으로 실패하면 점검 화면으로 전환하고, 가벼운 공개 API 탐침이
 * 다시 성공하면 쿼리를 무효화해 정상 화면으로 자동 복귀한다.
 */
export function MaintenanceGate({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [maintenance, setMaintenance] = useState(false);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          // 401은 로그인하지 않은 상태(예: /auth/me)일 수 있으므로 전역 토스트에서 제외
          // 503은 점검 화면이 안내를 대신하므로 전역 토스트에서 제외
          // meta.localErrorToast 쿼리는 화면이 직접 액션 토스트로 알리므로 전역 토스트에서 제외
          // meta.silentError 쿼리(예: 홈 광고)는 실패해도 기본 광고가 있어 방문자에게 알리지 않는다
          onError: (error, query) => {
            const status = getHttpStatus(error);
            if (isMaintenanceError(error)) {
              setMaintenance(true);
              return;
            }
            if (status === 401) return;
            if (query.meta?.localErrorToast) return;
            if (query.meta?.silentError) return;
            toast.error('요청이 실패했어요', apiErrorDescription(error));
          },
        }),
        mutationCache: new MutationCache({
          // 점검 모드(503)도 점검 화면이 대신 안내하므로 전역 토스트에서 제외한다
          // 호출부에서 직접 처리하는 상태 코드는 mutation `meta.handledErrorStatuses`로 지정해 제외한다
          // (예: 온보딩 설문 409 = 이미 완료).
          // mutation 단위 onError가 있으면 그 화면이 이미 안내 중이므로 이중 토스트를 피한다
          onError: (error, _variables, _onMutateResult, mutation) => {
            const status = getHttpStatus(error);
            if (isMaintenanceError(error)) {
              setMaintenance(true);
              return;
            }
            if (status === 401) return;
            const handled = mutation.meta?.handledErrorStatuses;
            if (status !== undefined && Array.isArray(handled) && handled.includes(status)) return;
            if (mutation.options.onError) return;
            toast.error('요청이 실패했어요', apiErrorDescription(error));
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  // HTTP 클라이언트에서 바로 받은 503도 감지한다. React Query의 재시도나 캐시 오류
  // 콜백을 거치지 않는 호출까지 점검 화면으로 전환하기 위한 주 경로다.
  useEffect(() => {
    const handleApiError = (event: Event) => {
      const status = (event as CustomEvent<{ status?: unknown }>).detail?.status;
      if (status === 503) setMaintenance(true);
    };
    window.addEventListener(API_ERROR_EVENT, handleApiError);
    return () => window.removeEventListener(API_ERROR_EVENT, handleApiError);
  }, []);

  // 점검 화면 노출 중에는 가벼운 공개 API로 점검 종료를 주기적으로 확인한다.
  // 진입 직후 1회 탐침은 점검과 무관한 일시적 503로 잘못 전환된 경우 즉시 복귀시킨다.
  useEffect(() => {
    if (!maintenance) return;
    let cancelled = false;
    const probe = async () => {
      try {
        await generated.listChallenges({ limit: 1 });
      } catch {
        return; // 여전히 점검 중(또는 일시적 오류) — 다음 주기에 다시 확인한다
      }
      if (cancelled) return;
      setMaintenance(false);
      void queryClient.invalidateQueries();
    };
    void probe();
    const timer = setInterval(() => void probe(), MAINTENANCE_PROBE_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [maintenance, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {maintenance ? <MaintenanceScreen /> : children}
    </QueryClientProvider>
  );
}

'use client';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { generated } from '@semochal/api-client';
import { getApiBaseUrl } from './api-base-url';

// 인앱 알림 실시간 구독(SSE). 스트림은 id만 전달하므로 알림 목록은 계속 TanStack Query가
// 소유하고, 이벤트가 오면 목록 쿼리를 invalidate한다. EventSource는 끊기면 자동 재연결하며,
// 재연결 시(두 번째 open부터) 끊긴 동안 놓친 알림을 다시 조회한다.
// fetch가 아니라 EventSource를 쓰는 이유: orval은 SSE를 생성하지 못한다(openapi.yaml 참고).
export function useNotificationStream(enabled: boolean) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') return;
    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: generated.getListMyNotificationsQueryKey() });
    const baseUrl = getApiBaseUrl().replace(/\/$/, '');
    const source = new EventSource(`${baseUrl}/notifications/stream`, { withCredentials: true });
    // 최초 연결은 쿼리가 마운트 시 이미 조회하므로 건너뛰고, 재연결(open 2회차~)에서만 놓친 알림을 다시 조회한다.
    let opened = false;
    source.addEventListener('notification', invalidate);
    source.addEventListener('open', () => {
      if (opened) invalidate();
      opened = true;
    });
    return () => source.close();
  }, [enabled, queryClient]);
}

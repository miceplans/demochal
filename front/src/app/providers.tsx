'use client';

import '@/lib/api'; // generated API 공통 설정(configureGeneratedApi) — 최초 import 시 1회 실행
import { ThemeProvider } from '@emotion/react';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ApiError } from '@semochal/api-client';
import { EmotionRegistry } from '@/lib/emotion-registry';
import { ToastProvider, useToast } from '@/components/common/Toast';
import { InputSecurityBoundary } from '@/components/common/InputSecurityBoundary';
import { theme } from '@/styles/theme';

function QueryProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          // 401은 로그인하지 않은 상태(예: /auth/me)일 수 있으므로 전역 토스트에서 제외
          onError: (error) => {
            if (error instanceof ApiError && error.status === 401) return;
            toast.error('서버 오류', '잠시 후 다시 시도해주세요');
          },
        }),
        mutationCache: new MutationCache({
          onError: () => toast.error('서버 오류', '잠시 후 다시 시도해주세요'),
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

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <EmotionRegistry>
      <ThemeProvider theme={theme}>
        <ToastProvider>
          <InputSecurityBoundary>
            <QueryProvider>{children}</QueryProvider>
          </InputSecurityBoundary>
        </ToastProvider>
      </ThemeProvider>
    </EmotionRegistry>
  );
}

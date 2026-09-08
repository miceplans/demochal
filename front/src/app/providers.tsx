'use client';

import { ThemeProvider } from '@emotion/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { EmotionRegistry } from '@/lib/emotion-registry';
import { ToastProvider } from '@/components/common/Toast';
import { theme } from '@/styles/theme';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <EmotionRegistry>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </EmotionRegistry>
  );
}

'use client';

import '@/lib/api'; // generated API 공통 설정(configureGeneratedApi) — 최초 import 시 1회 실행
import { ThemeProvider } from '@emotion/react';
import { type ReactNode } from 'react';
import { EmotionRegistry } from '@/lib/emotion-registry';
import { ToastProvider } from '@/components/common/Toast';
import { InputSecurityBoundary } from '@/components/common/InputSecurityBoundary';
import { MaintenanceGate } from '@/components/common/MaintenanceGate';
import { theme } from '@/styles/theme';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <EmotionRegistry>
      <ThemeProvider theme={theme}>
        <ToastProvider>
          <InputSecurityBoundary>
            <MaintenanceGate>{children}</MaintenanceGate>
          </InputSecurityBoundary>
        </ToastProvider>
      </ThemeProvider>
    </EmotionRegistry>
  );
}

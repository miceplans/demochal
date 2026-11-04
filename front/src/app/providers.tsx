'use client';

import '@/api/api'; // generated API 공통 설정(configureGeneratedApi) — 최초 import 시 1회 실행
import { ThemeProvider } from '@emotion/react';
import { type ReactNode } from 'react';
import { EmotionRegistry } from '@/lib/emotion-registry';
import { ToastProvider } from '@/apps/user/components/common/Toast';
import { InputSecurityBoundary } from '@/apps/user/components/common/InputSecurityBoundary';
import { MaintenanceGate } from '@/apps/user/components/common/MaintenanceGate';
import { OnboardingGate } from '@/apps/user/components/common/OnboardingGate';
import { theme } from '@/styles/theme';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <EmotionRegistry>
      <ThemeProvider theme={theme}>
        <ToastProvider>
          <InputSecurityBoundary>
            <MaintenanceGate>
              <OnboardingGate>{children}</OnboardingGate>
            </MaintenanceGate>
          </InputSecurityBoundary>
        </ToastProvider>
      </ThemeProvider>
    </EmotionRegistry>
  );
}

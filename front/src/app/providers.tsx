'use client';

import '@/lib/api'; // generated API 공통 설정(configureGeneratedApi) — 최초 import 시 1회 실행
import { ThemeProvider } from '@emotion/react';
import { type ReactNode } from 'react';
import { EmotionRegistry } from '@/lib/emotion-registry';
import { ToastProvider } from '@/components/common/Toast';
import { InputSecurityBoundary } from '@/components/common/InputSecurityBoundary';
import { MaintenanceGate } from '@/components/common/MaintenanceGate';
import { OnboardingGate } from '@/components/common/OnboardingGate';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { theme } from '@/styles/theme';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <EmotionRegistry>
      <ThemeProvider theme={theme}>
        <ToastProvider>
          <InputSecurityBoundary>
            <MaintenanceGate>
              {/* QueryClient(MaintenanceGate) 안에서 인증 상태를 한 번만 구독해 전 화면에 제공한다. */}
              <AuthProvider>
                <OnboardingGate>{children}</OnboardingGate>
              </AuthProvider>
            </MaintenanceGate>
          </InputSecurityBoundary>
        </ToastProvider>
      </ThemeProvider>
    </EmotionRegistry>
  );
}

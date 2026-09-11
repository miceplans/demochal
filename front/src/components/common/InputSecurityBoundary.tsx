'use client';

import type { FormEvent, ReactNode } from 'react';
import { hasUnsafeInput } from '@/lib/input-security';

/**
 * A UX guard for every browser text input. The API performs the authoritative
 * validation again, because browser-side checks can always be bypassed.
 */
export function InputSecurityBoundary({ children }: { children: ReactNode }) {
  const blockUnsafeText = (event: FormEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
      return;
    }

    if (target.type === 'password') return;

    if (!hasUnsafeInput(target.value)) {
      target.setCustomValidity('');
      return;
    }

    target.setCustomValidity('스크립트 또는 데이터베이스 쿼리 구문은 입력할 수 없습니다.');
    target.value = '';
  };

  return (
    <div style={{ display: 'contents' }} onInputCapture={blockUnsafeText}>
      {children}
    </div>
  );
}

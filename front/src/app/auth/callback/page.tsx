'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { generated } from '@semochal/api-client';
import { useUserStore } from '@/stores/useUserStore';

// Google redirects the backend here after it sets the session cookie
// (see server /auth/google/callback). This page just confirms the session
// with the backend and syncs it into the client-side store.
export default function GoogleAuthCallbackPage() {
  const router = useRouter();
  const login = useUserStore((s) => s.login);

  useEffect(() => {
    async function syncSession() {
      await useUserStore.persist.rehydrate();
      try {
        const res = await generated.getMyAuthInfo();
        if (res.status !== 200) throw new Error('not authenticated');
        login();
        // 관심분야 설문은 아직 설문을 저장하지 않은 첫 가입/로그인 사용자만 진행한다.
        router.replace(res.data.onboardingSurvey ? '/' : '/onboarding/activity');
      } catch {
        router.replace('/login');
      }
    }

    void syncSession();
  }, [login, router]);

  return null;
}

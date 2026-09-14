'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/stores/useUserStore';

// Google redirects the backend here after it sets the session cookie
// (see server /auth/google/callback). This page just confirms the session
// with the backend and syncs it into the client-side store.
export default function GoogleAuthCallbackPage() {
  const router = useRouter();
  const login = useUserStore((s) => s.login);

  useEffect(() => {
    const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? '/api').replace(/\/$/, '');

    async function syncSession() {
      await useUserStore.persist.rehydrate();
      try {
        const res = await fetch(`${apiUrl}/auth/me`, { credentials: 'include' });
        if (!res.ok) throw new Error('not authenticated');
        login();
        router.replace('/onboarding/activity');
      } catch {
        router.replace('/login');
      }
    }

    void syncSession();
  }, [login, router]);

  return null;
}

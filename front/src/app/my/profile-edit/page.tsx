import type { Metadata } from 'next';
import { MyProfileEditPage } from '@/apps/user/components/my/MyPages';
import { RequireAuth } from '@/apps/user/components/auth/RequireAuth';

export const metadata: Metadata = {
  title: '내 프로필 수정',
};

export default function Page() {
  return (
    <RequireAuth>
      <MyProfileEditPage />
    </RequireAuth>
  );
}

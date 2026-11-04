import type { Metadata } from 'next';
import { MyPage as UserMyPage } from '@/apps/user/components/my/MyPages';
import { RequireAuth } from '@/apps/user/components/auth/RequireAuth';

export const metadata: Metadata = {
  title: '마이페이지',
};

export default function MyPage() {
  return (
    <RequireAuth>
      <UserMyPage />
    </RequireAuth>
  );
}

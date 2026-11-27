import type { Metadata } from 'next';
import { MyPage as UserMyPage } from '@/components/my/pages/MyPage';
import { RequireAuth } from '@/components/auth/RequireAuth';

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

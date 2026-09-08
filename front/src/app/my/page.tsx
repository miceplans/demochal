import type { Metadata } from 'next';
import { MyPage as UserMyPage } from '@/components/my/MyPages';

export const metadata: Metadata = {
  title: '마이페이지',
};

export default function MyPage() {
  return <UserMyPage />;
}

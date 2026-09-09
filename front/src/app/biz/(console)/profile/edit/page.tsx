import type { Metadata } from 'next';
import { BizProfileEditPage } from '@/features/biz/components/BizProfileEditPage';

export const metadata: Metadata = {
  title: '내 기업 프로필 수정하기',
};

export default function BizProfileEditRoute() {
  return <BizProfileEditPage />;
}

import type { Metadata } from 'next';
import { BizProfilePage } from '@/features/biz/components/BizProfilePage';

export const metadata: Metadata = {
  title: '나의 정보',
};

export default function BizProfileRoute() {
  return <BizProfilePage />;
}

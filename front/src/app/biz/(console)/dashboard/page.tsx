import type { Metadata } from 'next';
import { BizDashboardPage } from '@/features/biz/components/BizDashboardPage';

export const metadata: Metadata = {
  title: '대시보드',
};

export default function BizDashboardRoute() {
  return <BizDashboardPage />;
}

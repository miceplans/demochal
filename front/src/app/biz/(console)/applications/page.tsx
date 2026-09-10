import type { Metadata } from 'next';
import { BizApplicationsPage } from '@/features/biz/components/BizApplicationsPage';

export const metadata: Metadata = {
  title: '지원서 관리',
};

export default function BizApplicationsRoute() {
  return <BizApplicationsPage />;
}

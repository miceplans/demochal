import type { Metadata } from 'next';
import { BizApplicationsPage } from '@/features/biz/components/BizApplicationsPage';

export const metadata: Metadata = {
  title: '신청서 응답 관리',
};

export default function BizApplicationsRoute() {
  return <BizApplicationsPage />;
}

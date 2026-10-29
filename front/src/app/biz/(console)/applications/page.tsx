import type { Metadata } from 'next';
import { BizApplicationsPage } from '@/features/biz/components/BizApplicationsPage';

export const metadata: Metadata = {
  title: '신청자 응답',
};

export default function BizApplicationsRoute() {
  return <BizApplicationsPage />;
}

import type { Metadata } from 'next';
import { BizApplicationsEventPage } from '@/features/biz/components/BizApplicationsEventPage';

export const metadata: Metadata = {
  title: '행사별 신청서',
};

export default function BizApplicationsEventRoute() {
  return <BizApplicationsEventPage />;
}

import type { Metadata } from 'next';
import { BizBillingPage } from '@/features/biz/components/BizBillingPage';

export const metadata: Metadata = {
  title: '결제 내역 관리',
};

export default function BizBillingRoute() {
  return <BizBillingPage />;
}

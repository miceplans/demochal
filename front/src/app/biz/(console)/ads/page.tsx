import type { Metadata } from 'next';
import { BizAdsPage } from '@/apps/biz/components/BizAdsPage';

export const metadata: Metadata = {
  title: '광고 관리',
};

export default function BizAdsRoute() {
  return <BizAdsPage />;
}

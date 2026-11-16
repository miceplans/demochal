import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AD_SALES_ENABLED } from '@/features/biz/adSales';
import { BizAdsPage } from '@/features/biz/components/BizAdsPage';

export const metadata: Metadata = {
  title: '광고 관리',
};

export default function BizAdsRoute() {
  if (!AD_SALES_ENABLED) notFound();
  return <BizAdsPage />;
}

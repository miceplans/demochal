import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { AD_SALES_ENABLED } from '@/features/biz/adSales';
import { BizAdsPage } from '@/features/biz/components/BizAdsPage';
import { isBzHostHeader } from '@/lib/biz';

export const metadata: Metadata = {
  title: '광고 관리',
};

export default async function BizAdsRoute() {
  // bz 호스트는 광고형 상품 전용이라 빌드 플래그와 무관하게 광고 관리를 연다.
  if (!AD_SALES_ENABLED && !isBzHostHeader((await headers()).get('host'))) notFound();
  return <BizAdsPage />;
}

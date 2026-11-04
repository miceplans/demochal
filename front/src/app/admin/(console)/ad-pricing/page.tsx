import type { Metadata } from 'next';
import { AdminAdsScreen } from '@/apps/admin/components/AdminAdsScreen';

export const metadata: Metadata = {
  title: '광고 관리',
};

export default function AdminAdPricingRoute() {
  return <AdminAdsScreen />;
}

import type { Metadata } from 'next';
import { AdminAdsScreen } from '@/components/admin/AdminAdsScreen';

export const metadata: Metadata = {
  title: '광고 관리',
};

export default function AdminAdPricingRoute() {
  return <AdminAdsScreen />;
}

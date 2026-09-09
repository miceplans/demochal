import type { Metadata } from 'next';
import { AdminAdPricingScreen } from '@/components/admin/AdminAdPricingScreen';

export const metadata: Metadata = {
  title: '광고비 관리',
};

export default function AdminAdPricingManagementRoute() {
  return <AdminAdPricingScreen />;
}

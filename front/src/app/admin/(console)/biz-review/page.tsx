import type { Metadata } from 'next';
import { AdminBizReviewScreen } from '@/components/admin/AdminBizReviewScreen';

export const metadata: Metadata = {
  title: '기관 심사',
};

export default function AdminBizReviewRoute() {
  return <AdminBizReviewScreen />;
}

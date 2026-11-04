import type { Metadata } from 'next';
import { AdminBizReviewScreen } from '@/apps/admin/components/AdminBizReviewScreen';

export const metadata: Metadata = {
  title: '기관 관리',
};

export default function AdminBizReviewRoute() {
  return <AdminBizReviewScreen />;
}

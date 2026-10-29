import type { Metadata } from 'next';
import { AdminBizReviewScreen } from '@/components/admin/AdminBizReviewScreen';

export const metadata: Metadata = {
  title: '기관 관리',
};

export default function AdminBizReviewRoute() {
  return <AdminBizReviewScreen />;
}

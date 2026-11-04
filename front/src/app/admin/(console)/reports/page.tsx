import type { Metadata } from 'next';
import { AdminReportsScreen } from '@/apps/admin/components/AdminReportsScreen';

export const metadata: Metadata = {
  title: '신고 처리',
};

export default function AdminReportsRoute() {
  return <AdminReportsScreen />;
}

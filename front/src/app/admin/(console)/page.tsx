import type { Metadata } from 'next';
import { AdminDashboardScreen } from '@/components/admin/AdminDashboardScreen';

export const metadata: Metadata = {
  title: '대시보드',
};

export default function AdminDashboardRoute() {
  return <AdminDashboardScreen />;
}

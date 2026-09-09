import type { Metadata } from 'next';
import { AdminUsersScreen } from '@/components/admin/AdminUsersScreen';

export const metadata: Metadata = {
  title: '사용자 관리',
};

export default function AdminUsersRoute() {
  return <AdminUsersScreen />;
}

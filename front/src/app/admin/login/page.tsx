import type { Metadata } from 'next';
import { AdminLoginScreen } from '@/apps/admin/components/AdminLoginScreen';

export const metadata: Metadata = {
  title: '관리자 로그인',
};

export default function AdminLoginRoute() {
  return <AdminLoginScreen />;
}

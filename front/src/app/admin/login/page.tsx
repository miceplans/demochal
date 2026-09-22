import type { Metadata } from 'next';
import { AdminLoginScreen } from '@/components/admin/AdminLoginScreen';

export const metadata: Metadata = {
  title: '관리자 로그인',
};

export default function AdminLoginRoute() {
  return <AdminLoginScreen />;
}

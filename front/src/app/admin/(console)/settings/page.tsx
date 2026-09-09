import type { Metadata } from 'next';
import { AdminSettingsScreen } from '@/components/admin/AdminSettingsScreen';

export const metadata: Metadata = {
  title: '설정',
};

export default function AdminSettingsRoute() {
  return <AdminSettingsScreen />;
}

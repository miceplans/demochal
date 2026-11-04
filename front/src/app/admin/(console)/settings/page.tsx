import type { Metadata } from 'next';
import { AdminSettingsScreen } from '@/apps/admin/components/AdminSettingsScreen';

export const metadata: Metadata = {
  title: '설정',
};

export default function AdminSettingsRoute() {
  return <AdminSettingsScreen />;
}

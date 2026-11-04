import type { Metadata } from 'next';
import { AdminEmailsScreen } from '@/apps/admin/components/AdminEmailsScreen';

export const metadata: Metadata = { title: '메일함' };

export default function AdminEmailsRoute() {
  return <AdminEmailsScreen />;
}

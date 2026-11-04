import type { Metadata } from 'next';
import { AdminEmailComposeScreen } from '@/apps/admin/components/AdminEmailsScreen';

export const metadata: Metadata = { title: '새 메일 작성' };

export default function AdminEmailComposeRoute() {
  return <AdminEmailComposeScreen />;
}

import type { Metadata } from 'next';
import { AdminEmailThreadScreen } from '@/apps/admin/components/AdminEmailsScreen';

export const metadata: Metadata = { title: '메일 보기' };

export default async function AdminEmailThreadRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminEmailThreadScreen id={id} />;
}

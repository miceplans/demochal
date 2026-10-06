import type { Metadata } from 'next';
import { AdminEmailThreadScreen } from '@/components/admin/AdminEmailsScreen';

export const metadata: Metadata = { title: '메일 보기' };

export default async function AdminEmailThreadRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminEmailThreadScreen id={id} />;
}

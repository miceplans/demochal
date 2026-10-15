import type { Metadata } from 'next';
import { AdminTeamDetailScreen } from '@/components/admin/AdminContentDetailScreen';

export const metadata: Metadata = { title: '팀 상세' };

export default async function AdminTeamDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminTeamDetailScreen id={id} />;
}

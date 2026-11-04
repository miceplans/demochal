import type { Metadata } from 'next';
import { AdminChallengeDetailScreen } from '@/apps/admin/components/AdminContentDetailScreen';

export const metadata: Metadata = { title: '챌린지 상세' };

export default async function AdminChallengeDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminChallengeDetailScreen id={id} />;
}

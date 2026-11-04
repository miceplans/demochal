import { ContestDetailPage } from '@/apps/user/components/contests/ContestDetailPage';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContestDetailPage challengeId={id} teamTab />;
}

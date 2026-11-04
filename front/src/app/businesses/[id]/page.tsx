import { PublicBusinessProfilePage } from '@/apps/user/components/businesses/PublicBusinessProfilePage';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PublicBusinessProfilePage businessId={id} />;
}

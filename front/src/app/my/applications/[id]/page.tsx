import { ApplicationDetailPage } from '@/components/applications/ApplicationDetailPage';
import { RequireAuth } from '@/components/auth/RequireAuth';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireAuth>
      <ApplicationDetailPage applicationId={id} />
    </RequireAuth>
  );
}

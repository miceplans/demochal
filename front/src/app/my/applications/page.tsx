import { ApplicationsPage } from '@/components/my/pages/ApplicationsPage';
import { RequireAuth } from '@/components/auth/RequireAuth';
export default function Page() {
  return (
    <RequireAuth>
      <ApplicationsPage />
    </RequireAuth>
  );
}

import { ApplicationPage } from '@/apps/user/components/applications/ApplicationPage';
import { RequireAuth } from '@/apps/user/components/auth/RequireAuth';
export default function Page() {
  return (
    <RequireAuth>
      <ApplicationPage />
    </RequireAuth>
  );
}

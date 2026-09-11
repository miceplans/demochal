import { ApplicationPage } from '@/components/applications/ApplicationPage';
import { RequireAuth } from '@/components/auth/RequireAuth';
export default function Page() {
  return (
    <RequireAuth>
      <ApplicationPage />
    </RequireAuth>
  );
}

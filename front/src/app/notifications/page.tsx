import { NotificationsPage } from '@/components/my/pages/NotificationsPage';
import { RequireAuth } from '@/components/auth/RequireAuth';
export default function Page() {
  return (
    <RequireAuth>
      <NotificationsPage />
    </RequireAuth>
  );
}

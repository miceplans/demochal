import { NotificationSettingsPage } from '@/components/my/pages/NotificationSettingsPage';
import { RequireAuth } from '@/components/auth/RequireAuth';
export default function Page() {
  return (
    <RequireAuth>
      <NotificationSettingsPage />
    </RequireAuth>
  );
}

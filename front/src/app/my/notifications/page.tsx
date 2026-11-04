import { NotificationSettingsPage } from '@/apps/user/components/my/MyPages';
import { RequireAuth } from '@/apps/user/components/auth/RequireAuth';
export default function Page() {
  return (
    <RequireAuth>
      <NotificationSettingsPage />
    </RequireAuth>
  );
}

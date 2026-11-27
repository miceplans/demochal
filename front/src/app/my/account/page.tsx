import { AccountSettings } from '@/components/account/AccountSettings';
import { RequireAuth } from '@/components/auth/RequireAuth';

export default function Page() {
  return (
    <RequireAuth>
      <AccountSettings />
    </RequireAuth>
  );
}

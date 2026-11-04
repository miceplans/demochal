import { PeoplePage } from '@/apps/user/components/people/PeoplePage';
import { RequireAuth } from '@/apps/user/components/auth/RequireAuth';
export default function Page() {
  return (
    <RequireAuth>
      <PeoplePage />
    </RequireAuth>
  );
}

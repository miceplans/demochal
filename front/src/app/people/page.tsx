import { PeoplePage } from '@/components/people/PeoplePage';
import { RequireAuth } from '@/components/auth/RequireAuth';
export default function Page() {
  return (
    <RequireAuth>
      <PeoplePage />
    </RequireAuth>
  );
}

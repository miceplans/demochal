import { InterestsPage } from '@/components/my/pages/InterestsPage';
import { RequireAuth } from '@/components/auth/RequireAuth';
export default function Page() {
  return (
    <RequireAuth>
      <InterestsPage />
    </RequireAuth>
  );
}

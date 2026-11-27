import { TeamApplicantsPage } from '@/components/my/pages/TeamApplicantsPage';
import { RequireAuth } from '@/components/auth/RequireAuth';
export default function Page() {
  return (
    <RequireAuth>
      <TeamApplicantsPage />
    </RequireAuth>
  );
}

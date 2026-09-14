import { RecruitmentPage } from '@/components/teams/RecruitmentPage';
import { RequireAuth } from '@/components/auth/RequireAuth';
export default function Page() {
  return (
    <RequireAuth>
      <RecruitmentPage />
    </RequireAuth>
  );
}

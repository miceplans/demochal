import { RecruitmentPage } from '@/apps/user/components/teams/RecruitmentPage';
import { RequireAuth } from '@/apps/user/components/auth/RequireAuth';
export default function Page() {
  return (
    <RequireAuth>
      <RecruitmentPage />
    </RequireAuth>
  );
}

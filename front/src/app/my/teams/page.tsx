import { MyTeamsPage } from '@/components/my/pages/MyTeamsPage';
import { RequireAuth } from '@/components/auth/RequireAuth';
export default function Page() {
  return (
    <RequireAuth>
      <MyTeamsPage />
    </RequireAuth>
  );
}

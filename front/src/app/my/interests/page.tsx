import { InterestsPage } from '@/components/my/MyPages';
import { RequireAuth } from '@/components/auth/RequireAuth';
export default function Page() {
  return (
    <RequireAuth>
      <InterestsPage />
    </RequireAuth>
  );
}

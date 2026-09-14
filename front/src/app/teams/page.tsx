import { ExplorePage } from '@/components/contests/ExplorePage';
import { RequireAuth } from '@/components/auth/RequireAuth';
export default function Page() {
  return (
    <RequireAuth>
      <ExplorePage teamMode />
    </RequireAuth>
  );
}

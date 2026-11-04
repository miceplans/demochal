import { OfferDetailPage } from '@/apps/user/components/people/OfferDetailPage';
import { RequireAuth } from '@/apps/user/components/auth/RequireAuth';
export default function Page() {
  return (
    <RequireAuth>
      <OfferDetailPage />
    </RequireAuth>
  );
}

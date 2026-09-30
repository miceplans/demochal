import { OfferDetailPage } from '@/components/people/OfferDetailPage';
import { RequireAuth } from '@/components/auth/RequireAuth';
export default function Page() {
  return (
    <RequireAuth>
      <OfferDetailPage />
    </RequireAuth>
  );
}

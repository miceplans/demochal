import { Suspense } from 'react';
import { RequireAuth } from '@/apps/user/components/auth/RequireAuth';
import { PaymentFailPage } from '@/apps/user/components/payments/PaymentFailPage';

export default function Page() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <PaymentFailPage />
      </Suspense>
    </RequireAuth>
  );
}

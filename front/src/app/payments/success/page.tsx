import { Suspense } from 'react';
import { RequireAuth } from '@/apps/user/components/auth/RequireAuth';
import { PaymentSuccessPage } from '@/apps/user/components/payments/PaymentSuccessPage';

export default function Page() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <PaymentSuccessPage />
      </Suspense>
    </RequireAuth>
  );
}

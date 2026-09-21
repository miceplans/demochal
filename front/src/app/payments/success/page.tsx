import { Suspense } from 'react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { PaymentSuccessPage } from '@/components/payments/PaymentSuccessPage';

export default function Page() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <PaymentSuccessPage />
      </Suspense>
    </RequireAuth>
  );
}

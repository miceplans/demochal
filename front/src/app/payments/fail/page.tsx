import { Suspense } from 'react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { PaymentFailPage } from '@/components/payments/PaymentFailPage';

export default function Page() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <PaymentFailPage />
      </Suspense>
    </RequireAuth>
  );
}

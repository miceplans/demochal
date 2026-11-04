import { Suspense } from 'react';
import { BillingAuthSuccessPage } from '@/apps/biz/components/BillingAuthSuccessPage';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BillingAuthSuccessPage />
    </Suspense>
  );
}

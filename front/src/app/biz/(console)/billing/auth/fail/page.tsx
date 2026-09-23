import { Suspense } from 'react';
import { BillingAuthFailPage } from '@/features/biz/components/BillingAuthFailPage';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BillingAuthFailPage />
    </Suspense>
  );
}

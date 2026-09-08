import type { Metadata } from 'next';
import { BizOperationsPage } from '@/features/biz/components/BizOperationsPage';

export const metadata: Metadata = {
  title: '운영대행',
};

export default function BizOperationsRoute() {
  return <BizOperationsPage />;
}

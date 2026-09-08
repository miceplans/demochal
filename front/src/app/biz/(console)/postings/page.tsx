import type { Metadata } from 'next';
import { BizPostingsPage } from '@/features/biz/components/BizPostingsPage';

export const metadata: Metadata = {
  title: '공고 관리',
};

export default function BizPostingsRoute() {
  return <BizPostingsPage />;
}

import type { Metadata } from 'next';
import { BizReportsPage } from '@/features/biz/components/BizReportsPage';

export const metadata: Metadata = {
  title: '성과 리포트',
};

export default function BizReportsRoute() {
  return <BizReportsPage />;
}

import type { Metadata } from 'next';
import { BizApplicationFormPage } from '@/features/biz/components/BizApplicationFormPage';

export const metadata: Metadata = {
  title: '신청서 만들기',
};

export default function BizApplicationFormRoute() {
  return <BizApplicationFormPage />;
}

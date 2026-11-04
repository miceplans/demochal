import type { Metadata } from 'next';
import { BizPostingFormPage } from '@/apps/biz/components/BizPostingFormPage';

export const metadata: Metadata = {
  title: '공고 등록',
};

export default function BizPostingNewRoute() {
  return <BizPostingFormPage />;
}

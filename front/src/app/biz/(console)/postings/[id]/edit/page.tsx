import type { Metadata } from 'next';
import { BizPostingEditPage } from '@/features/biz/components/BizPostingFormPage';

export const metadata: Metadata = {
  title: '공고 수정',
};

export default function BizPostingEditRoute() {
  return <BizPostingEditPage />;
}

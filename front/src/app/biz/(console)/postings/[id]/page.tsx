import type { Metadata } from 'next';
import { BizPostingManagePage } from '@/apps/biz/components/BizPostingManagePage';

export const metadata: Metadata = {
  title: '공고 상세',
};

export default function BizPostingDetailRoute() {
  return <BizPostingManagePage />;
}

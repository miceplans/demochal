import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { BizNavProvider } from '@/components/biz/BizShell';
import { isBizHostHeader } from '@/lib/biz';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: {
    default: 'SEMO.BIZ',
    template: '%s | SEMO.BIZ',
  },
  description: '쉬운 행사 관리, 공고 등록부터 홍보, 성과 확인, 운영대행까지.',
};

export default async function BizLayout({ children }: { children: ReactNode }) {
  const host = (await headers()).get('host');
  const base = isBizHostHeader(host) ? '' : '/biz';
  return <BizNavProvider base={base}>{children}</BizNavProvider>;
}

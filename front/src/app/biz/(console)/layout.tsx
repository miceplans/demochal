import type { ReactNode } from 'react';
import { BizShell } from '@/components/biz/BizShell';
import { BizAccessCover } from '@/components/biz/BizAccessCover';
import { noIndexMetadata } from '@/lib/seo';

export const metadata = noIndexMetadata;

export default function BizConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <BizAccessCover>
      <BizShell>{children}</BizShell>
    </BizAccessCover>
  );
}

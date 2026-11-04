import type { ReactNode } from 'react';
import { BizShell } from '@/apps/biz/layouts/BizShell';
import { BizAccessCover } from '@/apps/biz/components/BizAccessCover';
import { noIndexMetadata } from '@/lib/seo';

export const metadata = noIndexMetadata;

export default function BizConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <BizAccessCover>
      <BizShell>{children}</BizShell>
    </BizAccessCover>
  );
}

import type { ReactNode } from 'react';
import { BizLegalShell } from '@/components/biz/BizLegalShell';

export default function BizLegalLayout({ children }: { children: ReactNode }) {
  return <BizLegalShell>{children}</BizLegalShell>;
}

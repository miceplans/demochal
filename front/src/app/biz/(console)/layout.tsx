import type { ReactNode } from 'react';
import { BizShell } from '@/components/biz/BizShell';

export default function BizConsoleLayout({ children }: { children: ReactNode }) {
  return <BizShell>{children}</BizShell>;
}

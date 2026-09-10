import type { ReactNode } from 'react';
import { AdminShell } from '@/components/biz/AdminHeader';

export default function BizLegalLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}

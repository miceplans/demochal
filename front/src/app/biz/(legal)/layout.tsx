import type { ReactNode } from 'react';
import { AdminShell } from '@/apps/biz/components/AdminHeader';

export default function BizLegalLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}

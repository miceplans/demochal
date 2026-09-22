import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { AdminShell, AdminNavProvider } from '@/components/admin/AdminShell';
import { isAdminHostHeader } from '@/lib/admin';

export default async function AdminConsoleLayout({ children }: { children: ReactNode }) {
  const host = (await headers()).get('host');
  const base = isAdminHostHeader(host) ? '' : '/admin';
  return (
    <AdminNavProvider base={base}>
      <AdminShell>{children}</AdminShell>
    </AdminNavProvider>
  );
}

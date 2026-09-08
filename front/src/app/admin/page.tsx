import type { Metadata } from 'next';
import { PageShell } from '@/components/layout/PageShell';
import { AdminVerificationTable } from '@/features/verifications/components/AdminVerificationTable';

export const metadata: Metadata = {
  title: '관리자 페이지',
};

export default function AdminPage() {
  return (
    <PageShell title="사업자 검증 현황">
      <AdminVerificationTable />
    </PageShell>
  );
}

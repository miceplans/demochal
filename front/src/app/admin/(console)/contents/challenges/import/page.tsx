import type { Metadata } from 'next';
import { AdminChallengeImportScreen } from '@/components/admin/AdminChallengeImportScreen';

export const metadata: Metadata = { title: '공고 일괄 등록' };

export default function AdminChallengeImportRoute() {
  return <AdminChallengeImportScreen />;
}

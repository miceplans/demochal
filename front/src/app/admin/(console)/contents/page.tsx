import type { Metadata } from 'next';
import { AdminContentsScreen } from '@/apps/admin/components/AdminContentsScreen';

export const metadata: Metadata = {
  title: '콘텐츠 모니터링',
};

export default function AdminContentsRoute() {
  return <AdminContentsScreen />;
}

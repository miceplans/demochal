import type { Metadata } from 'next';
import { AdminContentsScreen } from '@/components/admin/AdminContentsScreen';

export const metadata: Metadata = {
  title: '콘텐츠 모니터링',
};

export default function AdminContentsRoute() {
  return <AdminContentsScreen />;
}

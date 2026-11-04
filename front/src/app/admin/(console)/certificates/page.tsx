import type { Metadata } from 'next';
import { AdminCertificatesScreen } from '@/apps/admin/components/AdminCertificatesScreen';

export const metadata: Metadata = {
  title: '상장 인증',
};

export default function AdminCertificatesRoute() {
  return <AdminCertificatesScreen />;
}

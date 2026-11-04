import type { Metadata } from 'next';
import { AdminRefundsScreen } from '@/components/admin/AdminRefundsScreen';

export const metadata: Metadata = {
  title: '환불 처리',
};

export default function AdminRefundsRoute() {
  return <AdminRefundsScreen />;
}

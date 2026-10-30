import type { Metadata } from 'next';
import { AdminPortfolioBadgesScreen } from '@/components/admin/AdminPortfolioBadgesScreen';

export const metadata: Metadata = {
  title: '포트폴리오 뱃지',
};

export default function AdminPortfolioBadgesRoute() {
  return <AdminPortfolioBadgesScreen />;
}

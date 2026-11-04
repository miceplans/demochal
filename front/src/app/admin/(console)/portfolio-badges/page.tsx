import type { Metadata } from 'next';
import { AdminPortfolioBadgesScreen } from '@/apps/admin/components/AdminPortfolioBadgesScreen';

export const metadata: Metadata = {
  title: '포트폴리오 뱃지',
};

export default function AdminPortfolioBadgesRoute() {
  return <AdminPortfolioBadgesScreen />;
}

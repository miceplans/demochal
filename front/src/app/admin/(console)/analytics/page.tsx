import type { Metadata } from 'next';
import { AdminAnalyticsScreen } from '@/apps/admin/components/AdminAnalyticsScreen';

export const metadata: Metadata = {
  title: '리포트',
};

export default function AdminAnalyticsRoute() {
  return <AdminAnalyticsScreen />;
}

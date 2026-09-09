import type { Metadata } from 'next';
import { AdminAnalyticsScreen } from '@/components/admin/AdminAnalyticsScreen';

export const metadata: Metadata = {
  title: '리포트',
};

export default function AdminAnalyticsRoute() {
  return <AdminAnalyticsScreen />;
}

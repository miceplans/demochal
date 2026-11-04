import type { Metadata } from 'next';
import { AdminContestListScreen } from '@/apps/admin/components/AdminContentListScreens';

export const metadata: Metadata = { title: '확인해야하는 챌린지' };

export default function AdminContestsRoute() {
  return <AdminContestListScreen />;
}

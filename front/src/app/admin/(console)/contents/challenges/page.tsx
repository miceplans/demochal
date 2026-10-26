import type { Metadata } from 'next';
import { AdminContestListScreen } from '@/components/admin/AdminContentListScreens';

export const metadata: Metadata = { title: '확인해야하는 챌린지' };

export default function AdminContestsRoute() {
  return <AdminContestListScreen />;
}

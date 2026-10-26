import type { Metadata } from 'next';
import { AdminTeamListScreen } from '@/components/admin/AdminContentListScreens';

export const metadata: Metadata = { title: '확인해야하는 팀' };

export default function AdminTeamsRoute() {
  return <AdminTeamListScreen />;
}

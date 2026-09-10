'use client';

import { userRows, type UserRow } from '@/data/admin-design';
import { maskEmail } from '@/lib/mask';
import { MaskedText } from '@/components/ui/MaskedText';
import {
  AdminPageTitle,
  AdminTable,
  Badge,
  FilterBar,
  SearchFilter,
  SelectFilter,
  type AdminColumn,
} from './parts';

const columns: AdminColumn<UserRow>[] = [
  { key: 'name', header: '이름', width: 100 },
  {
    key: 'email',
    header: '이메일',
    width: 200,
    render: (row) => <MaskedText value={row.email} masked={maskEmail(row.email)} />,
  },
  { key: 'position', header: '포지션', width: 100 },
  { key: 'reports', header: '신고 누적', width: 80 },
  {
    key: 'status',
    header: '상태',
    width: 80,
    render: (row) => <Badge tone={row.status === '활성' ? 'blue' : 'red'}>{row.status}</Badge>,
  },
];

export function AdminUsersScreen() {
  return (
    <>
      <AdminPageTitle>사용자 관리</AdminPageTitle>
      <FilterBar>
        <SearchFilter placeholder="이름/이메일 검색" label="이름/이메일 검색" />
        <SelectFilter label="가입일 범위" options={['최근 7일', '최근 30일', '최근 1년', '전체']} />
        <SelectFilter label="포지션 뱃지" options={['기획', '프론트엔드', '백엔드', '디자이너']} />
        <SelectFilter label="활동 상태" options={['활성', '정지']} />
      </FilterBar>
      <AdminTable columns={columns} rows={userRows} />
    </>
  );
}

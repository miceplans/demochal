'use client';

import { useMemo, useState } from 'react';
import { generated } from '@semochal/api-client';
import { maskEmail } from '@/lib/mask';
import { MaskedText } from '@/components/ui/MaskedText';
import type { UserRow } from '@/data/admin-design';
import {
  AdminInlineNotice,
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

const statusOptionToParam: Record<string, 'active' | 'suspended'> = {
  활성: 'active',
  정지: 'suspended',
};

export function AdminUsersScreen() {
  const [query, setQuery] = useState('');
  const [statusLabel, setStatusLabel] = useState('');

  const usersQuery = generated.useListAdminUsers({
    q: query || undefined,
    status: statusOptionToParam[statusLabel],
  });

  const rows = useMemo<UserRow[]>(
    () =>
      (usersQuery.data?.data ?? []).map((user, index) => ({
        id: user.id ?? String(index),
        name: user.name ?? '',
        email: user.email ?? '',
        position: user.position ?? '',
        reports: user.reports ?? 0,
        status: user.status === 'suspended' ? '정지' : '활성',
      })),
    [usersQuery.data],
  );

  return (
    <>
      <AdminPageTitle>사용자 관리</AdminPageTitle>
      <FilterBar>
        <SearchFilter
          placeholder="이름/이메일 검색"
          label="이름/이메일 검색"
          value={query}
          onChange={setQuery}
        />
        <SelectFilter label="가입일 범위" options={['최근 7일', '최근 30일', '최근 1년', '전체']} />
        <SelectFilter label="포지션 뱃지" options={['기획', '프론트엔드', '백엔드', '디자이너']} />
        <SelectFilter
          label="활동 상태"
          options={['활성', '정지']}
          value={statusLabel}
          onChange={setStatusLabel}
        />
      </FilterBar>
      {usersQuery.isPending ? (
        <AdminInlineNotice>불러오는 중...</AdminInlineNotice>
      ) : (
        <AdminTable columns={columns} rows={rows} />
      )}
    </>
  );
}

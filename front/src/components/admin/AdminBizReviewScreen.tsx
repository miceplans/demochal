'use client';

import { bizRows, bizStats, type BizRow } from '@/data/admin-design';
import {
  AdminPageTitle,
  AdminTable,
  Badge,
  FilterBar,
  SearchFilter,
  SelectFilter,
  StatCard,
  StatRow,
  type AdminColumn,
} from './parts';

const statusBadge: Record<BizRow['status'], 'blue' | 'green' | 'red'> = {
  대기: 'blue',
  승인: 'green',
  거부: 'red',
};

const columns: AdminColumn<BizRow>[] = [
  { key: 'org', header: '활동유형', width: 100 },
  { key: 'type', header: '유형', width: 80 },
  { key: 'bizNumber', header: '사업자 번호', width: 110 },
  { key: 'appliedAt', header: '신청일', width: 60 },
  {
    key: 'nts',
    header: 'NTS',
    width: 60,
    render: (row) => (
      <span style={{ color: row.nts === '성공' ? undefined : '#FF4D00' }}>{row.nts}</span>
    ),
  },
  {
    key: 'status',
    header: '상태',
    width: 60,
    render: (row) => <Badge tone={statusBadge[row.status]}>{row.status}</Badge>,
  },
];

export function AdminBizReviewScreen() {
  return (
    <>
      <AdminPageTitle>기관 심사</AdminPageTitle>
      <StatRow>
        {bizStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </StatRow>
      <FilterBar>
        <SearchFilter placeholder="기관명/담당자 검색" label="기관명/담당자 검색" />
        <SelectFilter label="기관유형" options={['비영리', '학교', '협회', '기업']} />
        <SelectFilter label="상태" options={['대기', '승인', '거부']} />
      </FilterBar>
      <AdminTable columns={columns} rows={bizRows} />
    </>
  );
}

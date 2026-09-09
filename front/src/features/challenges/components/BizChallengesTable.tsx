'use client';

import { useChallengesQuery } from '../api/queries';
import { DataTable } from '@/components/data/DataTable';
import { BizLink } from '@/components/biz/BizShell';
import { colors as c } from '@/styles/design';
import type { Challenge } from '@semochal/api-client';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';

const statusLabel: Record<Challenge['status'], string> = {
  draft: '임시',
  published: '게시중',
  closed: '종료',
};

const columns: ColumnDef<Challenge, unknown>[] = [
  {
    accessorKey: 'title',
    header: '챌린지명',
    cell: (info) => (
      <BizLink href={`/postings/${info.row.original.id}`} style={{ color: c.primary }}>
        <strong>{info.getValue() as string}</strong>
      </BizLink>
    ),
  },
  {
    accessorKey: 'price',
    header: '가격',
    cell: (info) => `${(info.getValue() as number).toLocaleString()}원`,
  },
  { accessorKey: 'capacity', header: '수용 인원' },
  {
    accessorKey: 'startDate',
    header: '시작일',
    cell: (info) => new Date(info.getValue() as string).toLocaleDateString('ko-KR'),
  },
  {
    accessorKey: 'endDate',
    header: '종료일',
    cell: (info) => new Date(info.getValue() as string).toLocaleDateString('ko-KR'),
  },
  {
    accessorKey: 'status',
    header: '상태',
    cell: (info) => statusLabel[info.getValue() as Challenge['status']],
  },
];

// 사업자: 목업 데이터 기반 내 챌린지 관리 테이블 (TanStack Table).
export function BizChallengesTable() {
  const { data, isPending } = useChallengesQuery();

  const rows = useMemo(() => data?.items ?? [], [data]);

  if (isPending) return <div style={{ padding: '24px 0', color: c.gray500 }}>불러오는 중...</div>;

  return <DataTable data={rows} columns={columns} emptyMessage="등록된 챌린지가 없습니다." />;
}

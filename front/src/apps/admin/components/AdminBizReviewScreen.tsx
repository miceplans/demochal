'use client';

import { useMemo, useState, type ReactNode } from 'react';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import type { BizRow } from '@/data/admin-design';
import { maskBizNumber } from '@/lib/mask';
import { MaskedText } from '@/components/ui/MaskedText';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
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
import { CloseIcon } from './AdminIcons';

// 기관은 가입 즉시 자동 승인되므로 이 화면은 심사 없이 기관 목록을 조회·관리하는 화면이다(거부는 차단된 기관 표시).
type BizReviewRow = BizRow;

const statusBadge: Record<BizRow['status'], 'green' | 'red' | 'gray'> = {
  승인: 'green',
  거부: 'red',
  '알 수 없음': 'gray',
};

const columns: AdminColumn<BizReviewRow>[] = [
  { key: 'org', header: '기관명', width: 100 },
  { key: 'type', header: '유형', width: 80 },
  {
    key: 'bizNumber',
    header: '사업자 번호',
    width: 110,
    render: (row) => <MaskedText value={row.bizNumber} masked={maskBizNumber(row.bizNumber)} />,
  },
  { key: 'appliedAt', header: '신청일', width: 60 },
  {
    key: 'nts',
    header: 'NTS',
    width: 60,
    render: (row) => (
      <span style={{ color: row.nts === '성공' ? undefined : c.red }}>{row.nts}</span>
    ),
  },
  {
    key: 'status',
    header: '상태',
    width: 60,
    render: (row) => <Badge tone={statusBadge[row.status]}>{row.status}</Badge>,
  },
];

const PANEL_WIDTH = 360;

function BizDetailPanel({ row, onClose }: { row: BizReviewRow; onClose: () => void }) {
  const details: [string, ReactNode][] = [
    ['기관 유형', row.type],
    [
      '사업자 번호',
      <MaskedText key="bizNumber" value={row.bizNumber} masked={maskBizNumber(row.bizNumber)} />,
    ],
    ['신청일', row.appliedAt],
    ['NTS 결과', row.nts],
  ];

  return (
    <Panel aria-label={`${row.org} 상세`}>
      <PanelHeader>
        <TitleRow>
          <PanelTitle>{row.org}</PanelTitle>
          <Badge tone={statusBadge[row.status]}>{row.status}</Badge>
        </TitleRow>
        <CloseButton type="button" aria-label="기관 상세 닫기" onClick={onClose}>
          <CloseIcon />
        </CloseButton>
      </PanelHeader>
      <InfoList>
        {details.map(([label, value]) => (
          <InfoItem key={label}>
            <InfoLabel>{label}</InfoLabel>
            <InfoValue>{value}</InfoValue>
          </InfoItem>
        ))}
      </InfoList>
    </Panel>
  );
}

const statusParam: Record<string, 'verified' | 'rejected'> = {
  승인: 'verified',
  거부: 'rejected',
};
const ntsLabel: Record<string, BizRow['nts']> = {
  success: '성공',
  failed: '실패',
  closed: '폐업/폐점',
  unrecognized: '인식불가',
};
const bizStatusLabel: Record<string, BizRow['status']> = {
  verified: '승인',
  rejected: '거부',
};

export function AdminBizReviewScreen() {
  const [selected, setSelected] = useState<BizReviewRow | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [bizType, setBizType] = useState('');

  const businessesQuery = generated.useListAdminBusinesses({
    q: query || undefined,
    type: bizType && bizType !== '전체' ? bizType : undefined,
    status: statusParam[status],
  });

  const bizRows = useMemo<BizReviewRow[]>(
    () =>
      (businessesQuery.data?.data.items ?? []).map((entry, index) => ({
        id: entry.id ?? String(index),
        org: entry.org ?? '',
        type: entry.type ?? '',
        bizNumber: entry.bizNumber ?? '',
        appliedAt: entry.appliedAt ?? '',
        nts: ntsLabel[entry.nts ?? ''] ?? '인식불가',
        status: bizStatusLabel[entry.status ?? ''] ?? '알 수 없음',
      })),
    [businessesQuery.data],
  );
  const bizStats = businessesQuery.data?.data.stats ?? [];

  const selectBiz = (row: BizReviewRow) =>
    setSelected((current) => (current?.id === row.id ? null : row));
  const closePanel = () => setSelected(null);

  return (
    <>
      <AdminPageTitle>기관 관리</AdminPageTitle>
      <StatRow>
        {bizStats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label ?? ''}
            value={stat.value ?? ''}
            meta={stat.meta ?? ''}
            dot={stat.dot ?? undefined}
          />
        ))}
      </StatRow>
      <FilterBar>
        <SearchFilter
          placeholder="기관명/담당자 검색"
          label="기관명/담당자 검색"
          value={query}
          onChange={setQuery}
        />
        <SelectFilter
          label="기관유형"
          options={['전체', '비영리', '학교', '협회', '기업']}
          value={bizType}
          onChange={setBizType}
        />
        <SelectFilter label="상태" options={['승인', '거부']} value={status} onChange={setStatus} />
      </FilterBar>
      <BizWorkspace>
        <TableArea withPanel={Boolean(selected) || undefined}>
          <AdminTable
            columns={columns}
            rows={bizRows}
            onRowClick={selectBiz}
            selectedRowId={selected?.id}
          />
        </TableArea>
        {selected ? <BizDetailPanel row={selected} onClose={closePanel} /> : null}
      </BizWorkspace>
    </>
  );
}

const BizWorkspace = styled.div({
  display: 'flex',
  alignItems: 'stretch',
  minWidth: 0,
  background: c.white,
  '@media (max-width: 960px)': {
    flexDirection: 'column',
  },
});
const TableArea = styled('div', { shouldForwardProp: (prop) => prop !== 'withPanel' })<{
  withPanel?: boolean;
}>(({ withPanel }) => ({
  minWidth: 0,
  flex: 1,
  '& > [role="table"]': { borderRadius: withPanel ? '8px 0 0 8px' : 8 },
  '@media (max-width: 960px)': {
    '& > [role="table"]': { borderRadius: withPanel ? '8px 8px 0 0' : 8 },
  },
}));

const Panel = styled.aside({
  width: PANEL_WIDTH,
  minWidth: PANEL_WIDTH,
  boxSizing: 'border-box',
  background: c.white,
  border: `0.5px solid ${c.gray200}`,
  borderLeft: 0,
  borderRadius: '0 8px 8px 0',
  padding: '20px 24px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  '@media (max-width: 960px)': {
    width: 'auto',
    minWidth: 0,
    borderLeft: `0.5px solid ${c.gray200}`,
    borderTop: 0,
    borderRadius: '0 0 8px 8px',
  },
});
const PanelHeader = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
});
const CloseButton = styled.button({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 26,
  height: 26,
  border: 0,
  borderRadius: 6,
  background: 'transparent',
  color: c.gray500,
  '&:hover': { background: c.gray100, color: c.gray900 },
});
const PanelTitle = styled.strong({ ...textStyle.h3_2, color: c.gray900, lineHeight: 1.35 });
const TitleRow = styled.div({ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 });
const InfoList = styled.dl({
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  background: c.gray50,
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 8,
  padding: '4px 14px',
});
const InfoItem = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '9px 0',
  '& + &': { borderTop: `0.5px solid ${c.gray200}` },
});
const InfoLabel = styled.dt({ ...textStyle.metaText, color: c.gray500, flexShrink: 0 });
const InfoValue = styled.dd({
  margin: 0,
  ...textStyle.bodySmall,
  color: c.gray900,
  textAlign: 'right',
});

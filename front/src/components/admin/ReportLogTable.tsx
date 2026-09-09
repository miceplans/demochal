'use client';

import { useState } from 'react';
import styled from '@emotion/styled';
import { reportRows, type ReportRow } from '@/data/admin-design';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { AdminTable, Badge, type AdminColumn } from './parts';

const statusBadge: Record<ReportRow['status'], 'blue' | 'green' | 'red'> = {
  대기: 'blue',
  승인: 'green',
  거부: 'red',
};

const columns: AdminColumn<ReportRow>[] = [
  { key: 'content', header: '콘텐츠명', width: 100 },
  { key: 'type', header: '유형', width: 100 },
  { key: 'org', header: '등록기관', width: 200 },
  { key: 'summary', header: '신고요약', width: 150 },
  { key: 'status', header: '상태', width: 100, render: (row) => <Badge tone={statusBadge[row.status]}>{row.status}</Badge> },
];

const ReportWorkspace = styled.div({
  display: 'flex',
  alignItems: 'stretch',
  minWidth: 0,
  background: c.white,
  '@media (max-width: 960px)': {
    flexDirection: 'column',
  },
});
const TableArea = styled('div', { shouldForwardProp: (prop) => prop !== 'withPanel' })<{ withPanel?: boolean }>(
  ({ withPanel }) => ({
    minWidth: 0,
    flex: 1,
    '& > [role="table"]': { borderRadius: withPanel ? '8px 0 0 8px' : 8 },
    '@media (max-width: 960px)': {
      '& > [role="table"]': { borderRadius: withPanel ? '8px 8px 0 0' : 8 },
    },
  }),
);
const PANEL_WIDTH = 360;
const panelShell = {
  width: PANEL_WIDTH,
  minWidth: PANEL_WIDTH,
  boxSizing: 'border-box',
  background: c.white,
  border: '1px solid #DFE2E7',
  borderLeft: 0,
  borderRadius: '0 8px 8px 0',
  '@media (max-width: 960px)': {
    width: 'auto',
    minWidth: 0,
    borderLeft: '1px solid #DFE2E7',
    borderTop: 0,
    borderRadius: '0 0 8px 8px',
  },
} as const;
const Panel = styled.aside({
  ...panelShell,
  padding: '20px 24px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
});
const PanelHeader = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  paddingBottom: 14,
  borderBottom: '1px solid #E5E7EB',
});
const PanelEyebrow = styled.span({
  ...textStyle.labelSmall,
  letterSpacing: '0.04em',
  color: c.gray500,
  textTransform: 'uppercase',
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
const PanelStatus = styled.div({ display: 'flex', alignItems: 'center', gap: 8 });
const InfoList = styled.dl({
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  background: c.gray50,
  border: '1px solid #E5E7EB',
  borderRadius: 8,
  padding: '4px 14px',
});
const InfoItem = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '9px 0',
  '& + &': { borderTop: '1px solid #E5E7EB' },
});
const InfoLabel = styled.dt({ ...textStyle.metaText, color: c.gray500, flexShrink: 0 });
const InfoValue = styled.dd({ margin: 0, ...textStyle.bodySmall, color: c.gray900, textAlign: 'right' });
const BodySection = styled.section({ display: 'flex', flexDirection: 'column', gap: 8 });
const BodyLabel = styled.span({ ...textStyle.labelSmall, color: c.gray500, letterSpacing: '0.04em' });
const ReportBody = styled.p({
  margin: 0,
  padding: '12px 14px',
  background: c.gray50,
  border: '1px solid #E5E7EB',
  borderRadius: 8,
  color: c.gray700,
  ...textStyle.bodySmall,
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap',
});
const ActionRow = styled.div({
  display: 'flex',
  gap: 8,
  marginTop: 'auto',
  paddingTop: 4,
});
const ActionButton = styled.button<{ primary?: boolean }>(({ primary }) => ({
  flex: 1,
  height: 36,
  padding: '0 16px',
  border: primary ? 0 : '1px solid #E5E7EB',
  borderRadius: 6,
  background: primary ? c.primary : c.white,
  color: primary ? c.white : c.gray700,
  ...textStyle.buttonLabel,
  '&:hover': { background: primary ? '#0056C2' : c.gray100 },
}));

function CloseGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function ReportDetailPanel({ row, onClose }: { row: ReportRow; onClose: () => void }) {
  const details = [
    ['신고자', row.reporter],
    ['신고 일시', row.reportedAt],
    ['콘텐츠 유형', row.type],
    ['등록 기관', row.org],
  ];

  return (
    <Panel aria-label={`${row.content} 신고 상세`}>
      <PanelHeader>
        <PanelEyebrow>신고 상세</PanelEyebrow>
        <CloseButton type="button" aria-label="신고 상세 닫기" onClick={onClose}>
          <CloseGlyph />
        </CloseButton>
      </PanelHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PanelTitle>{row.content}</PanelTitle>
        <PanelStatus>
          <span style={{ ...textStyle.metaText, color: c.gray500 }}>신고 사유</span>
          <span style={{ ...textStyle.bodySmall2, color: c.gray900 }}>{row.summary}</span>
          <Badge tone={statusBadge[row.status]}>{row.status}</Badge>
        </PanelStatus>
      </div>
      <InfoList>
        {details.map(([label, value]) => (
          <InfoItem key={label}>
            <InfoLabel>{label}</InfoLabel>
            <InfoValue>{value}</InfoValue>
          </InfoItem>
        ))}
      </InfoList>
      <BodySection>
        <BodyLabel>신고 내용</BodyLabel>
        <ReportBody>{row.detail}</ReportBody>
      </BodySection>
      {row.status === '대기' ? (
        <ActionRow>
          <ActionButton type="button">거부</ActionButton>
          <ActionButton type="button" primary>
            승인
          </ActionButton>
        </ActionRow>
      ) : null}
    </Panel>
  );
}

export function ReportLogTable() {
  const [selected, setSelected] = useState<ReportRow | null>(null);

  const selectReport = (row: ReportRow) => setSelected((current) => (current?.id === row.id ? null : row));
  const closePanel = () => setSelected(null);

  return (
    <ReportWorkspace>
      <TableArea withPanel={Boolean(selected) || undefined}>
        <AdminTable columns={columns} rows={reportRows} onRowClick={selectReport} selectedRowId={selected?.id} />
      </TableArea>
      {selected ? <ReportDetailPanel row={selected} onClose={closePanel} /> : null}
    </ReportWorkspace>
  );
}

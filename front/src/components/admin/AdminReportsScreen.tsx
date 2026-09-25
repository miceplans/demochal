'use client';

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { downloadCsv } from '@/lib/csv';
import { AdminPageTitle, FilterBar, SearchFilter, SelectFilter } from './parts';
import { ReportLogTable } from './ReportLogTable';

type ReportFilters = NonNullable<Parameters<typeof generated.listAdminReports>[0]>;

const targetTypeLabel: Record<string, string> = {
  challenge: '공모전',
  team: '팀 모집',
  award: '수상작',
  user: '프로필',
};
const statusLabel: Record<string, string> = { open: '대기', resolved: '승인', dismissed: '거부' };

function DownloadGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

export function AdminReportsScreen() {
  const [exportOpen, setExportOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [targetType, setTargetType] = useState('');
  const [status, setStatus] = useState('');
  const params = useMemo(
    () => ({
      q: query || undefined,
      targetType: (targetType || undefined) as ReportFilters['targetType'],
      status: (status || undefined) as ReportFilters['status'],
    }),
    [query, status, targetType],
  );
  const reportsQuery = generated.useListAdminReports(params);
  const closeExport = () => setExportOpen(false);
  const downloadReports = () => {
    const headers = ['콘텐츠명', '신고 유형', '등록기관', '신고요약', '상태', '신고자', '신고일시'];
    const rows = (reportsQuery.data?.data ?? []).map((report) => [
      report.content ?? '',
      targetTypeLabel[report.targetType ?? ''] ?? report.targetType ?? '',
      report.org ?? '',
      report.summary ?? '',
      statusLabel[report.status ?? ''] ?? report.status ?? '',
      report.reporter ?? '',
      report.reportedAt ? new Date(report.reportedAt).toLocaleString('ko-KR') : '',
    ]);
    downloadCsv('semochal-reports.csv', headers, rows);
    closeExport();
  };

  return (
    <>
      <TitleRow>
        <AdminPageTitle>신고 처리</AdminPageTitle>
        <ExportButton type="button" onClick={() => setExportOpen(true)}>
          <DownloadGlyph />
          내보내기
        </ExportButton>
      </TitleRow>
      <FilterBar>
        <SearchFilter
          placeholder="콘텐츠명/기관명 검색"
          label="콘텐츠명/기관명 검색"
          value={query}
          onChange={setQuery}
        />
        <SelectFilter
          label="신고 유형"
          options={['공모전', '팀 모집', '수상작', '프로필']}
          value={targetTypeLabel[targetType] ?? ''}
          onChange={(value) =>
            setTargetType(
              { 공모전: 'challenge', '팀 모집': 'team', 수상작: 'award', 프로필: 'user' }[value] ??
                '',
            )
          }
        />
        <SelectFilter
          label="상태"
          options={['대기', '승인', '거부']}
          value={statusLabel[status] ?? ''}
          onChange={(value) =>
            setStatus({ 대기: 'open', 승인: 'resolved', 거부: 'dismissed' }[value] ?? '')
          }
        />
      </FilterBar>
      <ReportLogTable params={params} />
      {exportOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <Backdrop role="presentation" onMouseDown={closeExport}>
            <Modal
              role="dialog"
              aria-modal="true"
              aria-labelledby="report-export-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <ModalContent>
                <ExcelLogo src="/assets/microsoft/exel.png" alt="Excel" />
                <ModalTitle id="report-export-title">CSV 파일로 다운로드</ModalTitle>
                <ModalText>현재 필터가 적용된 신고 목록을 CSV 파일로 저장합니다.</ModalText>
              </ModalContent>
              <ModalActions>
                <ModalButton type="button" onClick={closeExport}>
                  취소
                </ModalButton>
                <ModalButton type="button" primary onClick={downloadReports}>
                  다운로드
                </ModalButton>
              </ModalActions>
            </Modal>
          </Backdrop>,
          document.body,
        )}
    </>
  );
}

const TitleRow = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});

const ExportButton = styled.button({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 40,
  padding: '0 16px',
  border: `1px solid ${c.gray300}`,
  borderRadius: 6,
  background: c.white,
  color: c.gray900,
  cursor: 'pointer',
  ...textStyle.subtitle,
  '&:hover': { background: c.gray50 },
});

const Backdrop = styled.div({
  position: 'fixed',
  zIndex: 100,
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  background: 'rgba(17, 24, 39, .46)',
});
const Modal = styled.div({
  width: 'min(100%, 416px)',
  padding: 28,
  borderRadius: 12,
  background: c.white,
  boxShadow: '0 20px 48px rgba(17, 24, 39, .22)',
});
const ModalContent = styled.div({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
});
const ExcelLogo = styled.img({ width: 64, height: 64, objectFit: 'contain' });
const ModalTitle = styled.h2({ margin: '16px 0 0', ...textStyle.h2_2, color: c.gray900 });
const ModalText = styled.p({ margin: '10px 0 0', color: c.gray500, ...textStyle.body });
const ModalActions = styled.div({
  display: 'flex',
  justifyContent: 'center',
  gap: 8,
  marginTop: 28,
});
const ModalButton = styled('button', { shouldForwardProp: (prop) => prop !== 'primary' })<{
  primary?: boolean;
}>(({ primary }) => ({
  height: 40,
  padding: '0 18px',
  border: primary ? 0 : `1px solid ${c.gray300}`,
  borderRadius: 6,
  background: primary ? c.primary : c.white,
  color: primary ? c.white : c.gray900,
  cursor: 'pointer',
  ...textStyle.subtitle,
}));

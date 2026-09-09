'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import {
  AdminPageTitle,
  FilterBar,
  SearchFilter,
  SelectFilter,
} from './parts';
import { ReportLogTable } from './ReportLogTable';

const TitleRow = styled.div({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' });

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

const Backdrop = styled.div({ position: 'fixed', zIndex: 100, inset: 0, display: 'grid', placeItems: 'center', padding: 24, background: 'rgba(17, 24, 39, .46)' });
const Modal = styled.div({ width: 'min(100%, 416px)', padding: 28, borderRadius: 12, background: c.white, boxShadow: '0 20px 48px rgba(17, 24, 39, .22)' });
const ModalContent = styled.div({ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' });
const ExcelLogo = styled.img({ width: 64, height: 64, objectFit: 'contain' });
const ModalTitle = styled.h2({ margin: '16px 0 0', ...textStyle.h2_2, color: c.gray900 });
const ModalText = styled.p({ margin: '10px 0 0', color: c.gray500, ...textStyle.body });
const ModalActions = styled.div({ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 28 });
const ModalButton = styled('button', { shouldForwardProp: (prop) => prop !== 'primary' })<{ primary?: boolean }>(({ primary }) => ({ height: 40, padding: '0 18px', border: primary ? 0 : `1px solid ${c.gray300}`, borderRadius: 6, background: primary ? c.primary : c.white, color: primary ? c.white : c.gray900, cursor: 'pointer', ...textStyle.subtitle }));

function DownloadGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

export function AdminReportsScreen() {
  const [exportOpen, setExportOpen] = useState(false);
  const closeExport = () => setExportOpen(false);

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
        <SearchFilter placeholder="기관명/담당자 검색" label="기관명/담당자 검색" />
        <SelectFilter label="기관유형" options={['비영리', '학교', '협회', '기업']} />
        <SelectFilter label="상태" options={['대기', '승인', '거부']} />
      </FilterBar>
      <ReportLogTable />
      {exportOpen && typeof document !== 'undefined' && createPortal(
        <Backdrop role="presentation" onMouseDown={closeExport}>
          <Modal role="dialog" aria-modal="true" aria-labelledby="report-export-title" onMouseDown={(event) => event.stopPropagation()}>
            <ModalContent>
              <ExcelLogo src="/assets/microsoft/exel.png" alt="Excel" />
              <ModalTitle id="report-export-title">exel 파일로 다운 받기</ModalTitle>
              <ModalText>신고 처리 목록을 엑셀 파일로 저장할 수 있습니다.</ModalText>
            </ModalContent>
            <ModalActions>
              <ModalButton type="button" onClick={closeExport}>취소</ModalButton>
              <ModalButton type="button" primary onClick={closeExport}>다운로드</ModalButton>
            </ModalActions>
          </Modal>
        </Backdrop>, document.body,
      )}
    </>
  );
}

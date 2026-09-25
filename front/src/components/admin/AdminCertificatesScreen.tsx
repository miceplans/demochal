'use client';

import { useMemo, useState } from 'react';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { certificateTabs, type CertificateRow } from '@/data/admin-design';
import { useToast } from '@/components/common/Toast';
import {
  AdminPageTitle,
  ApproveButton,
  FilterBar,
  RejectButton,
  SearchFilter,
  SelectFilter,
} from './parts';

type CertificateListRow = CertificateRow & {
  fileUrl: string | null;
  fileContentType: string | null;
};

const categoryOptionToParam: Record<string, 'award' | 'participation'> = {
  '수상 실적': 'award',
  '출품 이력': 'participation',
};

// 목록 응답의 private 원본 URL은 5분 presigned GET이다. 화면을 열어둔 동안 만료 전에
// 목록을 다시 받아 미리보기에 만료된 링크가 쓰이지 않게 한다.
const FILE_URL_REFRESH_MS = 4 * 60_000;

const tabToStatus: Record<(typeof certificateTabs)[number], 'pending' | 'verified' | 'rejected'> = {
  미인증: 'pending',
  인증: 'verified',
  거부: 'rejected',
};

function TrophyGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

export function AdminCertificatesScreen() {
  const [tab, setTab] = useState<(typeof certificateTabs)[number]>('미인증');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<CertificateListRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [query, setQuery] = useState('');
  const [categoryLabel, setCategoryLabel] = useState('');
  const toast = useToast();

  const certificatesQuery = generated.useListAdminCertificates(
    {
      status: tabToStatus[tab],
      q: query || undefined,
      category: categoryOptionToParam[categoryLabel],
    },
    { query: { refetchInterval: FILE_URL_REFRESH_MS } },
  );

  const rows = useMemo<CertificateListRow[]>(
    () =>
      (certificatesQuery.data?.data ?? []).map((cert, index) => ({
        id: cert.id ?? String(index),
        user: cert.user ?? '',
        award: cert.award ?? '',
        category: cert.category === 'participation' ? '출품 이력' : '수상 실적',
        status:
          cert.status === 'verified' ? '인증' : cert.status === 'rejected' ? '거부' : '미인증',
        fileUrl: cert.fileUrl ?? null,
        fileContentType: cert.fileContentType ?? null,
      })),
    [certificatesQuery.data],
  );

  const verifyMutation = generated.useVerifyCertificate({
    mutation: {
      onSuccess: (_data, variables) => {
        toast.success(
          variables.data.action === 'approve' ? '인증을 승인했어요.' : '인증을 거부했어요.',
        );
        certificatesQuery.refetch();
        setPreviewId(null);
        closeReject();
      },
      onError: () => toast.error('처리에 실패했어요', '잠시 후 다시 시도해주세요'),
    },
  });

  const preview = rows.find((row) => row.id === previewId) ?? null;
  const approve = (id: string) => verifyMutation.mutate({ id, data: { action: 'approve' } });
  const closeReject = () => {
    setRejectTarget(null);
    setRejectReason('');
  };
  const submitReject = () => {
    const reason = rejectReason.trim();
    if (!rejectTarget || !reason) return;
    verifyMutation.mutate({ id: rejectTarget.id, data: { action: 'reject', reason } });
  };

  return (
    <>
      <AdminPageTitle>상장 인증</AdminPageTitle>
      <FilterBar>
        <SearchFilter
          placeholder="사용자 검색"
          label="사용자 검색"
          value={query}
          onChange={setQuery}
        />
        <SelectFilter
          label="상장 유형"
          options={['전체', '수상 실적', '출품 이력']}
          value={categoryLabel}
          onChange={setCategoryLabel}
        />
      </FilterBar>
      <TabBar role="tablist" aria-label="상장 인증 상태">
        {certificateTabs.map((label) => (
          <TabItem
            key={label}
            role="tab"
            aria-selected={tab === label}
            active={tab === label || undefined}
            onClick={() => setTab(label)}
          >
            {label}
          </TabItem>
        ))}
      </TabBar>
      <div style={{ border: `1px solid ${c.gray200}`, borderRadius: 8, overflow: 'hidden' }}>
        <List>
          {rows.map((row) => (
            <Item key={row.id}>
              <ThumbButton
                onClick={() => setPreviewId(row.id)}
                aria-label={`${row.user} 상장 원본 보기`}
              >
                <CertificateThumb row={row} />
              </ThumbButton>
              <MiniAvatar aria-hidden>{row.user[0]}</MiniAvatar>
              <UserInfo>
                <UserName>{row.user}</UserName>
                <AwardTitle>{row.award}</AwardTitle>
              </UserInfo>
              <HistoryPill>
                <TrophyGlyph />
                {row.category}
              </HistoryPill>
              <Actions>
                <RejectButton
                  onClick={() => setRejectTarget(row)}
                  disabled={verifyMutation.isPending}
                >
                  거부
                </RejectButton>
                <ApproveButton onClick={() => approve(row.id)} disabled={verifyMutation.isPending}>
                  승인
                </ApproveButton>
              </Actions>
            </Item>
          ))}
          {rows.length === 0 ? (
            <Item style={{ justifyContent: 'center', color: c.gray500, ...textStyle.body }}>
              해당 상태의 인증 요청이 없습니다.
            </Item>
          ) : null}
        </List>
      </div>

      {preview ? (
        <Overlay
          role="dialog"
          aria-modal="true"
          aria-label={`${preview.user} 상장 미리보기`}
          onClick={() => setPreviewId(null)}
        >
          <Dialog onClick={(event) => event.stopPropagation()}>
            <CertificateOriginal row={preview} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <RejectButton
                onClick={() => {
                  setPreviewId(null);
                  setRejectTarget(preview);
                }}
                disabled={verifyMutation.isPending}
              >
                거부
              </RejectButton>
              <ApproveButton
                onClick={() => approve(preview.id)}
                disabled={verifyMutation.isPending}
              >
                승인
              </ApproveButton>
            </div>
          </Dialog>
        </Overlay>
      ) : null}

      {rejectTarget ? (
        <Overlay
          role="dialog"
          aria-modal="true"
          aria-labelledby="certificate-reject-title"
          onClick={closeReject}
        >
          <Dialog onClick={(event) => event.stopPropagation()} style={{ width: 360 }}>
            <RejectTitle id="certificate-reject-title">인증을 거부할까요?</RejectTitle>
            <RejectMeta>
              {rejectTarget.user} · {rejectTarget.award}
            </RejectMeta>
            <RejectLabel htmlFor="certificate-reject-reason">거부 사유</RejectLabel>
            <RejectTextarea
              id="certificate-reject-reason"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="사용자에게 전달될 거부 사유를 입력해주세요"
              rows={3}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <ApproveButton
                onClick={closeReject}
                style={{ background: c.white, color: c.gray700, border: `1px solid ${c.gray300}` }}
              >
                취소
              </ApproveButton>
              <RejectButton
                onClick={submitReject}
                disabled={verifyMutation.isPending || !rejectReason.trim()}
              >
                {verifyMutation.isPending ? '처리 중…' : '거부'}
              </RejectButton>
            </div>
          </Dialog>
        </Overlay>
      ) : null}
    </>
  );
}

const isPdf = (row: CertificateListRow) => row.fileContentType === 'application/pdf';

function CertificateThumb({ row }: { row: CertificateListRow }) {
  if (!row.fileUrl) return <ThumbPlaceholder>원본 없음</ThumbPlaceholder>;
  if (isPdf(row)) return <ThumbPlaceholder>PDF</ThumbPlaceholder>;
  return <Thumb src={row.fileUrl} alt={`${row.user} 상장`} />;
}

function CertificateOriginal({ row }: { row: CertificateListRow }) {
  if (!row.fileUrl) {
    return <PreviewPlaceholder>업로드가 완료되지 않아 원본을 볼 수 없어요.</PreviewPlaceholder>;
  }
  if (isPdf(row)) {
    return (
      <PreviewPlaceholder>
        <a href={row.fileUrl} target="_blank" rel="noreferrer noopener">
          PDF 원본 새 창에서 열기
        </a>
      </PreviewPlaceholder>
    );
  }
  return <PreviewImage src={row.fileUrl} alt={`${row.user} 상장 원본`} />;
}

const TabBar = styled.div({ display: 'flex', gap: 8 });
const TabItem = styled.button<{ active?: boolean }>(({ active }) => ({
  width: 90,
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid',
  borderColor: active ? c.gray200 : c.gray200,
  background: active ? '#F8FAFC' : c.white,
  ...textStyle.subtitle,
  color: c.gray900,
}));

const List = styled.ul({
  display: 'flex',
  flexDirection: 'column',
  listStyle: 'none',
  margin: 0,
  padding: 0,
});
const Item = styled.li({
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  padding: '18px 16px',
  borderTop: `1px solid ${c.gray200}`,
  background: c.white,
});
const ThumbButton = styled.button({
  padding: 0,
  border: 0,
  background: 'none',
  flexShrink: 0,
  cursor: 'pointer',
});
const Thumb = styled.img({
  width: 56,
  height: 79,
  objectFit: 'cover',
  borderRadius: 8,
  border: `1px solid ${c.gray200}`,
});
const MiniAvatar = styled.span({
  width: 32,
  height: 32,
  borderRadius: '50%',
  background: '#EFF6FF',
  color: c.primary,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  ...textStyle.caption2,
  flexShrink: 0,
});
const UserInfo = styled.div({ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 });
const UserName = styled.strong({ ...textStyle.body, color: c.gray900 });
const AwardTitle = styled.span({
  ...textStyle.metaText,
  color: c.gray500,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
const HistoryPill = styled.span({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  height: 21,
  padding: '4px 10px',
  borderRadius: 20,
  background: c.lightGreen,
  color: c.green,
  ...textStyle.finePrint,
  flexShrink: 0,
});
const Actions = styled.div({ display: 'flex', gap: 8, marginLeft: 'auto', flexShrink: 0 });

const Overlay = styled.div({
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.2)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
});
const Dialog = styled.div({
  background: c.white,
  border: `1px solid ${c.gray200}`,
  borderRadius: 6,
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
});
const PreviewImage = styled.img({
  width: 258,
  height: 366,
  objectFit: 'contain',
  borderRadius: 4,
  background: c.gray100,
});
const ThumbPlaceholder = styled.span({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 56,
  height: 79,
  borderRadius: 8,
  border: `1px solid ${c.gray200}`,
  background: c.gray100,
  color: c.gray500,
  ...textStyle.finePrint,
});
const PreviewPlaceholder = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 258,
  height: 366,
  padding: 16,
  borderRadius: 4,
  background: c.gray100,
  color: c.gray500,
  textAlign: 'center',
  ...textStyle.body,
  '& a': { color: c.primary, textDecoration: 'underline' },
});
const RejectTitle = styled.h2({ margin: 0, ...textStyle.h3_2, color: c.gray900 });
const RejectMeta = styled.span({ ...textStyle.metaText, color: c.gray500 });
const RejectLabel = styled.label({ ...textStyle.metaText, color: c.gray500 });
const RejectTextarea = styled.textarea({
  resize: 'vertical',
  padding: '10px 12px',
  border: `1px solid ${c.gray300}`,
  borderRadius: 8,
  color: c.gray900,
  ...textStyle.bodySmall,
  '&:focus': { outline: 'none', borderColor: c.primary },
});

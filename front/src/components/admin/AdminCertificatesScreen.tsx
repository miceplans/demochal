'use client';

import { useState } from 'react';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import {
  certificateRows,
  certificateTabs,
  type CertificateRow,
} from '@/data/admin-design';
import {
  AdminPageTitle,
  ApproveButton,
  FilterBar,
  RejectButton,
  SearchFilter,
  SelectFilter,
} from './parts';

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
  objectFit: 'cover',
  borderRadius: 4,
});

function TrophyGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
  const [preview, setPreview] = useState<CertificateRow | null>(null);
  const rows = certificateRows.filter((row) => row.status === tab);

  return (
    <>
      <AdminPageTitle>상장 인증</AdminPageTitle>
      <FilterBar>
        <SearchFilter placeholder="사용자 검색" label="사용자 검색" />
        <SelectFilter label="상장 유형" options={['수상 실적', '출품 이력']} />
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
              <ThumbButton onClick={() => setPreview(row)} aria-label={`${row.user} 상장 원본 보기`}>
                <Thumb src="/assets/certificate.png" alt={`${row.user} 상장`} />
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
                <RejectButton>거부</RejectButton>
                <ApproveButton>승인</ApproveButton>
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
          onClick={() => setPreview(null)}
        >
          <Dialog onClick={(event) => event.stopPropagation()}>
            <PreviewImage src="/assets/certificate.png" alt={`${preview.user} 상장 원본`} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <RejectButton>거부</RejectButton>
              <ApproveButton>승인</ApproveButton>
            </div>
          </Dialog>
        </Overlay>
      ) : null}
    </>
  );
}

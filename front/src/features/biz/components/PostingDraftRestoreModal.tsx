'use client';

import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { PopupAction } from './BizAdsPage.styles';

function formatSavedAt(savedAt: number): string {
  return new Date(savedAt).toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 공고 작성/수정 진입 시 자동 저장된 임시 저장본이 있으면 불러올지 묻는다.
// 둘 중 하나를 고르기 전에는 닫히지 않는다 — 선택 전 자동 저장이 임시 저장본을 덮지 않게 하기 위함.
export function PostingDraftRestoreModal({
  savedAt,
  onRestore,
  onDiscard,
}: {
  savedAt: number;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <Backdrop role="presentation">
      <Popup
        role="dialog"
        aria-modal="true"
        aria-labelledby="posting-draft-title"
        aria-describedby="posting-draft-desc"
      >
        <h2 id="posting-draft-title" style={{ margin: 0, ...textStyle.display }}>
          임시 저장된 공고가 있어요
        </h2>
        <Desc id="posting-draft-desc">
          {formatSavedAt(savedAt)}에 자동 저장된 내용을 불러올까요?
          <br />
          불러오지 않으면 임시 저장본은 삭제돼요.
        </Desc>
        <Actions>
          <PopupAction type="button" secondary onClick={onDiscard}>
            불러오지 않기
          </PopupAction>
          <PopupAction type="button" onClick={onRestore} autoFocus>
            불러오기
          </PopupAction>
        </Actions>
      </Popup>
    </Backdrop>,
    document.body,
  );
}

const Backdrop = styled.div({
  position: 'fixed',
  zIndex: 100,
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  background: 'rgba(17, 17, 17, .2)',
});
const Popup = styled.div({
  width: 'min(100%, 427px)',
  padding: 30,
  borderRadius: 9,
  background: c.white,
  boxShadow: '0 20px 48px rgba(17, 24, 39, .22)',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
});
const Desc = styled.p({ margin: 0, color: c.gray700, ...textStyle.body });
const Actions = styled.div({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 });

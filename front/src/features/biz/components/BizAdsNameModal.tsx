'use client';

import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { PopupAction } from './BizAdsPage.styles';
import type { BizAdsController } from './useBizAdsController';

// 광고명·링크 입력 모달: 이미지 업로드 뒤 광고 정보를 받아 등록/결제 단계로 넘긴다.
export function BizAdsNameModal({ controller }: { controller: BizAdsController }) {
  const {
    nameModalPlacement,
    setNameModalPlacement,
    adName,
    setAdName,
    adLink,
    setAdLink,
    submitting,
    submitContent,
  } = controller;
  if (!nameModalPlacement || typeof document === 'undefined') return null;
  return createPortal(
    <NameBackdrop role="presentation" onMouseDown={() => setNameModalPlacement(null)}>
      <NamePopup
        role="dialog"
        aria-modal="true"
        aria-labelledby="ad-name-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="ad-name-title" style={{ margin: 0, ...textStyle.display }}>
          광고명
        </h2>
        <NameFields>
          <NameInput
            value={adName}
            onChange={(event) => setAdName(event.target.value)}
            placeholder="광고명을 입력해주세요"
            aria-label="광고명"
            maxLength={30}
            autoFocus
          />
          <NameInput
            value={adLink}
            onChange={(event) => setAdLink(event.target.value)}
            placeholder="https:// 광고 클릭 시 이동할 링크 (선택)"
            aria-label="광고 링크"
            inputMode="url"
          />
        </NameFields>
        <PopupActions>
          <PopupAction type="button" secondary onClick={() => setNameModalPlacement(null)}>
            취소
          </PopupAction>
          <PopupAction
            type="button"
            disabled={!adName.trim() || submitting}
            onClick={() => void submitContent(nameModalPlacement)}
          >
            등록하기
          </PopupAction>
        </PopupActions>
      </NamePopup>
    </NameBackdrop>,
    document.body,
  );
}

const NameBackdrop = styled.div({
  position: 'fixed',
  zIndex: 100,
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  background: 'rgba(17, 17, 17, .2)',
});
const NamePopup = styled.div({
  width: 'min(100%, 427px)',
  padding: 30,
  borderRadius: 9,
  background: c.white,
  boxShadow: '0 20px 48px rgba(17, 24, 39, .22)',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
});
const NameFields = styled.div({ display: 'flex', flexDirection: 'column', gap: 8 });
const NameInput = styled.input({
  width: '100%',
  height: 44,
  padding: '0 14px',
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 8,
  background: c.white,
  color: c.gray900,
  ...textStyle.body,
  '&::placeholder': { color: c.gray500 },
  '&:focus': { outline: 'none', borderColor: c.primary },
});
const PopupActions = styled.div({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 });

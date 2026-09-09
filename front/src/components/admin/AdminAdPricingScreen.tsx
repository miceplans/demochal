'use client';

import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { adPricing } from '@/data/admin-design';
import { AdPlacementPreview, type AdPlacement, type AdPreviewView } from '@/components/ads/AdPlacementPreview';
import { useToast } from '@/components/common/Toast';
import { AdminPageTitle } from './parts';

const TitleRow = styled.div({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' });

const ViewSwitch = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 20px',
  background: c.white,
  borderRadius: 6,
});

const ViewButton = styled('button', { shouldForwardProp: (prop) => prop !== 'active' })<{ active: boolean }>(
  ({ active }) => ({
    border: 0,
    borderRadius: 6,
    padding: '10px 20px',
    ...textStyle.subtitle,
    background: active ? c.primary : 'transparent',
    color: active ? c.white : c.gray900,
    cursor: 'pointer',
  }),
);

const PreviewWrap = styled.div({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
});

const PreviewCaption = styled.span({ ...textStyle.metaText, color: c.gray500 });

const Backdrop = styled.div({ position: 'fixed', zIndex: 100, inset: 0, display: 'grid', placeItems: 'center', padding: 24, background: 'rgba(17, 24, 39, .46)' });
const Modal = styled.div({ width: 'min(100%, 416px)', padding: 28, borderRadius: 12, background: c.white, boxShadow: '0 20px 48px rgba(17, 24, 39, .22)' });
const ModalTitle = styled.h2({ margin: 0, ...textStyle.h2_2, color: c.gray900 });
const ModalText = styled.p({ margin: '10px 0 24px', color: c.gray500, ...textStyle.body });
const FieldLabel = styled.label({ display: 'grid', gap: 8, color: c.gray900, ...textStyle.subtitle });
const PriceField = styled.div({ display: 'flex', alignItems: 'center', overflow: 'hidden', height: 48, border: `1px solid ${c.gray300}`, borderRadius: 8, background: c.white, '&:focus-within': { borderColor: c.primary, boxShadow: `0 0 0 3px ${c.primary}20` } });
const PriceInput = styled.input({ width: '100%', minWidth: 0, height: '100%', padding: '0 14px', border: 0, outline: 0, color: c.gray900, background: 'transparent', ...textStyle.bodyLarge });
const Won = styled.span({ paddingRight: 14, color: c.gray500, ...textStyle.body });
const ModalActions = styled.div({ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 28 });
const ModalButton = styled('button', { shouldForwardProp: (prop) => prop !== 'primary' })<{ primary?: boolean }>(({ primary }) => ({ height: 40, padding: '0 18px', border: primary ? 0 : `1px solid ${c.gray300}`, borderRadius: 6, background: primary ? c.primary : c.white, color: primary ? c.white : c.gray900, cursor: 'pointer', ...textStyle.subtitle }));

const placementName: Record<AdPlacement, string> = { hero: '홈 상단 배너 광고', gallery: '홈 중간 이미지 광고' };
const digitsOnly = (value: string) => value.replace(/[^0-9]/g, '');

export function AdminAdPricingScreen() {
  const [view, setView] = useState<AdPreviewView>('pc');
  const [price, setPrice] = useState(adPricing.dailyPrice);
  const [selectedPlacement, setSelectedPlacement] = useState<AdPlacement | null>(null);
  const [editingPlacement, setEditingPlacement] = useState<AdPlacement | null>(null);
  const [draft, setDraft] = useState(String(adPricing.dailyPrice));
  const inputId = useId();
  const toast = useToast();
  const openEditor = (placement: AdPlacement) => { setEditingPlacement(placement); setDraft(String(price)); };
  const startEditing = () => {
    if (!selectedPlacement) return;
    openEditor(selectedPlacement);
    setSelectedPlacement(null);
  };
  const closeEditor = () => setEditingPlacement(null);
  const savePrice = () => {
    const nextPrice = Number(digitsOnly(draft));
    if (!Number.isFinite(nextPrice) || nextPrice <= 0) { toast.error('광고비를 확인해주세요', '0원보다 큰 금액을 입력해 주세요.'); return; }
    setPrice(nextPrice);
    closeEditor();
    toast.success('광고비가 수정되었습니다', `하루 광고비 ${nextPrice.toLocaleString()}원`);
  };

  return (
    <>
      <TitleRow>
        <AdminPageTitle>광고비 관리</AdminPageTitle>
        <ViewSwitch role="tablist" aria-label="미리보기 화면 전환">
          <ViewButton
            type="button"
            role="tab"
            aria-selected={view === 'mobile'}
            active={view === 'mobile'}
            onClick={() => setView('mobile')}
          >
            모바일 뷰
          </ViewButton>
          <ViewButton
            type="button"
            role="tab"
            aria-selected={view === 'pc'}
            active={view === 'pc'}
            onClick={() => setView('pc')}
          >
            PC 뷰
          </ViewButton>
        </ViewSwitch>
      </TitleRow>
      <PreviewWrap>
        <AdPlacementPreview view={view} price={price} onSelect={setSelectedPlacement} selectImmediately />
        <PreviewCaption>광고 영역 클릭 → 광고비 안내 → 금액 수정하기 순서로 변경할 수 있습니다.</PreviewCaption>
      </PreviewWrap>
      {selectedPlacement && typeof document !== 'undefined' && createPortal(
        <Backdrop role="presentation" onMouseDown={() => setSelectedPlacement(null)}>
          <Modal role="dialog" aria-modal="true" aria-labelledby="ad-price-summary-title" onMouseDown={(event) => event.stopPropagation()}>
            <ModalTitle id="ad-price-summary-title">광고비 안내</ModalTitle>
            <ModalText>{placementName[selectedPlacement]}의 현재 하루 광고비입니다.</ModalText>
            <div style={{ padding: '16px', borderRadius: 8, background: c.gray100 }}>
              <span style={{ display: 'block', color: c.gray500, ...textStyle.caption }}>하루 광고비</span>
              <strong style={{ display: 'block', marginTop: 4, color: c.gray900, fontSize: 24 }}>{price.toLocaleString()}원</strong>
            </div>
            <ModalActions><ModalButton type="button" onClick={() => setSelectedPlacement(null)}>취소</ModalButton><ModalButton type="button" primary onClick={startEditing}>금액 수정하기</ModalButton></ModalActions>
          </Modal>
        </Backdrop>, document.body,
      )}
      {editingPlacement && typeof document !== 'undefined' && createPortal(
        <Backdrop role="presentation" onMouseDown={closeEditor}>
          <Modal role="dialog" aria-modal="true" aria-labelledby="ad-price-modal-title" onMouseDown={(event) => event.stopPropagation()}>
            <ModalTitle id="ad-price-modal-title">광고비 수정</ModalTitle>
            <ModalText>{placementName[editingPlacement]}의 하루 광고비를 설정해 주세요.</ModalText>
            <FieldLabel htmlFor={inputId}>하루 광고비<PriceField><PriceInput id={inputId} inputMode="numeric" autoFocus value={draft ? Number(digitsOnly(draft)).toLocaleString() : ''} onChange={(event) => setDraft(digitsOnly(event.target.value))} aria-label="하루 광고비" /><Won>원</Won></PriceField></FieldLabel>
            <ModalActions><ModalButton type="button" onClick={closeEditor}>취소</ModalButton><ModalButton type="button" primary onClick={savePrice}>저장</ModalButton></ModalActions>
          </Modal>
        </Backdrop>, document.body,
      )}
    </>
  );
}

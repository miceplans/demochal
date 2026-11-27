'use client';

import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { BizContent, OutlineButton } from '@/components/biz/BizShell';
import { AdPlacementPreview } from '@/components/ads/AdPlacementPreview';
import { BizAdsNameModal } from './BizAdsNameModal';
import { BizAdsPaymentModal } from './BizAdsPaymentModal';
import { HeaderRow } from './BizAdsPage.styles';
import type { BizAdsController } from './useBizAdsController';

// 광고 상품 선택 화면: 노출 미리보기와 이미지 업로드를 담당하고 결제·광고명 모달을 조합한다.
export function BizAdsProductsScreen({ controller }: { controller: BizAdsController }) {
  const {
    setScreen,
    view,
    setView,
    dailyPrices,
    handleSelectPlacement,
    uploadPlacement,
    uploadedImages,
    handleImagePicked,
    processing,
  } = controller;
  return (
    <BizContent style={{ maxWidth: 1220, gap: 32, alignItems: 'center' }}>
      <HeaderRow style={{ width: '100%' }}>
        <OutlineButton type="button" onClick={() => setScreen('manage')}>
          광고 관리로 돌아가기
        </OutlineButton>
        <ViewToggle role="tablist" aria-label="광고 노출 화면">
          <ViewTab
            type="button"
            role="tab"
            active={view === 'mobile'}
            aria-selected={view === 'mobile'}
            onClick={() => setView('mobile')}
          >
            모바일 뷰
          </ViewTab>
          <ViewTab
            type="button"
            role="tab"
            active={view === 'pc'}
            aria-selected={view === 'pc'}
            onClick={() => setView('pc')}
          >
            PC 뷰
          </ViewTab>
        </ViewToggle>
      </HeaderRow>
      <AdPlacementPreview
        view={view}
        dailyPrices={dailyPrices}
        onSelect={handleSelectPlacement}
        uploadPlacement={uploadPlacement}
        uploadedImages={uploadedImages}
        onImagePicked={handleImagePicked}
        processing={processing}
      />
      <BizAdsPaymentModal controller={controller} />
      <BizAdsNameModal controller={controller} />
    </BizContent>
  );
}

const ViewToggle = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 20px',
  borderRadius: 6,
  background: c.white,
});
const ViewTab = styled('button', { shouldForwardProp: (prop) => prop !== 'active' })<{
  active: boolean;
}>(({ active }) => ({
  width: 80,
  border: 0,
  borderRadius: 6,
  padding: 10,
  background: active ? c.primary : 'transparent',
  color: active ? c.white : c.gray900,
  ...textStyle.subtitle,
}));

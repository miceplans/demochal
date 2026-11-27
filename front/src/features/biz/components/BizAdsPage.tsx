'use client';

import { BizAdsCompleteScreen } from './BizAdsCompleteScreen';
import { BizAdsManageScreen } from './BizAdsManageScreen';
import { BizAdsProductsScreen } from './BizAdsProductsScreen';
import { useBizAdsController } from './useBizAdsController';

// 광고 관리 화면의 조합 루트. 상태·액션은 useBizAdsController가, 각 화면 렌더링은
// 책임별 화면 컴포넌트(목록/완료/상품+결제)가 담당한다.
export function BizAdsPage() {
  const controller = useBizAdsController();
  if (controller.screen === 'manage') return <BizAdsManageScreen controller={controller} />;
  if (controller.screen === 'complete' && controller.selectedAd)
    return <BizAdsCompleteScreen controller={controller} />;
  return <BizAdsProductsScreen controller={controller} />;
}

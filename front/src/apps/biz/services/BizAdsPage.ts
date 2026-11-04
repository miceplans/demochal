import { generated } from '@semochal/api-client';
import { apiErrorMessage } from '@/api/api-error';
import type { AdPlacement } from '@/apps/user/components/ads/AdPlacementPreview';

type Ad = Awaited<ReturnType<typeof generated.listMyAds>>['data'][number];
type AdProduct = Awaited<ReturnType<typeof generated.listAdProducts>>['data'][number];

type AdsScreen = 'manage' | 'products' | 'complete';
type SelectedAd = {
  placement: AdPlacement;
  name: string;
  landingUrl?: string;
  price: number;
  period: string;
  product: AdProduct;
};

// 서버가 남긴 message가 있으면 그대로 보여주고, 없으면 네트워크 오류 구분 후 공통 안내 문구로 대체한다.
function extractErrorMessage(error: unknown): string {
  return apiErrorMessage(
    error,
    '광고 정보를 처리하지 못했습니다. 로그인 및 서버 연결을 확인해 주세요.',
  );
}

export type { Ad, AdProduct, AdsScreen, SelectedAd };
export { extractErrorMessage };
export { formatSlash } from '@/utils/date';

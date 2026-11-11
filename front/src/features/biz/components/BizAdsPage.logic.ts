import { generated } from '@semochal/api-client';
import { apiErrorMessage } from '@/lib/api-error';
import type { AdPlacement } from '@/components/ads/AdPlacementPreview';

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

function formatSlash(dateKey: string) {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}/${Number(day)}`;
}

const DAY_MS = 86_400_000;

function dateKeyTime(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const time = Date.UTC(year, month - 1, day);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === dateKey
    ? time
    : Number.NaN;
}

/** 광고 기간은 시작일과 종료일을 모두 포함한다. 잘못된 입력도 최소 1일로 표시한다. */
function adDays(startDate: string, endDate: string) {
  const start = dateKeyTime(startDate);
  const end = dateKeyTime(endDate);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 1;
  return Math.max(1, Math.floor((end - start) / DAY_MS) + 1);
}

function adPaymentAmount(startDate: string, endDate: string, dailyPrice: number) {
  return adDays(startDate, endDate) * dailyPrice;
}

// 서버가 남긴 message가 있으면 그대로 보여주고, 없으면 네트워크 오류 구분 후 공통 안내 문구로 대체한다.
function extractErrorMessage(error: unknown): string {
  return apiErrorMessage(
    error,
    '광고 정보를 처리하지 못했습니다. 로그인 및 서버 연결을 확인해 주세요.',
  );
}

export type { Ad, AdProduct, AdsScreen, SelectedAd };
export { adDays, adPaymentAmount, extractErrorMessage, formatSlash };

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

type ReservedPeriod = { startDate: string; endDate: string };

// 기존 계약이 잡고 있는 기간을 건드리지 않는 가장 이른 시작일을 찾는다.
function firstAvailableAdStart(
  reservedPeriods: readonly ReservedPeriod[] | undefined,
  fromDateKey: string,
) {
  let start = fromDateKey;
  for (const period of [...(reservedPeriods ?? [])].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  )) {
    if (period.startDate.slice(0, 10) <= start && period.endDate.slice(0, 10) >= start) {
      start = new Date(new Date(period.endDate.slice(0, 10)).getTime() + DAY_MS)
        .toISOString()
        .slice(0, 10);
    }
  }
  return start;
}

function isAdEnded(ad: Ad, todayKey: string) {
  return ad.status === 'ended' || ad.endDate.slice(0, 10) < todayKey;
}

// 결제는 끝났지만 이미지·광고명을 아직 등록하지 않은 광고.
// placement를 알 수 없는 광고(hero·gallery 밖 상품, 상품 목록 로딩 중)는 등록 흐름을 시작할 수
// 없으므로 막다른 길이 되지 않게 '이미지 등록' 대상에서 제외한다.
function adNeedsContent(ad: Ad, placement: AdPlacement | null, todayKey: string) {
  return ad.status === 'active' && !ad.imageUrl && !isAdEnded(ad, todayKey) && placement !== null;
}

function adStatusLabel(ad: Ad, needsContent: boolean, todayKey: string) {
  if (ad.status === 'preparing') return '결제 대기';
  if (needsContent) return '이미지 등록 필요';
  if (isAdEnded(ad, todayKey)) return '종료';
  if (ad.status === 'paused') return '일시 정지';
  if (ad.startDate.slice(0, 10) > todayKey) return '시작 대기';
  return '진행중';
}

export type { Ad, AdProduct, AdsScreen, SelectedAd };
export {
  adDays,
  adNeedsContent,
  adPaymentAmount,
  adStatusLabel,
  extractErrorMessage,
  firstAvailableAdStart,
  formatSlash,
  isAdEnded,
};

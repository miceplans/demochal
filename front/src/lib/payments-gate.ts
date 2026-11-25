import { paymentProviderForHost } from './payments';

// 새 결제 시작을 막는 클라이언트 스위치. NEXT_PUBLIC_PAYMENTS_ENABLED가 'true'가 아니면(기본)
// 결제창을 열기 전에 안내만 띄운다. 서버도 PAYMENTS_ENABLED=false면 승인 엔드포인트를 503으로 막는다.
export const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true';

// 임시: 토스 단건 결제만 여는 스위치. 서버 TOSS_PAYMENTS_ENABLED와 함께 켠다.
export const TOSS_PAYMENTS_ENABLED =
  PAYMENTS_ENABLED || process.env.NEXT_PUBLIC_TOSS_PAYMENTS_ENABLED === 'true';

/** biz 단건 결제(requestBizPayment) 가능 여부 — 토스로 가는 호스트에서만 토스 스위치를 따른다. */
export function isBizPaymentEnabled(): boolean {
  if (PAYMENTS_ENABLED) return true;
  return TOSS_PAYMENTS_ENABLED && paymentProviderForHost(window.location.hostname) === 'toss';
}

export const PAYMENTS_DISABLED_TITLE = '결제 기능을 일시 중단했어요';
export const PAYMENTS_DISABLED_DESCRIPTION = '잠시 후 다시 이용해 주세요';

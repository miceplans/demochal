import { ServiceUnavailableException } from '@nestjs/common';
import { env } from '../../config/env.js';

export const PAYMENTS_DISABLED_MESSAGE = '결제 기능을 일시 중단했어요. 잠시 후 다시 이용해 주세요.';

/** 새 결제를 시작하는 진입점에서 호출한다. PAYMENTS_ENABLED가 true가 아니면 503으로 막는다. */
export function assertPaymentsEnabled(): void {
  if (!env.paymentsEnabled) throw new ServiceUnavailableException(PAYMENTS_DISABLED_MESSAGE);
}

// 테스트 자격증명은 실제 청구 없이 승인되므로 운영에서 주문을 paid로 만들면 안 된다. 부팅을
// 막으면 이미 스위치가 켜진 환경의 배포(환불·웹훅 포함)까지 멈추므로 승인 진입점에서만 막는다.
// https://docs.tosspayments.com/reference/using-api/api-keys
function usesLiveTossKey(): boolean {
  return env.nodeEnv !== 'production' || env.tossSecretKey.startsWith('live_');
}

function usesLiveKcp(): boolean {
  return env.nodeEnv !== 'production' || env.kcpProduction;
}

/**
 * 토스 단건 결제 승인용. 전체 스위치가 꺼져 있어도 TOSS_PAYMENTS_ENABLED(임시)가 true면 연다.
 * 운영에서는 어느 스위치로 열었든 live 키가 아니면 막는다.
 */
export function assertTossPaymentsEnabled(): void {
  if (!env.tossPaymentsEnabled) assertPaymentsEnabled();
  if (!usesLiveTossKey()) throw new ServiceUnavailableException(PAYMENTS_DISABLED_MESSAGE);
}

/** KCP 승인·거래등록용. 운영에서는 KCP 운영 모드(KCP_PRODUCTION=true)가 아니면 막는다. */
export function isKcpPaymentsEnabled(): boolean {
  return env.paymentsEnabled && usesLiveKcp();
}

export function assertKcpPaymentsEnabled(): void {
  if (!isKcpPaymentsEnabled()) throw new ServiceUnavailableException(PAYMENTS_DISABLED_MESSAGE);
}

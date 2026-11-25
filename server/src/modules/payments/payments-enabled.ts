import { ServiceUnavailableException } from '@nestjs/common';
import { env } from '../../config/env.js';

export const PAYMENTS_DISABLED_MESSAGE = '결제 기능을 일시 중단했어요. 잠시 후 다시 이용해 주세요.';

/** 새 결제를 시작하는 진입점에서 호출한다. PAYMENTS_ENABLED가 true가 아니면 503으로 막는다. */
export function assertPaymentsEnabled(): void {
  if (!env.paymentsEnabled) throw new ServiceUnavailableException(PAYMENTS_DISABLED_MESSAGE);
}

/** 토스 단건 결제 승인용. 전체 스위치가 꺼져 있어도 TOSS_PAYMENTS_ENABLED(임시)가 true면 연다. */
export function assertTossPaymentsEnabled(): void {
  if (!env.tossPaymentsEnabled) assertPaymentsEnabled();
}

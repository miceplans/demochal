import {
  ANONYMOUS,
  loadTossPayments,
  type TossPaymentsPayment,
} from '@tosspayments/tosspayments-sdk';

let paymentPromise: Promise<TossPaymentsPayment> | null = null;

// 클라이언트 키 미설정 환경(개발자 안내용)에서는 null을 반환한다 — 크래시 없이 결제 진입을 막는다.
// 비회원 단건 결제이므로 ANONYMOUS customerKey로 초기화한다(자동결제 빌링과 무관).
export function getTossPayment(): Promise<TossPaymentsPayment> | null {
  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
  if (!clientKey) return null;
  paymentPromise ??= loadTossPayments(clientKey).then((sdk) =>
    sdk.payment({ customerKey: ANONYMOUS }),
  );
  return paymentPromise;
}

export interface TossPaymentParams {
  orderId: string;
  amount: number;
  orderName: string;
}

/**
 * 토스 결제창을 연다. 성공 시 토스가 successUrl로, 실패/취소 시 failUrl로 리다이렉트하므로
 * 이 함수가 resolve돼도 페이지가 남아있는 일은 없다.
 * @returns 키 미설정으로 결제창을 열지 못한 경우 false
 */
export async function requestTossPayment({
  orderId,
  amount,
  orderName,
}: TossPaymentParams): Promise<boolean> {
  const payment = getTossPayment();
  if (!payment) return false;
  const tossPayment = await payment;
  await tossPayment.requestPayment({
    method: 'CARD',
    amount: { value: amount, currency: 'KRW' },
    orderId,
    orderName,
    successUrl: `${window.location.origin}/payments/success`,
    failUrl: `${window.location.origin}/payments/fail`,
  });
  return true;
}

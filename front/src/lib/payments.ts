import {
  ANONYMOUS,
  loadTossPayments,
  type TossPaymentsPayment,
} from '@tosspayments/tosspayments-sdk';

let paymentPromise: Promise<TossPaymentsPayment> | null = null;

// Toss 결제창은 cardCompany 허용 목록으로 카드사를 제한한다. BC(31), 기업BC(3K),
// 우리BC(33)는 BC 매입 계열이므로 목록에서 제외한다.
export const CARD_COMPANIES_WITHOUT_BC = [
  '46',
  '71',
  '30',
  '51',
  '38',
  '41',
  '62',
  '36',
  '37',
  '39',
  '35',
  '42',
  '15',
  '3A',
  '24',
  '21',
  '61',
  '11',
  '91',
  '34',
  '6D',
  '4M',
  '3C',
  '7A',
  '4J',
  '4V',
].join('|');

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
  flow?: 'ad';
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
  flow,
}: TossPaymentParams): Promise<boolean> {
  const payment = getTossPayment();
  if (!payment) return false;
  const tossPayment = await payment;
  await tossPayment.requestPayment({
    method: 'CARD',
    card: { cardCompany: CARD_COMPANIES_WITHOUT_BC },
    amount: { value: amount, currency: 'KRW' },
    orderId,
    orderName,
    windowTarget: 'self',
    successUrl: `${window.location.origin}/payments/success${flow ? `?flow=${flow}` : ''}`,
    failUrl: `${window.location.origin}/payments/fail${flow ? `?flow=${flow}` : ''}`,
  });
  return true;
}

/**
 * 토스 빌링(자동결제) 카드 등록창을 연다. 성공 시 successUrl로 authKey가 붙어 리다이렉트되고,
 * 이후 POST /billing/authorizations/issue에서 서버가 billingKey로 교환·저장한다.
 * customerKey는 비즈니스마다 달라 인스턴스 캐시 없이 매번 초기화한다.
 * @returns 키 미설정으로 창을 열지 못한 경우 false
 */
export async function requestTossBillingAuth(customerKey: string): Promise<boolean> {
  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
  if (!clientKey) return false;
  const sdk = await loadTossPayments(clientKey);
  const payment = sdk.payment({ customerKey });
  await payment.requestBillingAuth({
    method: 'CARD',
    successUrl: `${window.location.origin}/biz/billing/auth/success`,
    failUrl: `${window.location.origin}/biz/billing/auth/fail`,
  });
  return true;
}

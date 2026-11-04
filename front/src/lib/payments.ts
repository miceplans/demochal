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

/**
 * 구매자가 고르는 결제 수단. CARD는 카드 결제창, 나머지 간편결제는 해당 앱 자체창을 바로 연다.
 * VIRTUAL_ACCOUNT는 계좌만 발급하므로 입금 확인까지 주문이 pending으로 남는다.
 */
export type PaymentMethod = 'CARD' | 'TOSSPAY' | 'KAKAOPAY' | 'NAVERPAY' | 'VIRTUAL_ACCOUNT';

export const paymentMethodOptions: ReadonlyArray<{ value: PaymentMethod; label: string }> = [
  { value: 'CARD', label: '카드' },
  { value: 'TOSSPAY', label: '토스페이' },
  { value: 'KAKAOPAY', label: '카카오페이' },
  { value: 'NAVERPAY', label: '네이버페이' },
  { value: 'VIRTUAL_ACCOUNT', label: '가상계좌' },
];

// 가상계좌 입금 기한. 기한이 지나면 토스가 EXPIRED 웹훅을 보내 서버가 주문을 취소한다.
const VIRTUAL_ACCOUNT_VALID_HOURS = 24;

export interface TossPaymentParams {
  orderId: string;
  amount: number;
  orderName: string;
  flow?: 'ad';
  method?: PaymentMethod;
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
  method = 'CARD',
}: TossPaymentParams): Promise<boolean> {
  const payment = getTossPayment();
  if (!payment) return false;
  const tossPayment = await payment;
  const common = {
    amount: { value: amount, currency: 'KRW' as const },
    orderId,
    orderName,
    successUrl: `${window.location.origin}/payments/success${flow ? `?flow=${flow}` : ''}`,
    failUrl: `${window.location.origin}/payments/fail${flow ? `?flow=${flow}` : ''}`,
  };
  if (method === 'VIRTUAL_ACCOUNT') {
    await tossPayment.requestPayment({
      ...common,
      method: 'VIRTUAL_ACCOUNT',
      virtualAccount: {
        cashReceipt: { type: '미발행' },
        validHours: VIRTUAL_ACCOUNT_VALID_HOURS,
      },
    });
  } else if (method === 'CARD') {
    await tossPayment.requestPayment({ ...common, method: 'CARD' });
  } else {
    // 간편결제: DIRECT로 해당 간편결제 앱 자체창을 바로 연다.
    // https://docs.tosspayments.com/codes/org-codes#간편결제사-코드
    await tossPayment.requestPayment({
      ...common,
      method: 'CARD',
      card: { flowMode: 'DIRECT', easyPay: method },
    });
  }
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

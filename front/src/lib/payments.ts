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

// ─── 결제 대행사 분기 ──────────────────────────────────────────────────────────
// bz 서브도메인(기본 레이블 'bz') 호스트는 네이버페이, 그 외는 기존 토스다.
// 프록시(front/src/proxy.ts)의 BZ_SUBDOMAIN과 같은 값을 쓰도록 NEXT_PUBLIC_BZ_SUBDOMAIN으로 맞춘다.
export type PaymentProvider = 'toss' | 'naverpay';

const BZ_SUBDOMAIN = process.env.NEXT_PUBLIC_BZ_SUBDOMAIN ?? 'bz';

// 호스트(또는 hostname)의 첫 레이블로 결제 대행사를 고른다.
export function paymentProviderForHost(host: string): PaymentProvider {
  const firstLabel = host.split(':')[0]?.split('.')[0]?.toLowerCase();
  return firstLabel === BZ_SUBDOMAIN.toLowerCase() ? 'naverpay' : 'toss';
}

/**
 * biz 영역 단건 결제 진입 — 호스트에 따라 네이버페이/토스를 고른다.
 * bz 호스트에서는 네이버페이 결제창, 그 외에는 기존 토스 결제창을 연다.
 * @returns 클라이언트 키 미설정/SDK 로드 실패로 결제창을 열지 못한 경우 false
 */
export async function requestBizPayment(params: TossPaymentParams): Promise<boolean> {
  if (paymentProviderForHost(window.location.hostname) === 'naverpay') {
    return requestNaverPayPayment(params);
  }
  return requestTossPayment(params);
}

// ─── 네이버페이(bz 서브도메인) ────────────────────────────────────────────────
// 네이버페이 결제창 JS SDK는 npm 패키지가 없어 공식 CDN 스크립트를 주입해 쓴다.
// 요청/응답 파라미터는 네이버페이 가맹점 연동 가이드(developer.pay.naver.com, 가맹점 로그인
// 필요) 기준이며, 가맹점 자격증명 발급 후 실제 스펙과 대조해 조정한다.
const NAVERPAY_SDK_URL = 'https://nsp.pay.naver.com/sdk/js/naverpay.min.js';
// PC 팝업 결과를 받을 전역 콜백 이름 — requestNaverPayPayment가 등록한다.
const NAVERPAY_CALLBACK_NAME = 'semochalNaverPayCallback';

interface NaverPayProductItem {
  categoryType: string; // 상품 유형 — 가이드 기준 'PRODUCT'
  categoryId: string; // 상품 카테고리 — 가이드 기준 'GENERAL'
  uid: string;
  name: string;
  count: number;
  price: number;
}

interface NaverPayResult {
  resultCode?: string;
  paymentId?: string;
  resultMessage?: string;
}

interface NaverPayInstance {
  requestPayment(params: Record<string, unknown>): void;
}

interface NaverPaySdk {
  create(options: { mode: string; clientId: string }): NaverPayInstance;
}

declare global {
  interface Window {
    Naver?: { Pay?: NaverPaySdk };
    semochalNaverPayCallback?: (result: NaverPayResult) => void;
  }
}

let naverPaySdkPromise: Promise<NaverPaySdk | null> | null = null;

// CDN 스크립트를 한 번만 주입하고 로드 결과(Naver.Pay)를 공유한다. 로드 실패·비브라우저 환경은 null.
function loadNaverPaySdk(): Promise<NaverPaySdk | null> {
  naverPaySdkPromise ??= new Promise((resolve) => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      resolve(null);
      return;
    }
    if (window.Naver?.Pay) {
      resolve(window.Naver.Pay);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${NAVERPAY_SDK_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Naver?.Pay ?? null), { once: true });
      existing.addEventListener('error', () => resolve(null), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = NAVERPAY_SDK_URL;
    script.async = true;
    script.onload = () => resolve(window.Naver?.Pay ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return naverPaySdkPromise;
}

export interface NaverPayPaymentParams {
  orderId: string;
  amount: number;
  orderName: string;
  flow?: 'ad';
}

// 네이버페이 결제창 호출 파라미터 — 순수 함수로 분리해 검증한다.
// orderId는 우리가 returnUrl 쿼리에 직접 싣는다(returnUrl은 가맹점 URL이라 결과 파라미터와 무관하게 보존).
export function buildNaverPayPaymentParams({
  orderId,
  amount,
  orderName,
  flow,
  origin,
}: NaverPayPaymentParams & { origin: string }): Record<string, unknown> {
  const successParams = new URLSearchParams({ orderId });
  if (flow) successParams.set('flow', flow);
  return {
    productItems: [
      {
        categoryType: 'PRODUCT',
        categoryId: 'GENERAL',
        uid: orderId,
        name: orderName,
        count: 1,
        price: amount,
      } satisfies NaverPayProductItem,
    ],
    productName: orderName,
    productCount: 1,
    totalPayAmount: amount,
    taxScopeAmount: amount,
    taxExScopeAmount: 0,
    // 가맹점 결제 키 = 우리 주문 ID. 서버 confirm이 결제내역의 가맹점 키와 주문을 대조한다.
    merchantPayKey: orderId,
    extraData: JSON.stringify({ orderId }),
    returnUrl: `${origin}/payments/success?${successParams.toString()}`,
    isPopup: true,
    callbackFunction: NAVERPAY_CALLBACK_NAME,
  };
}

// PC 팝업 콜백 결과(resultCode·paymentId)를 모바일 returnUrl과 동일한 success URL로 모은다.
// 순수 함수로 분리해 콜백 동선을 검증한다.
export function buildNaverPayCallbackUrl({
  orderId,
  flow,
  result,
  origin,
}: {
  orderId: string;
  flow?: 'ad';
  result?: NaverPayResult;
  origin: string;
}): string {
  const callbackParams = new URLSearchParams({ orderId });
  callbackParams.set('resultCode', result?.resultCode ?? 'Fail');
  if (result?.paymentId) callbackParams.set('paymentId', result.paymentId);
  if (flow) callbackParams.set('flow', flow);
  return `${origin}/payments/success?${callbackParams.toString()}`;
}

/**
 * 네이버페이 결제창을 연다(bz 서브도메인). 모바일은 returnUrl로, PC 팝업은 callbackFunction으로
 * 결과가 돌아오고 양쪽 모두 최종적으로 /payments/success?resultCode&paymentId&orderId로 수렴한다.
 * 성공 시 서버 승인(POST /payments/confirm, provider=naverpay)은 PaymentSuccessPage가 호출한다.
 * @returns 클라이언트 키 미설정/SDK 로드 실패로 결제창을 열지 못한 경우 false
 */
export async function requestNaverPayPayment({
  orderId,
  amount,
  orderName,
  flow,
}: NaverPayPaymentParams): Promise<boolean> {
  const clientId = process.env.NEXT_PUBLIC_NAVERPAY_CLIENT_ID;
  if (!clientId) return false;
  const sdk = await loadNaverPaySdk();
  if (!sdk) return false;

  const origin = window.location.origin;
  // PC 팝업 결과(resultCode·paymentId)를 모바일 returnUrl과 동일한 success URL로 본다.
  window.semochalNaverPayCallback = (result) => {
    window.location.assign(buildNaverPayCallbackUrl({ orderId, flow, result, origin }));
  };
  const mode = process.env.NEXT_PUBLIC_NAVERPAY_MODE ?? 'development';
  sdk
    .create({ mode, clientId })
    .requestPayment(buildNaverPayPaymentParams({ orderId, amount, orderName, flow, origin }));
  return true;
}

import { generated } from '@semochal/api-client';
import { apiErrorMessage } from '@/lib/api-error';

/**
 * NHN KCP 표준결제창 네이버페이(bz 서브도메인) 연동 — https://developer.kcp.co.kr/guide/config
 *  - PC: kcp_spay_hub.js + KCP_Pay_Execute_Web로 네이버페이 단독 결제창(naverpay_direct=B)을 연다.
 *    인증 결과는 m_Completepayment 콜백으로 돌아와 서버 승인(POST /payments/kcp/confirm)으로 이어진다.
 *  - 모바일: 서버 거래등록(POST /payments/kcp/register)으로 받은 approvalKey·PayUrl로
 *    PayUrl을 통해 전체 페이지 결제창을 열고, 인증 결과는 KCP가 서버 Ret_URL(POST /payments/kcp/return)로
 *    별도 전달해 서버가 승인·정산한 뒤 성공/실패 페이지로 리다이렉트한다.
 */
const KCP_HUB_URL_TEST = 'https://testspay.kcp.co.kr/plugin/kcp_spay_hub.js';
const KCP_HUB_URL_PRODUCTION = 'https://spay.kcp.co.kr/plugin/kcp_spay_hub.js';
// KCP 샘플과 동일한 모바일 UA 판별 — 모바일에서는 거래등록 + 전체 페이지 이동이 필요하다.
const KCP_MOBILE_UA =
  /(iPhone|iPod|iPad|Android|Windows CE|BlackBerry|Symbian|Windows Phone|webOS|Opera Mini|Opera Mobi|POLARIS|IEMobile|lgtelecom|nokia|SonyEricsson)/i;
// 모바일 결제창 호출 전 KCP 고정 경로(encoding_trans=UTF-8 사용 시 submit 대상).
const KCP_ENCODING_FILTER_PATH = '/jsp/encodingFilter/encodingFilter.jsp';
// 사용자 취소 res_cd — 결제 실패와 동일하게 실패 페이지로 본다.
const KCP_USER_CANCEL_CODE = '3001';

export interface KcpPaymentParams {
  orderId: string;
  amount: number;
  orderName: string;
  flow?: 'ad' | 'design';
}

interface KcpAuthResult {
  resCd: string;
  resMsg: string;
  encInfo: string;
  encData: string;
  tranCd: string;
}

declare global {
  interface Window {
    KCP_Pay_Execute_Web?: (form: HTMLFormElement) => void;
    m_Completepayment?: (formOrJson: unknown, closeEvent?: () => void) => void;
  }
}

let kcpHubPromise: Promise<boolean> | null = null;

// 허브 스크립트를 한 번만 주입한다. 로드 실패·비브라우저 환경은 false.
function loadKcpHub(scriptUrl: string): Promise<boolean> {
  kcpHubPromise ??= new Promise((resolve) => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      resolve(false);
      return;
    }
    if (typeof window.KCP_Pay_Execute_Web === 'function') {
      resolve(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${scriptUrl}"]`);
    if (existing) {
      existing.addEventListener(
        'load',
        () => resolve(typeof window.KCP_Pay_Execute_Web === 'function'),
        {
          once: true,
        },
      );
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.onload = () => resolve(typeof window.KCP_Pay_Execute_Web === 'function');
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return kcpHubPromise;
}

// KCP 결제창에 넘길 hidden 폼을 만든다. 필드명은 가이드(order_info) 기준이며
// 결제창이 res_cd·res_msg·enc_info·enc_data·tran_cd를 채워 돌려준다.
function buildKcpOrderForm(fields: Record<string, string>): HTMLFormElement {
  const form = document.createElement('form');
  form.name = 'order_info';
  form.method = 'post';
  form.style.display = 'none';
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  return form;
}

// m_Completepayment 콜백 결과를 폼/JSON 두 형태에서 읽는다(KCP 가이드의 GetField와 같은 역할).
function readKcpAuthResult(formOrJson: unknown): KcpAuthResult {
  const form = formOrJson as HTMLFormElement | null;
  const read = (name: string): string => {
    if (form?.elements) {
      const field = form.elements.namedItem(name);
      return field && 'value' in field ? String((field as unknown as HTMLInputElement).value) : '';
    }
    const value = (formOrJson as Record<string, unknown> | null)?.[name];
    return value == null ? '' : String(value);
  };
  return {
    resCd: read('res_cd'),
    resMsg: read('res_msg'),
    encInfo: read('enc_info'),
    encData: read('enc_data'),
    tranCd: read('tran_cd'),
  };
}

function kcpSiteCd(): string {
  return process.env.NEXT_PUBLIC_KCP_SITE_CD ?? '';
}

function kcpSiteName(): string {
  return process.env.NEXT_PUBLIC_KCP_SITE_NAME ?? 'Semochal';
}

function kcpHubUrl(): string {
  // NEXT_PUBLIC_KCP_JS_URL이 최우선. 미설정 시 빌드 환경으로 기본값을 고른다 —
  // 로컬/미리보기는 테스트 창(testspay), 프로덕션 빌드는 운영 창(spay)을 연다.
  return (
    process.env.NEXT_PUBLIC_KCP_JS_URL ??
    (process.env.NODE_ENV === 'production' ? KCP_HUB_URL_PRODUCTION : KCP_HUB_URL_TEST)
  );
}

export function isKcpMobileDevice(userAgent: string): boolean {
  return KCP_MOBILE_UA.test(userAgent);
}

function buildFailUrl({
  origin,
  orderId,
  flow,
  code,
  message,
}: {
  origin: string;
  orderId: string;
  flow?: 'ad' | 'design';
  code: string;
  message?: string;
}): string {
  const params = new URLSearchParams({ orderId, code });
  if (flow) params.set('flow', flow);
  if (message) params.set('message', message.slice(0, 200));
  return `${origin}/payments/fail?${params.toString()}`;
}

function buildSuccessUrl({
  origin,
  orderId,
  flow,
}: {
  origin: string;
  orderId: string;
  flow?: 'ad' | 'design';
}): string {
  const params = new URLSearchParams({ orderId, provider: 'kcp' });
  if (flow) params.set('flow', flow);
  return `${origin}/payments/success?${params.toString()}`;
}

// PC 결제창: KCP 허브 JS로 네이버페이 단독창을 열고, 콜백에서 서버 승인 → 성공/실패 페이지 이동.
async function openKcpPcWindow(params: KcpPaymentParams & { origin: string }): Promise<boolean> {
  const loaded = await loadKcpHub(kcpHubUrl());
  if (!loaded || typeof window.KCP_Pay_Execute_Web !== 'function') return false;

  // 결제창 JS보다 먼저 등록해야 한다 — 이름 변경 금지(KCP 호출 규약).
  window.m_Completepayment = (formOrJson, closeEvent) => {
    const result = readKcpAuthResult(formOrJson);
    closeEvent?.();
    if (result.resCd !== '0000') {
      const message =
        result.resCd === KCP_USER_CANCEL_CODE
          ? '결제를 취소했어요'
          : (result.resMsg ?? '결제 인증이 완료되지 않았어요');
      window.location.assign(
        buildFailUrl({
          origin: params.origin,
          orderId: params.orderId,
          flow: params.flow,
          code: result.resCd || 'res_error',
          message,
        }),
      );
      return;
    }
    void (async () => {
      try {
        await generated.confirmKcpPayment({
          orderId: params.orderId,
          encData: result.encData,
          encInfo: result.encInfo,
          tranCd: result.tranCd || undefined,
        });
        window.location.assign(buildSuccessUrl(params));
      } catch (error) {
        window.location.assign(
          buildFailUrl({
            origin: params.origin,
            orderId: params.orderId,
            flow: params.flow,
            code: 'confirm_failed',
            message: apiErrorMessage(error, '결제 승인이 완료되지 않았어요'),
          }),
        );
      }
    })();
  };

  const form = buildKcpOrderForm({
    site_cd: kcpSiteCd(),
    site_name: kcpSiteName(),
    currency: '410',
    // 제휴간편결제 단독 호출 — PC는 카드 코드로 열고 naverpay_direct로 네이버페이만 노출한다.
    pay_method: '100000000000',
    naverpay_direct: 'B',
    ordr_idxx: params.orderId,
    good_name: params.orderName,
    good_mny: String(params.amount),
    quotaopt: '12',
    // 결제창이 인증 결과를 채워 돌려주는 빈 필드.
    res_cd: '',
    res_msg: '',
    enc_info: '',
    enc_data: '',
    tran_cd: '',
  });
  try {
    // 정상 종료 시에도 스크립트 종료 예외가 throw되므로 가이드대로 빈 catch로 감싼다.
    window.KCP_Pay_Execute_Web(form);
  } catch {
    /* KCP 결제창 정상 종료 시 throw되는 스크립트 종료 예외 — 무시한다. */
  }
  return true;
}

// 모바일 결제창: 서버 거래등록 → PayUrl로 전체 페이지 이동. 인증 결과는 서버 Ret_URL이 받는다.
async function submitKcpMobileWindow(
  params: KcpPaymentParams & { origin: string },
): Promise<boolean> {
  const response = await generated.registerKcpTransaction({
    orderId: params.orderId,
    orderName: params.orderName,
    flow: params.flow,
  });
  // 공유 HttpClient가 비-2xx를 throw로 본내지만, 생성 타입의 유니온은 status 판별로 좁힌다.
  if (response.status !== 200) throw new Error('Unexpected KCP trade register response');
  const { approvalKey, payUrl, retUrl } = response.data;
  // encoding_trans=UTF-8이면 submit 대상은 PayUrl 마지막 '/' 앞 + KCP 고정 경로(가이드 규약).
  const filterBase = payUrl.substring(0, payUrl.lastIndexOf('/'));
  const form = buildKcpOrderForm({
    PayUrl: payUrl,
    site_cd: kcpSiteCd(),
    ordr_idxx: params.orderId,
    good_mny: String(params.amount),
    good_name: params.orderName,
    currency: '410',
    pay_method: 'CARD',
    approval_key: approvalKey,
    // 거래등록 시 본 값과 동일해야 한다 — 서버가 내린 retUrl을 그대로 싣는다.
    Ret_URL: retUrl,
    naverpay_direct: 'B',
    encoding_trans: 'UTF-8',
    shop_name: kcpSiteName(),
    quotaopt: '12',
  });
  form.action = `${filterBase}${KCP_ENCODING_FILTER_PATH}`;
  form.submit();
  return true;
}

/**
 * bz(bz 서브도메인) 네이버페이 결제창을 연다. PC/모바일을 UA로 나누고 양쪽 모두 결과는
 * /payments/success(provider=kcp)·/payments/fail로 수렴한다.
 * @returns 사이트코드 미설정/허브 JS 로드 실패로 결제창을 열지 못한 경우 false
 */
export async function requestKcpNaverPayPayment(params: KcpPaymentParams): Promise<boolean> {
  if (!kcpSiteCd()) return false;
  const withOrigin = { ...params, origin: window.location.origin };
  if (isKcpMobileDevice(window.navigator.userAgent)) {
    return submitKcpMobileWindow(withOrigin);
  }
  return openKcpPcWindow(withOrigin);
}

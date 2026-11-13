import { BadGatewayException, Logger } from '@nestjs/common';
import { fetchJson } from '../../common/http/fetch-json.js';
import { env } from '../../config/env.js';

/**
 * 네이버페이(결제형) 가맹점 API 클라이언트 — bz 서브도메인 결제의 서버 대사용.
 * 결제창(프론트 JS SDK)과는 별개로, 서버는 가맹점 확인/취소 API로만 결제를 검증·취소한다.
 *
 * 요청/응답 필드는 네이버페이 가맹점 연동 가이드(developer.pay.naver.com, 가맹점 로그인
 * 필요)를 따른다. 가이드가 로그인 벽 뒤에 있어 자격증명 발급 후 실제 응답과 대조해
 * 조정할 수 있도록 엔드포인트·상태값·파싱은 이 파일에만 모아둔다.
 */
const logger = new Logger('NaverPayClient');

// 가맹점 확인/취소 API 공통 엔드포인트 (v2.2 기준).
const NAVERPAY_API_BASE = 'https://apis.naver.com/npay/nnpay/payment/v2.2';
// 결제내역조회에서 승인 완료를 나타내는 상태값 — 가맹점 연동 가이드 기준.
export const NAVERPAY_PAYMENT_COMPLETED = 'COMPLETED';

export interface NaverPayPaymentDetail {
  paymentId: string;
  paymentStatus?: string;
  totalPayAmount?: number;
  admissionStateCode?: string;
  admissionYmdt?: string;
  orderNo?: string;
  productName?: string;
}

interface NaverPayApiResponse {
  code?: string;
  message?: string | null;
  body?: {
    detail?: Partial<NaverPayPaymentDetail> & { paymentId?: string };
  };
}

function assertNaverPayConfigured() {
  if (!env.naverpayClientId || !env.naverpayClientSecret || !env.naverpayChainId) {
    throw new BadGatewayException('결제 서비스가 구성되지 않았습니다. 잠시 후 다시 시도해 주세요.');
  }
}

function naverPayHeaders(extra?: Record<string, string>) {
  return {
    'Content-Type': 'application/json',
    'X-Naver-Client-Id': env.naverpayClientId,
    'X-Naver-Client-Secret': env.naverpayClientSecret,
    'X-NaverPay-Chain-Id': env.naverpayChainId,
    ...extra,
  };
}

// 네이버페이 응답 본문에서 공통 code(Success)와 detail을 꺼낸다.
// 자격증명·결제 데이터는 절대 로그에 남기지 않고 실패 원인은 상태 코드만 남긴다.
async function parseNaverPayResponse(response: {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}): Promise<Partial<NaverPayPaymentDetail> & { paymentId?: string }> {
  let payload: NaverPayApiResponse | null = null;
  try {
    payload = (await response.json()) as NaverPayApiResponse;
  } catch {
    // Error body is not JSON — treat as a plain rejection below.
  }
  if (!response.ok || payload?.code !== 'Success' || !payload.body?.detail) {
    logger.error(`Naver Pay API rejected the request: HTTP ${response.status}`);
    throw new BadGatewayException(
      '결제 서비스 응답이 올바르지 않습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
  return payload.body.detail;
}

/** 결제번호(paymentId)로 결제내역을 조회해 승인 상태·금액을 대사한다. */
export async function fetchNaverPayPaymentDetail(
  paymentId: string,
): Promise<NaverPayPaymentDetail> {
  assertNaverPayConfigured();
  const url = `${NAVERPAY_API_BASE}/getPaymentHistory?paymentId=${encodeURIComponent(paymentId)}`;
  let response;
  try {
    response = await fetchJson(url, {
      headers: naverPayHeaders(),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    logger.error(
      `Naver Pay payment history transport failed for payment ${paymentId}`,
      (error as Error | undefined)?.stack,
    );
    throw new BadGatewayException('결제 확인에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  }
  const detail = await parseNaverPayResponse(response);
  if (!detail.paymentId) {
    throw new BadGatewayException('결제 확인 응답이 올바르지 않습니다. 다시 시도해 주세요.');
  }
  return detail as NaverPayPaymentDetail;
}

/**
 * 네이버페이 결제 취소(환불). orderId 기준 멱등키를 씌워 응답 유실 후 재시도가
 * 이중 취소되지 않게 한다. 전액 취소는 cancelAmount = 결제 금액으로 호출한다.
 */
export async function cancelNaverPayPayment(input: {
  paymentId: string;
  orderId: string;
  cancelAmount: number;
  cancelReason: string;
}): Promise<void> {
  assertNaverPayConfigured();
  const url = `${NAVERPAY_API_BASE}/cancel`;
  let response;
  try {
    response = await fetchJson(url, {
      method: 'POST',
      headers: naverPayHeaders({ 'X-NaverPay-Idempotency-Key': `cancel:${input.orderId}` }),
      body: JSON.stringify({
        paymentId: input.paymentId,
        cancelAmount: input.cancelAmount,
        cancelReason: input.cancelReason,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    logger.error(
      `Naver Pay cancel transport failed for order ${input.orderId}`,
      (error as Error | undefined)?.stack,
    );
    throw new BadGatewayException('결제 취소에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  }
  await parseNaverPayResponse(response);
}

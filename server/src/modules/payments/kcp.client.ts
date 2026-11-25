import { createSign } from 'node:crypto';
import { BadGatewayException, Logger } from '@nestjs/common';
import { fetchJson } from '../../common/http/fetch-json.js';
import { env } from '../../config/env.js';

/**
 * NHN KCP 표준결제창 네이버페이 클라이언트 — bz 서브도메인 결제의 서버 대사용.
 * 결제창(프론트 kcp_spay_hub.js / 모바일 PayUrl)과는 별개로, 서버는 거래등록·승인·취소
 * API로만 결제를 등록·검증·취소한다.
 *
 * 엔드포인트·파라미터·서명 규칙은 KCP 개발자센터 가이드를 따른다.
 *  - 환경 설정:   https://developer.kcp.co.kr/guide/config
 *  - 표준결제:    https://developer.kcp.co.kr/guide/payment
 *  - 제휴간편결제: https://developer.kcp.co.kr/guide/directpay
 *  - REST 전환:   https://developer.kcp.co.kr/guide/rest-api-guide (승인/취소 URL, 서명데이터)
 * 자격증명(인증서·개인키)은 비워두면 502 안내로 막히고, 운영 전환은 KCP_PRODUCTION=true로 한다.
 */
const logger = new Logger('KcpClient');

// 모바일 결제창 호출 전 주문을 등록하는 거래등록 API (guide/config 환경 표).
const KCP_MOBILE_REGISTER_URL = env.kcpProduction
  ? 'https://smpay.kcp.co.kr/trade/register.do'
  : 'https://testsmpay.kcp.co.kr/trade/register.do';
// 결제창 인증 결과(enc_data·enc_info)로 최종 승인하는 SPL API.
const KCP_APPROVAL_URL = env.kcpProduction
  ? 'https://spl.kcp.co.kr/gw/enc/v1/payment'
  : 'https://stg-spl.kcp.co.kr/gw/enc/v1/payment';
// 승인된 거래를 취소하는 API — 서명데이터(kcp_sign_data)가 필요하다.
const KCP_CANCEL_URL = env.kcpProduction
  ? 'https://spl.kcp.co.kr/gw/mod/v1/cancel'
  : 'https://stg-spl.kcp.co.kr/gw/mod/v1/cancel';
// 거래조회 API — tno를 모르면 주문번호(mod_ordr_idxx)와 결제일자로 조회한다.
// https://developer.kcp.co.kr/reference/search
const KCP_INQUIRY_URL = env.kcpProduction
  ? 'https://spl.kcp.co.kr/std/inquery'
  : 'https://stg-spl.kcp.co.kr/std/inquery';

// 네이버페이 단독 호출 플래그 — 'B'는 카드·포인트 모두 허용(directpay 가이드 예시 값).
export const KCP_NAVERPAY_DIRECT = 'B';
// 모바일 거래등록/결제창 호출 시 결제수단 코드 (제휴간편결제 단독호출 기준).
export const KCP_PAY_METHOD_MOBILE = 'CARD';
// PC 결제창 호출 시 결제수단 코드 (신용카드 코드로 호출해 간편결제 단독창을 연다).
export const KCP_PAY_METHOD_PC = '100000000000';
// 승인 요청 시 결제정보 검증용 결제수단 코드 (간편결제 카드 → PACA).
const KCP_PAY_TYPE_EASYPAY_CARD = 'PACA';
// 네이버페이 포인트 전액 결제의 거래조회 결제수단 코드.
const KCP_PAY_TYPE_NAVERPAY_POINT = 'PANP';
// 카드 거래상태(stat_ca_cd) — https://developer.kcp.co.kr/code/status
// 여기 없는 상태(부분취소·취소 진행 등)는 자동으로 판단하지 않는다.
const KCP_CARD_APPROVED = new Set(['STSR', 'STMR', 'STMT']);
const KCP_CARD_CANCELED = new Set(['STSC', 'STJO', 'STMO']);
// 취소 서명 원문 조합 구분자 (rest-api-guide: site_cd + "^" + tno + "^" + mod_type).
const KCP_SIGN_DELIMITER = '^';
// 전체 취소 mod_type.
const KCP_CANCEL_FULL = 'STSC';

// 거래등록 응답 — Code(대문자 C) 기준이므로 별도 타입으로 파싱한다.
interface KcpRegisterResponse {
  Code?: string;
  Message?: string | null;
  approvalKey?: string;
  PayUrl?: string;
  traceNo?: string;
}

interface KcpApiResponse {
  res_cd?: string;
  res_msg?: string | null;
  tno?: string;
  amount?: string | number;
  pay_method?: string;
  [key: string]: unknown;
}

/**
 * KCP 승인은 성공(res_cd 0000 + tno)했지만 응답 금액이 주문 금액과 다른 경우 — 이미 청구된
 * 결제이므로 서비스가 tno로 취소 보상을 이어갈 수 있게 tno를 실어 던진다.
 */
export class KcpAmountMismatchError extends Error {
  constructor(
    readonly tno: string,
    readonly approvedAmount: number,
    readonly expectedAmount: number,
  ) {
    super(
      `KCP approved amount ${approvedAmount} does not match the order amount ${expectedAmount}`,
    );
    this.name = 'KcpAmountMismatchError';
  }
}

/**
 * KCP 승인은 성공(res_cd 0000 + tno)했지만 응답에 금액이 없어 청구액을 검증할 수 없는 경우.
 * 검증 불가한 채 청구만 남기면 안 되므로 서비스가 tno로 취소 보상을 이어간다.
 */
export class KcpAmountUnverifiableError extends Error {
  constructor(readonly tno: string) {
    super(`KCP approval response for tno ${tno} lacks the amount field`);
    this.name = 'KcpAmountUnverifiableError';
  }
}

/**
 * 승인 요청의 결과를 알 수 없는 경우(타임아웃·비정상 응답). KCP에서는 승인됐을 수 있으므로
 * 서비스가 거래조회로 확인한다. KCP가 명시적으로 거절한 응답(res_cd≠0000)에는 쓰지 않는다.
 */
export class KcpApprovalUnknownError extends BadGatewayException {
  constructor() {
    super('결제 승인에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  }
}

export type KcpInquiryResult =
  | { kind: 'approved'; tno: string; amount: number }
  | { kind: 'canceled'; tno: string }
  // 거래는 있으나 승인 유지 여부를 확정할 수 없다 — 자동 정산·취소하지 않는다.
  | { kind: 'unverifiable'; tno: string }
  // 승인된 거래를 확인하지 못했다. '거래 없음' 응답 코드가 공식 문서에 없어 구분하지 않는다.
  | { kind: 'not_confirmed'; resCd: string | undefined };

/** 거래조회·취소에는 서명용 개인키까지 필요하다. */
export function isKcpInquiryConfigured(): boolean {
  return Boolean(env.kcpSiteCd && env.kcpCertInfo && env.kcpPrivateKey);
}

function assertKcpConfigured() {
  if (!env.kcpSiteCd || !env.kcpCertInfo) {
    throw new BadGatewayException('결제 서비스가 구성되지 않았습니다. 잠시 후 다시 시도해 주세요.');
  }
}

// 취소 서명데이터: site_cd^tno^mod_type 원문을 개인키로 SHA256withRSA 서명 후 Base64.
// (rest-api-guide — 가맹점 부인 방지·무결성 검증)
function buildKcpSignData(target: string): string {
  if (!env.kcpPrivateKey) {
    throw new BadGatewayException(
      '결제 취소 서명이 구성되지 않았습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
  try {
    const signature = createSign('RSA-SHA256');
    signature.update(target, 'utf8');
    return signature.sign(
      { key: env.kcpPrivateKey, passphrase: env.kcpPrivateKeyPassword },
      'base64',
    );
  } catch (error) {
    // 서명 실패는 개인키 형식/비밀번호 문제 — 재시도로는 해결되지 않는다.
    logger.error('Failed to build KCP sign data', (error as Error | undefined)?.stack);
    throw new BadGatewayException('결제 취소 서명에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  }
}

/** 모바일 결제창 호출 전 주문을 KCP에 거래등록한다. 결제창 호출에 필요한 approvalKey·PayUrl을 돌려준다. */
export async function registerKcpTransaction(input: {
  orderId: string;
  goodName: string;
  amount: number;
  flow?: 'ad' | 'design';
}): Promise<{ approvalKey: string; payUrl: string; retUrl: string }> {
  assertKcpConfigured();
  const response = await fetchJson(KCP_MOBILE_REGISTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      site_cd: env.kcpSiteCd,
      ordr_idxx: input.orderId,
      good_name: input.goodName,
      good_mny: String(input.amount),
      pay_method: KCP_PAY_METHOD_MOBILE,
      currency: '410',
      naverpay_direct: KCP_NAVERPAY_DIRECT,
      Ret_URL: env.kcpMobileReturnUrl,
      // 인증 결과가 Ret_URL로 돌아올 때 함께 전달된다 — 화면 분기(flow) 복원용.
      param_opt_1: input.flow ?? '',
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch((error: unknown) => {
    logger.error(
      `KCP trade register transport failed for order ${input.orderId}`,
      (error as Error | undefined)?.stack,
    );
    throw new BadGatewayException('결제 준비에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  });

  let payload: KcpRegisterResponse | null = null;
  try {
    payload = (await response.json()) as KcpRegisterResponse;
  } catch {
    // Error body is not JSON — treat as a plain rejection below.
  }
  if (!response.ok || payload?.Code !== '0000' || !payload.approvalKey || !payload.PayUrl) {
    logger.error(`KCP trade register rejected for order ${input.orderId}: HTTP ${response.status}`);
    throw new BadGatewayException('결제 준비에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  }
  return {
    approvalKey: payload.approvalKey,
    payUrl: payload.PayUrl,
    retUrl: env.kcpMobileReturnUrl,
  };
}

/**
 * 결제창 인증 결과로 KCP에 최종 승인을 요청한다. 결제금액(ordr_mony)·주문번호(ordr_no)·
 * 결제수단(pay_type)을 함께 본문에 실어 KCP가 결제창 값과 대조하게 하고(8350 오류 방지),
 * 응답의 res_cd·거래번호·금액을 한 번 더 확인해 위변조를 막는다.
 */
export async function approveKcpPayment(input: {
  orderId: string;
  amount: number;
  encData: string;
  encInfo: string;
  tranCd?: string;
}): Promise<{ tno: string; amount: number }> {
  assertKcpConfigured();
  const response = await fetchJson(KCP_APPROVAL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept-Charset': 'UTF-8' },
    body: JSON.stringify({
      site_cd: env.kcpSiteCd,
      kcp_cert_info: env.kcpCertInfo,
      tran_cd: input.tranCd ?? '00100000',
      enc_data: input.encData,
      enc_info: input.encInfo,
      ordr_mony: String(input.amount),
      ordr_no: input.orderId,
      pay_type: KCP_PAY_TYPE_EASYPAY_CARD,
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch((error: unknown) => {
    logger.error(
      `KCP approval transport failed for order ${input.orderId}`,
      (error as Error | undefined)?.stack,
    );
    // 응답만 유실되고 KCP에서는 승인됐을 수 있다 — 서비스가 거래조회로 확인한다.
    throw new KcpApprovalUnknownError();
  });

  let payload: KcpApiResponse | null = null;
  try {
    payload = (await response.json()) as KcpApiResponse;
  } catch {
    // Error body is not JSON — treat as a plain rejection below.
  }
  // 승인 후에도 KCP 응답 금액이 서버 주문 금액과 같은지 한 번 더 확인한다(8350 계약).
  // res_cd=0000+tno까지 온 경우는 이미 청구된 결제 — 금액이 어긋나도 단순 거부만 하면
  // 구매자가 청구만 당한 결제가 남으므로, 서비스가 취소 보상을 이어갈 수 있게 tno를 싣는다.
  if (!response.ok || !payload?.res_cd || (payload.res_cd === '0000' && !payload.tno)) {
    logger.error(`KCP approval result unknown for order ${input.orderId}: HTTP ${response.status}`);
    throw new KcpApprovalUnknownError();
  }
  if (payload.res_cd !== '0000' || !payload.tno) {
    logger.error(`KCP approval rejected for order ${input.orderId}: HTTP ${response.status}`);
    throw new BadGatewayException('결제 승인에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  }
  // 승인 후에도 KCP 응답 금액이 서버 주문 금액과 같은지 한 번 더 확인한다(8350 계약).
  // 금액 필드 자체가 없으면 청구액을 검증할 수 없으므로 명시 거부한다 — 응답 누락을 서버가
  // 본 값으로 채워 대사를 조용히 건 넘기지 않는다(CLAUDE.md '미처리 상태 스킵 금지').
  if (payload.amount === undefined || !Number.isFinite(Number(payload.amount))) {
    logger.error(
      `KCP approval response for order ${input.orderId} (tno ${payload.tno}) is missing the amount field`,
    );
    throw new KcpAmountUnverifiableError(payload.tno);
  }
  const approvedAmount = Number(payload.amount);
  if (approvedAmount !== input.amount) {
    logger.error(
      `KCP approval amount mismatch for order ${input.orderId}: tno ${payload.tno} approved ${approvedAmount}, expected ${input.amount}`,
    );
    throw new KcpAmountMismatchError(payload.tno, approvedAmount, input.amount);
  }
  return { tno: payload.tno, amount: approvedAmount };
}

/** KCP 결제 전체 취소. orderId 기준 멱등키 개념은 KCP에 없으므로 환불 흐름의 상태 전이로 이중 취소를 막는다. */
export async function cancelKcpPayment(input: {
  tno: string;
  cancelReason: string;
}): Promise<void> {
  assertKcpConfigured();
  if (!env.kcpPrivateKey) {
    throw new BadGatewayException(
      '결제 취소 서명이 구성되지 않았습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
  const signTarget = [env.kcpSiteCd, input.tno, KCP_CANCEL_FULL].join(KCP_SIGN_DELIMITER);
  const response = await fetchJson(KCP_CANCEL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept-Charset': 'UTF-8' },
    body: JSON.stringify({
      site_cd: env.kcpSiteCd,
      kcp_cert_info: env.kcpCertInfo,
      kcp_sign_data: buildKcpSignData(signTarget),
      tno: input.tno,
      mod_type: KCP_CANCEL_FULL,
      mod_desc: input.cancelReason,
      // 서버 발신 취소라 클라이언트 IP가 없다 — KCP는 mod_ip를 참고 값으로만 쓴다.
      mod_ip: '127.0.0.1',
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch((error: unknown) => {
    logger.error(
      `KCP cancel transport failed for tno ${input.tno}`,
      (error as Error | undefined)?.stack,
    );
    throw new BadGatewayException('결제 취소에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  });

  let payload: KcpApiResponse | null = null;
  try {
    payload = (await response.json()) as KcpApiResponse;
  } catch {
    // Error body is not JSON — treat as a plain rejection below.
  }
  if (!response.ok || payload?.res_cd !== '0000') {
    logger.error(`KCP cancel rejected for tno ${input.tno}: HTTP ${response.status}`);
    throw new BadGatewayException('결제 취소에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  }
}

// 주문번호 조회의 tno 자리에는 'YYYYMMDD' + '000000'(KST 결제일자)을 넣는다.
function kcpInquiryDates(attemptedAt: Date): string[] {
  const kst = (time: number) =>
    new Date(time + 9 * 60 * 60 * 1000).toISOString().slice(0, 10).replaceAll('-', '');
  // 자정 직전 요청은 다음 날 승인될 수 있다.
  const start = attemptedAt.getTime();
  return [...new Set([kst(start), kst(start + 60_000)])];
}

function classifyInquiry(payType: string, payload: KcpApiResponse): KcpInquiryResult | null {
  const { tno } = payload;
  if (!tno) return null;
  const amount = Number(payload.amount);
  // 포인트 결제는 취소 여부를 알려 주는 공식 필드가 없어 자동 판단하지 않는다.
  if (payType !== KCP_PAY_TYPE_EASYPAY_CARD) return { kind: 'unverifiable', tno };
  const state = String(payload.stat_ca_cd ?? '');
  if (KCP_CARD_CANCELED.has(state)) return { kind: 'canceled', tno };
  if (
    KCP_CARD_APPROVED.has(state) &&
    payload.canc_card_yn !== 'Y' &&
    payload.amount !== undefined &&
    Number.isFinite(amount)
  ) {
    return { kind: 'approved', tno, amount };
  }
  return { kind: 'unverifiable', tno };
}

/**
 * 주문번호로 KCP 거래를 조회한다. 전송 실패·비정상 응답은 예외로 던져 '승인 없음'과 구분한다.
 * TODO: 한 주문번호에 거래가 여러 건일 때 어떤 건을 돌려주는지 공식 문서에 없다 — 운영 전환 전
 * KCP에 확인한다. https://developer.kcp.co.kr/reference/search
 */
export async function inquireKcpPaymentByOrder(input: {
  orderId: string;
  attemptedAt: Date;
}): Promise<KcpInquiryResult> {
  assertKcpConfigured();
  let resCd: string | undefined;
  for (const payType of [KCP_PAY_TYPE_EASYPAY_CARD, KCP_PAY_TYPE_NAVERPAY_POINT]) {
    for (const date of kcpInquiryDates(input.attemptedAt)) {
      const tno = `${date}000000`;
      const signTarget = [env.kcpSiteCd, tno, payType].join(KCP_SIGN_DELIMITER);
      let payload: KcpApiResponse | null = null;
      try {
        const response = await fetchJson(KCP_INQUIRY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            site_cd: env.kcpSiteCd,
            kcp_cert_info: env.kcpCertInfo,
            kcp_sign_data: buildKcpSignData(signTarget),
            tno,
            mod_ordr_idxx: input.orderId,
            pay_type: payType,
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (response.ok) payload = (await response.json()) as KcpApiResponse;
      } catch (error) {
        logger.error(
          `KCP inquiry failed for order ${input.orderId}`,
          (error as Error | undefined)?.stack,
        );
      }
      if (!payload?.res_cd) throw new BadGatewayException('결제 내역을 확인하지 못했습니다.');
      if (payload.res_cd === '0000') {
        const result = classifyInquiry(payType, payload);
        if (!result) throw new BadGatewayException('결제 내역을 확인하지 못했습니다.');
        return result;
      }
      resCd = payload.res_cd;
    }
  }
  return { kind: 'not_confirmed', resCd };
}

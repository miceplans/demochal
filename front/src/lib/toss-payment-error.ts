/**
 * 토스 SDK 로드/결제창 호출 실패. ApiError가 아니므로 감싸지 않으면 "서버 연결 오류"로 오인된다.
 * api-error.ts가 SDK 번들을 끌어오지 않도록 payments.ts와 분리한다.
 */
export class TossPaymentError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'TossPaymentError';
    this.code = code;
  }
}

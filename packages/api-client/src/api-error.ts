import { ApiError } from './http';

/**
 * API 에러에서 서버가 내려준 사용자 안내 메시지(NestJS 응답의 body.message)를 추출한다.
 * message는 문자열이거나 ValidationPipe가 내려주는 문자열 배열일 수 있다.
 * 서버 메시지가 없으면 undefined를 반환해 호출자가 fallback을 결정하게 한다.
 */
export function getApiErrorMessage(error: unknown): string | undefined {
  if (!(error instanceof ApiError) || !error.body || typeof error.body !== 'object') return;
  const message = (error.body as { message?: unknown }).message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message)) {
    const first = message.find((item): item is string => typeof item === 'string' && !!item.trim());
    if (first) return first;
  }
}

import { ApiError, getApiErrorMessage } from '@semochal/api-client';

export const NETWORK_ERROR_MESSAGE =
  '서버에 연결할 수 없어요. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.';

/**
 * 사용자에게 보여줄 에러 메시지를 정한다.
 * 1) 서버가 내려준 body.message(문자열/배열 첫 항목) — 실제 원인을 가장 정확히 설명한다.
 * 2) ApiError가 아닌 Error(fetch 실패 등 네트워크 문제) — 연결 오류로 구분해 안내한다.
 * 3) 그 외(파싱 불가 body 등) — 호출자의 fallback 문구.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const serverMessage = getApiErrorMessage(error);
  if (serverMessage) return serverMessage;
  if (!(error instanceof ApiError) && error instanceof Error) return NETWORK_ERROR_MESSAGE;
  return fallback;
}
